#!/bin/bash
set -e

# Export necessary environment variables
export GOOGLE_CLOUD_PROJECT=ai-agent-457101
export GCLOUD_PROJECT=ai-agent-457101
export GOOGLE_CLOUD_LOCATION=us-central1
export GOOGLE_GENAI_USE_VERTEXAI=TRUE

# Ensure the current directory is in PYTHONPATH to handle imports correctly
# The ADK framework needs to be able to import the agent module.
# This fixes the path duplication issue by using '.' instead of 'ai-agent'
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
export PYTHONPATH=".:$PYTHONPATH:$SCRIPT_DIR"

# Parse command-line arguments
PORT=8000
LOG_LEVEL="INFO"
FRONTEND_URL="http://localhost:3000"
LOG_TO_TMP=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --port) PORT="$2"; shift ;;
        --log-level) LOG_LEVEL="$2"; shift ;;
        --frontend-url) FRONTEND_URL="$2"; shift ;;
        --log-to-tmp) LOG_TO_TMP=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Build additional arguments
ADDITIONAL_ARGS=""
if [ "$LOG_TO_TMP" = true ] ; then
    ADDITIONAL_ARGS="$ADDITIONAL_ARGS --log_to_tmp"
fi

# Start the ADK agent from the current directory
# This fixes the path duplication issue by using '.' instead of 'ai-agent'
echo "---------------------------------------------"
echo "Starting ADK agent with configuration:"
echo "  - Port: $PORT"
echo "  - Log Level: $LOG_LEVEL"
echo "  - Frontend URL: $FRONTEND_URL"
echo "  - Log to temp: $LOG_TO_TMP"
echo "  - PYTHONPATH: $PYTHONPATH"
echo "---------------------------------------------"
echo "Web server will be available at http://localhost:$PORT"
echo "---------------------------------------------"

# Use current directory (.) instead of 'ai-agent' to prevent path duplication
# in imports as PYTHONPATH already includes the necessary path.
echo "Running ADK agent from directory: $(pwd)"
adk web . \
    --port $PORT \
    --log_level $LOG_LEVEL \
    --allow_origins $FRONTEND_URL \
    $ADDITIONAL_ARGS 