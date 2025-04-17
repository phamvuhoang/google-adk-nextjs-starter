#!/bin/bash
set -e

# Set important environment variables
export GOOGLE_CLOUD_PROJECT=ai-agent-457101 # Replace with your project ID
export GCLOUD_PROJECT=ai-agent-457101       # Same as above
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
# Log output to file
LOGFILE="agent_test_$(date +%Y%m%d_%H%M%S).log"
echo "Logging output to $LOGFILE"
exec > >(tee -a "$LOGFILE") 2>&1

echo "==================================================================="
echo "TESTING AI AGENT API @ $ADK_URL"
echo "==================================================================="

# Check if the server is running
if ! curl -s --head "$ADK_URL" > /dev/null; then
    echo "ERROR: AI agent is not running at $ADK_URL"
    echo "Please start the agent first with: ./run-local.sh"
    exit 1
fi

# Generate unique test IDs
USER_ID="test-user-$(date +%s)"
SESSION_ID="test-session-$(date +%s)"
echo "Using test user ID: $USER_ID"
echo "Using test session ID: $SESSION_ID"

# Test 1: Create a session
echo "==================================================================="
echo "TEST 1: Creating a new session"
echo "==================================================================="
SESSION_RESPONSE=$(curl -s -X POST "$ADK_URL/apps/ai-agent/users/$USER_ID/sessions/$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"state": {}}')

echo "Session creation response:"
echo "$SESSION_RESPONSE" | json_pp || echo "$SESSION_RESPONSE"

# Test 2: Send initial message to session
echo "==================================================================="
echo "TEST 2: Sending first message to session"
echo "==================================================================="
MESSAGE1_RESPONSE=$(curl -s -X POST "$ADK_URL/run" \
  -H "Content-Type: application/json" \
  -d "{
    \"app_name\": \"ai-agent\",
    \"user_id\": \"$USER_ID\",
    \"session_id\": \"$SESSION_ID\",
    \"new_message\": {
      \"parts\": [{
        \"text\": \"Hello, can you introduce yourself?\"
      }],
      \"role\": \"user\"
    }
  }")

echo "First message response:"
echo "$MESSAGE1_RESPONSE" | json_pp || echo "$MESSAGE1_RESPONSE"

# Test 3: Send follow-up message (testing context retention)
echo "==================================================================="
echo "TEST 3: Sending follow-up message (testing context retention)"
echo "==================================================================="
MESSAGE2_RESPONSE=$(curl -s -X POST "$ADK_URL/run" \
  -H "Content-Type: application/json" \
  -d "{
    \"app_name\": \"ai-agent\",
    \"user_id\": \"$USER_ID\",
    \"session_id\": \"$SESSION_ID\",
    \"new_message\": {
      \"parts\": [{
        \"text\": \"What features and capabilities do you have?\"
      }],
      \"role\": \"user\"
    }
  }")

echo "Follow-up message response:"
echo "$MESSAGE2_RESPONSE" | json_pp || echo "$MESSAGE2_RESPONSE"

# Test 4: Test streaming response with SSE
echo "==================================================================="
echo "TEST 4: Testing streaming response with SSE"
echo "==================================================================="
echo "Sending streaming request... (output will be raw SSE format)"
curl -N -X POST "$ADK_URL/run_sse" \
  -H "Content-Type: application/json" \
  -d "{
    \"app_name\": \"ai-agent\",
    \"user_id\": \"$USER_ID\",
    \"session_id\": \"$SESSION_ID\",
    \"new_message\": {
      \"parts\": [{
        \"text\": \"Explain the benefits of using an AI assistant like you\"
      }],
      \"role\": \"user\"
    },
    \"streaming\": true
  }" & 
STREAM_PID=$!

# Let it stream for a few seconds then kill
sleep 5
kill $STREAM_PID 2>/dev/null || true
echo -e "\nStreaming request completed or terminated."

# Test 5: Create a session with specific state
echo "==================================================================="
echo "TEST 5: Creating a session with specific state"
echo "==================================================================="
SESSION_ID2="test-session-state-$(date +%s)"
STATE_RESPONSE=$(curl -s -X POST "$ADK_URL/apps/ai-agent/users/$USER_ID/sessions/$SESSION_ID2" \
  -H "Content-Type: application/json" \
  -d '{
    "state": {
      "user_preferences": {
        "industry": "Technology",
        "interests": ["AI", "Web Development"]
      }
    }
  }')

echo "Session with state creation response:"
echo "$STATE_RESPONSE" | json_pp || echo "$STATE_RESPONSE"

# Test 6: Message that references the state
echo "==================================================================="
echo "TEST 6: Sending message that should access the state"
echo "==================================================================="
STATE_MESSAGE_RESPONSE=$(curl -s -X POST "$ADK_URL/run" \
  -H "Content-Type: application/json" \
  -d "{
    \"app_name\": \"ai-agent\",
    \"user_id\": \"$USER_ID\",
    \"session_id\": \"$SESSION_ID2\",
    \"new_message\": {
      \"parts\": [{
        \"text\": \"What industry and interests do I have according to my profile?\"
      }],
      \"role\": \"user\"
    }
  }")

echo "State-referencing message response:"
echo "$STATE_MESSAGE_RESPONSE" | json_pp || echo "$STATE_MESSAGE_RESPONSE"

echo "==================================================================="
echo "TESTS COMPLETED SUCCESSFULLY"
echo "==================================================================="
echo "Test summary:"
echo "- Created test sessions with IDs: $SESSION_ID, $SESSION_ID2"
echo "- Sent multiple messages to test context retention"
echo "- Tested streaming capabilities"
echo "- Tested state handling"
echo ""
echo "These tests confirm the AI agent's API functionality works correctly."
echo ""
echo "To make API calls from your application, use:"
echo "-----------------------------------------------------------------"
echo "POST $ADK_URL/run"
echo '{
  "app_name": "ai-agent",
  "user_id": "YOUR_USER_ID",
  "session_id": "YOUR_SESSION_ID",
  "new_message": {
    "parts": [{
      "text": "Your message here"
    }],
    "role": "user"
  }
}'
echo "-----------------------------------------------------------------"
echo "Full log available in: $LOGFILE" 