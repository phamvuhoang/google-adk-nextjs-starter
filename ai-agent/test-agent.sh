#!/bin/bash
set -e

# Set important environment variables
export GOOGLE_CLOUD_PROJECT=ai-agent-457101
export GCLOUD_PROJECT=ai-agent-457101
export GOOGLE_CLOUD_LOCATION=us-central1

# Configurable parameters
PORT=8000
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --port) PORT="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

ADK_URL="http://localhost:$PORT"
# Different formats to try
echo "Testing ADK Agent at $ADK_URL..."

# Check if the server is running
if ! curl -s --head "$ADK_URL" > /dev/null; then
    echo "ERROR: ADK agent is not running at $ADK_URL"
    echo "Please start the agent first with: ./run-local.sh"
    exit 1
fi

# Check if we have curl installed
if ! command -v curl &> /dev/null; then
    echo "Error: curl is not installed. Please install curl to run this test."
    exit 1
fi

echo "Attempting to test the ADK agent with various request formats..."

# Format 1: Simple message in plain API request
echo "---------------------------------------------"
echo "Testing format 1: Simple API request"
RESPONSE1=$(curl -s -X POST "$ADK_URL/api" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, can you introduce yourself briefly?", 
    "user_id": "test-user",
    "session_id": "test-session"
  }')

# Check if valid response
if ! echo "$RESPONSE1" | grep -q "error\|detail"; then
    echo "Success! Simple API format works:"
    echo "$RESPONSE1" | json_pp
    FORMAT_TO_USE="Simple API"
    WORKING_ENDPOINT="/api"
    WORKING_FORMAT='{
    "input": "YOUR_MESSAGE_HERE",
    "user_id": "USER_ID",
    "session_id": "SESSION_ID"
}'
else
    echo "Error with simple API format:"
    echo "$RESPONSE1" | json_pp
fi

# Format 2: Messages array in run request
echo "---------------------------------------------"
echo "Testing format 2: Run with messages array"
RESPONSE2=$(curl -s -X POST "$ADK_URL/run" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user", 
        "content": "Hello, can you introduce yourself briefly?"
      }
    ],
    "user_id": "test-user",
    "session_id": "test-session"
  }')

# Check if valid response
if ! echo "$RESPONSE2" | grep -q "error\|detail"; then
    echo "Success! Messages array format works:"
    echo "$RESPONSE2" | json_pp
    FORMAT_TO_USE="Messages array"
    WORKING_ENDPOINT="/run"
    WORKING_FORMAT='{
    "messages": [
      {
        "role": "user", 
        "content": "YOUR_MESSAGE_HERE"
      }
    ],
    "user_id": "USER_ID",
    "session_id": "SESSION_ID"
}'
else
    echo "Error with messages array format:"
    echo "$RESPONSE2" | json_pp
fi

# Format 3: New message object format
echo "---------------------------------------------"
echo "Testing format 3: New message object"
RESPONSE3=$(curl -s -X POST "$ADK_URL/run" \
  -H "Content-Type: application/json" \
  -d '{
    "new_message": {
        "role": "user",
        "content": "Hello, can you introduce yourself briefly?"
    },
    "user_id": "test-user",
    "session_id": "test-session"
  }')

# Check if valid response
if ! echo "$RESPONSE3" | grep -q "error\|detail"; then
    echo "Success! New message object format works:"
    echo "$RESPONSE3" | json_pp
    FORMAT_TO_USE="New message object"
    WORKING_ENDPOINT="/run"
    WORKING_FORMAT='{
    "new_message": {
        "role": "user",
        "content": "YOUR_MESSAGE_HERE"
    },
    "user_id": "USER_ID",
    "session_id": "SESSION_ID"
}'
else
    echo "Error with new message object format:"
    echo "$RESPONSE3" | json_pp
fi

# Format 4: Direct agent invocation - for local web server
echo "---------------------------------------------"
echo "Testing format 4: Direct agent invocation"
RESPONSE4=$(curl -s -X POST "$ADK_URL/agents/ai-agent" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, can you introduce yourself briefly?"
  }')

# Check if valid response
if ! echo "$RESPONSE4" | grep -q "error\|detail"; then
    echo "Success! Direct agent invocation works:"
    echo "$RESPONSE4" | json_pp
    FORMAT_TO_USE="Direct agent invocation"
    WORKING_ENDPOINT="/agents/ai-agent"
    WORKING_FORMAT='{
    "input": "YOUR_MESSAGE_HERE"
}'
else
    echo "Error with direct agent invocation:"
    echo "$RESPONSE4" | json_pp
fi

# Format 5: ADK Web Server format with app_name
echo "---------------------------------------------"
echo "Testing format 5: ADK Web Server format with app_name"
RESPONSE5=$(curl -s -X POST "$ADK_URL/run" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "ai-agent",
    "user_id": "test-user",
    "session_id": "test-session",
    "message": "Hello, can you introduce yourself briefly?"
  }')

# Check if valid response
if ! echo "$RESPONSE5" | grep -q "error\|detail"; then
    echo "Success! ADK Web Server format with app_name works:"
    echo "$RESPONSE5" | json_pp
    FORMAT_TO_USE="ADK Web Server"
    WORKING_ENDPOINT="/run"
    WORKING_FORMAT='{
    "app_name": "ai-agent",
    "user_id": "USER_ID",
    "session_id": "SESSION_ID",
    "message": "YOUR_MESSAGE_HERE"
}'
else
    echo "Error with ADK Web Server format with app_name:"
    echo "$RESPONSE5" | json_pp
fi

# Format 6: ADK Web Server format with app_name and structured message
echo "---------------------------------------------"
echo "Testing format 6: ADK Web Server format with app_name and structured message"
RESPONSE6=$(curl -s -X POST "$ADK_URL/run" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "ai-agent",
    "user_id": "test-user",
    "session_id": "test-session",
    "new_message": {
      "content": "Hello, can you introduce yourself briefly?"
    }
  }')

# Check if valid response
if ! echo "$RESPONSE6" | grep -q "error\|detail"; then
    echo "Success! ADK Web Server format with app_name and structured message works:"
    echo "$RESPONSE6" | json_pp
    FORMAT_TO_USE="ADK Web Server with structured message"
    WORKING_ENDPOINT="/run"
    WORKING_FORMAT='{
    "app_name": "ai-agent",
    "user_id": "USER_ID",
    "session_id": "SESSION_ID",
    "new_message": {
      "content": "YOUR_MESSAGE_HERE"
    }
}'
else
    echo "Error with ADK Web Server format with app_name and structured message:"
    echo "$RESPONSE6" | json_pp
fi

# Format 7: ADK OpenAPI Schema Compliant Format
echo "---------------------------------------------"
echo "Testing format 7: ADK OpenAPI Schema Compliant Format"
RESPONSE7=$(curl -s -X POST "$ADK_URL/run" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "ai-agent",
    "user_id": "test-user",
    "session_id": "test-session",
    "new_message": {
      "parts": [{
        "text": "Hello, can you introduce yourself briefly?"
      }],
      "role": "user"
    }
  }')

# Check if valid response
if ! echo "$RESPONSE7" | grep -q "error\|detail"; then
    echo "Success! ADK OpenAPI Schema Compliant Format works:"
    echo "$RESPONSE7" | json_pp
    FORMAT_TO_USE="ADK OpenAPI Schema"
    WORKING_ENDPOINT="/run"
    WORKING_FORMAT='{
    "app_name": "ai-agent",
    "user_id": "USER_ID",
    "session_id": "SESSION_ID",
    "new_message": {
      "parts": [{
        "text": "YOUR_MESSAGE_HERE"
      }],
      "role": "user"
    }
}'
else
    echo "Error with ADK OpenAPI Schema Compliant Format:"
    echo "$RESPONSE7" | json_pp
fi

# Format 8: ADK OpenAPI Schema - New Session
echo "---------------------------------------------"
echo "Testing format 8: ADK OpenAPI Schema - New Session"
# Generate a unique session ID
NEW_SESSION_ID="test-session-$(date +%s)"
RESPONSE8=$(curl -s -X POST "$ADK_URL/run" \
  -H "Content-Type: application/json" \
  -d "{
    \"app_name\": \"ai-agent\",
    \"user_id\": \"test-user\",
    \"session_id\": \"$NEW_SESSION_ID\",
    \"new_message\": {
      \"parts\": [{
        \"text\": \"Hello, can you introduce yourself briefly?\"
      }],
      \"role\": \"user\"
    }
  }")

# Check if valid response
if ! echo "$RESPONSE8" | grep -q "error\|detail"; then
    echo "Success! ADK OpenAPI Schema - New Session format works:"
    echo "$RESPONSE8" | json_pp
    FORMAT_TO_USE="ADK OpenAPI Schema - New Session"
    WORKING_ENDPOINT="/run"
    WORKING_FORMAT='{
    "app_name": "ai-agent",
    "user_id": "USER_ID",
    "session_id": "NEW_SESSION_ID_HERE",
    "new_message": {
      "parts": [{
        "text": "YOUR_MESSAGE_HERE"
      }],
      "role": "user"
    }
}'
else
    echo "Error with ADK OpenAPI Schema - New Session format:"
    echo "$RESPONSE8" | json_pp
fi

# Format 9: ADK OpenAPI Schema with pre-created Session
echo "---------------------------------------------"
echo "Testing format 9: ADK OpenAPI Schema with pre-created Session"

# First, create a session
echo "Creating a new session via API..."
SESSION_RESPONSE=$(curl -s -X POST "$ADK_URL/apps/ai-agent/users/test-user/sessions" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Session via script"}')
SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"id":"[^"]*"' | sed 's/"id":"//;s/"//')

if [ -z "$SESSION_ID" ]; then
    echo "Failed to create session!"
    echo "$SESSION_RESPONSE"
else
    echo "Successfully created session with ID: $SESSION_ID"

    # Now use the session ID in the request
    RESPONSE9=$(curl -s -X POST "$ADK_URL/run" \
      -H "Content-Type: application/json" \
      -d "{
        \"app_name\": \"ai-agent\",
        \"user_id\": \"test-user\",
        \"session_id\": \"$SESSION_ID\",
        \"new_message\": {
          \"parts\": [{
            \"text\": \"Hello, can you introduce yourself briefly?\"
          }],
          \"role\": \"user\"
        }
      }")

    # Check if valid response
    if ! echo "$RESPONSE9" | grep -q "error\|detail"; then
        echo "Success! ADK OpenAPI Schema with pre-created Session works:"
        echo "$RESPONSE9" | json_pp
        FORMAT_TO_USE="ADK OpenAPI Schema with pre-created Session"
        WORKING_ENDPOINT="/run"
        WORKING_FORMAT="{
        \"app_name\": \"ai-agent\",
        \"user_id\": \"USER_ID\",
        \"session_id\": \"SESSION_ID\",
        \"new_message\": {
          \"parts\": [{
            \"text\": \"YOUR_MESSAGE_HERE\"
          }],
          \"role\": \"user\"
        }
    }"
    else
        echo "Error with ADK OpenAPI Schema with pre-created Session format:"
        echo "$RESPONSE9" | json_pp
    fi
fi

echo "---------------------------------------------"

if [ -n "$FORMAT_TO_USE" ]; then
    echo "SUCCESS: Found working ADK format: $FORMAT_TO_USE"
    echo "Working endpoint: $ADK_URL$WORKING_ENDPOINT"
    echo "Request format to use:"
    echo "$WORKING_FORMAT"
    echo ""
    echo "Update your frontend .env.local file with:"
    echo "ADK_PRIMARY_ENDPOINT=$WORKING_ENDPOINT"
    
    # Save the working format to a file for reference
    echo "Saving working format to working_format.json"
    echo "$WORKING_FORMAT" > working_format.json
else
    echo "WARNING: No working format found."
    echo
    echo "This could be due to one of these reasons:"
    echo "1. The ADK agent is not running properly"
    echo "2. The ADK web server has a different API format than expected"
    echo "3. The model is not responding as expected"
    echo
    echo "=========== Investigation Findings ============="
    echo "Our investigation found that:"
    echo
    echo "1. The web server API accepts the correct format but appears to have"
    echo "   an internal server error when trying to use the model."
    echo
    echo "2. The agent does work when run directly via CLI using:"
    echo "   'adk run ai-agent'"
    echo
    echo "3. The correct request format for the ADK web server should be:"
    echo '{
    "app_name": "ai-agent",
    "user_id": "USER_ID",
    "session_id": "SESSION_ID", 
    "new_message": {
      "parts": [{
        "text": "YOUR_MESSAGE_HERE"
      }],
      "role": "user"
    }
}'
    echo
    echo "4. The session must be created first using this endpoint:"
    echo "   POST /apps/ai-agent/users/USER_ID/sessions"
    echo "   With payload: {'name': 'Session Name'}"
    echo
    echo "========== Recommendations ============"
    echo "1. Check the ADK server logs for the specific error"
    echo "2. Verify Vertex AI permissions and authentication"
    echo "3. Try using the CLI version for now: 'adk run ai-agent'"
    echo "4. Ensure all environment variables are properly set"
    echo "   (GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT, GOOGLE_CLOUD_LOCATION)"
fi 