# AI Agent Service

A production-ready AI agent built with Google's Agent Development Kit (ADK) and deployed on Cloud Run. This service provides a scalable, API-accessible conversational AI agent that can be integrated with any frontend application.

## Architecture Overview

The service consists of:

- **Agent Logic**: Built with Google ADK, defined in `agent.py` with specialized sub-agents
- **API Server**: FastAPI-based server exposing REST endpoints for agent communication (`ai-service` on Cloud Run)
- **Session Management**: Persistent conversation storage via SQLite database
- **Authentication**: Token-based authentication for secure client-server communication
- **Cloud Deployment**: Containerized service running on Google Cloud Run

## Prerequisites

- Python 3.11+
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
- [Google Agent Development Kit](https://github.com/google-ai/agent-development-kit) (`pip install google-adk`)
- Google Cloud Project with:
  - Vertex AI API enabled
  - Cloud Run API enabled
  - Cloud Build API enabled
  - Artifact Registry API enabled
  - IAM API enabled
  - Proper IAM permissions configured (see below)

## Setup & Installation

### 1. Clone and Configure

```bash
# Clone repository (if you haven't already)
# git clone <repository-url>
cd ai-agent

# Install dependencies
pip install -r requirements.txt
```

### 2. Google Cloud Project Setup

**(See "Google Cloud Setup Instructions" section below)**

```bash
# Set your project ID and region environment variables
export PROJECT_ID="ai-agent-457101"
export REGION="us-central1"  # Or your preferred region

# Configure gcloud (login if needed)
gcloud auth login
gcloud config set project $PROJECT_ID

# Enable required APIs (if not done during project setup)
gcloud services enable run.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable iam.googleapis.com
```

### 3. Service Account Setup

**(See "Google Cloud Setup Instructions" section below for details)**

```bash
# Example: Create service account for the agent (if not using an existing one)
# Service Account used in this example:
export SA_EMAIL="ai-agent@ai-agent-457101.iam.gserviceaccount.com"
export SA_NAME=$(echo $SA_EMAIL | cut -d'@' -f1)

# If creating new:
# gcloud iam service-accounts create $SA_NAME \
#   --display-name="AI Agent Service Account"

# Add required permissions (Vertex AI User)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user"

# Grant permission for the service account to invoke the Cloud Run service (done after deployment)
# gcloud run services add-iam-policy-binding ai-service \
#   --region=$REGION \
#   --member="serviceAccount:${SA_EMAIL}" \
#   --role="roles/run.invoker"
```

### 4. Local Development

Create a `.env` file (or set environment variables) with required configuration:

```bash
# .env or environment variables
GOOGLE_CLOUD_PROJECT=ai-agent-457101
GOOGLE_CLOUD_LOCATION=us-central1 # Match your region
GOOGLE_GENAI_USE_VERTEXAI=TRUE
# SERPER_API_KEY=your-serper-api-key  # Optional for web search tool
```

Run the agent locally using the provided script:

```bash
# Start local development server (defaults to port 8000)
./run-local.sh

# With options
./run-local.sh --port 8080 --log-level DEBUG --frontend-url http://localhost:3000
```

The agent will be available at `http://localhost:<port>`.

### 5. Cloud Run Deployment

Deploy to Cloud Run using the provided script (ensure `PROJECT_ID` and `REGION` are set):

```bash
# Deploy to Cloud Run (uses PROJECT_ID and REGION from environment)
./deploy-cloud-run.sh
```

This script:
1. Builds a Docker container image using Cloud Build
2. Pushes it to Google Artifact Registry
3. Deploys it to Cloud Run as the `ai-service` service
4. Configures environment variables and basic settings

### 6. Configure Service Account for Cloud Run

The deployment script attempts to set the service account. Verify or set it manually if needed:

```bash
# Ensure the Cloud Run service runs as your chosen service account
export SA_EMAIL="ai-agent@ai-agent-457101.iam.gserviceaccount.com"
gcloud run services update ai-service \
  --service-account=$SA_EMAIL \
  --project=$PROJECT_ID \
  --region=$REGION
```

## Client Integration

### Generate Credentials for Client Authentication

The deployed Cloud Run service (`ai-service`) is likely configured for authenticated access. Your frontend needs credentials to generate ID tokens to call the service.

**Method 1: Use Application Default Credentials (ADC) - Recommended for Google Cloud environments**
If your frontend runs on Google Cloud (e.g., App Engine, another Cloud Run service), configure it to run as a service account that has the `roles/run.invoker` permission for `ai-service`. ADC will handle authentication automatically.

**Method 2: Service Account Key File (Use with caution)**
If your frontend runs outside Google Cloud or cannot use ADC easily, you can use a service account key.

```bash
# Grant the service account permission to invoke the Cloud Run service
export SA_EMAIL="ai-agent@ai-agent-457101.iam.gserviceaccount.com"
gcloud run services add-iam-policy-binding ai-service \
  --region=$REGION \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker"

# Create a service account key file (store securely!)
gcloud iam service-accounts keys create client-key.json \
  --iam-account=${SA_EMAIL}

# Convert the key to a base64-encoded string for environment variables
cat client-key.json | base64 | tr -d '\\n' > key_base64.txt
# Copy contents to GOOGLE_APPLICATION_CREDENTIALS_JSON in frontend .env

# Securely delete the key files after adding to environment
# rm client-key.json key_base64.txt
```

### Frontend Configuration (.env.local Example)

```
# AI Agent Service Configuration
LOCAL_ADK_URL=http://127.0.0.1:8000 # Match local run port
ADK_PRIMARY_ENDPOINT=/run # Default endpoint for ADK
CLOUD_ADK_URL=<your-ai-service-cloud-run-url> # Get from './deploy-cloud-run.sh' output
USE_CLOUD_ADK=true # Set to 'true' or 'yes' for production

# Auth settings
NO_ADK_AUTH=false # Set to 'true' for local development IF agent allows unauthenticated
DEBUG_ADK_INTEGRATION=true # Enable for detailed auth/request logs

# Credentials (ONLY if using Method 2 above)
# GOOGLE_APPLICATION_CREDENTIALS_JSON=<base64-encoded-service-account-key>
```

## API Documentation

### Available Endpoints

| Endpoint | Method | Description | Notes |
|----------|--------|-------------|-------|
| `/run` | POST | Send a message to the agent and get a response | Standard ADK endpoint |
| `/run_sse` | POST | Stream agent responses with Server-Sent Events | Standard ADK endpoint |
| `/apps/ai-agent/users/{user_id}/sessions/{session_id}` | POST | Create or update a session | Uses `ai-agent` as app name |
| `/apps/ai-agent/users/{user_id}/sessions/{session_id}/events` | GET | Get session event history | Uses `ai-agent` as app name |
| `/docs` | GET | Swagger UI API documentation | Provided by FastAPI/ADK |
| `/health` | GET | Health check endpoint | Standard |

### Example API Request (Authenticated Cloud Run)

Replace `<your-ai-service-cloud-run-url>` with the URL output by the deployment script.

```bash
# Obtain an ID token (e.g., using gcloud for testing)
TOKEN=$(gcloud auth print-identity-token)

curl -X POST "<your-ai-service-cloud-run-url>/run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "app_name": "ai-agent",
    "user_id": "user-123",
    "session_id": "session-456",
    "new_message": {
      "parts": [{
        "text": "Hello, can you introduce yourself?"
      }],
      "role": "user"
    }
  }'
```

### Session Management

Sessions persist conversation context. Create a session before sending messages:

```bash
TOKEN=$(gcloud auth print-identity-token)

curl -X POST "<your-ai-service-cloud-run-url>/apps/ai-agent/users/user-123/sessions/session-456" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"state": {}}' # Optional initial state
```

## Testing

Use the provided test scripts to verify agent functionality locally:

```bash
# Ensure local agent is running first: ./run-local.sh

# Test agent integration with various formats
./test-agent.sh

# Test session chat flow
./test-session-chat.sh

# Specify custom port if not default 8000
./test-agent.sh --port 8080
./test-session-chat.sh --port 8080
```

The test scripts check:
1. Various API request formats (`test-agent.sh`)
2. Session creation (`test-session-chat.sh`)
3. Message sending and responses
4. Conversation context retention
5. Streaming responses (SSE)
6. Session state management

## Troubleshooting

### Common Issues

1.  **Module Import Errors**: Ensure `./run-local.sh` is used, which sets `PYTHONPATH`. Check dependencies in `requirements.txt`.
2.  **Authentication Failures (Cloud Run)**: Verify:
    *   Client has a valid ID token (`Authorization: Bearer <token>`).
    *   Token audience matches the Cloud Run service URL.
    *   The service account used to generate the token (or the calling service's SA) has `roles/run.invoker` on the `ai-service`.
    *   If using key file: `GOOGLE_APPLICATION_CREDENTIALS_JSON` is correctly formatted and loaded.
3.  **Missing Environment Variables**: Ensure `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_GENAI_USE_VERTEXAI` are set for local and Cloud Run.
4.  **Cloud Run Permissions**: The service account running the `ai-service` (e.g., `ai-agent-sa@...`) needs `roles/aiplatform.user` for Vertex AI access. Check Cloud Run service logs for permission errors.
5.  **CORS Errors**: If calling from a browser, ensure the frontend origin is allowed. The `run-local.sh --frontend-url` and `deploy-cloud-run.sh` attempt to configure this. Check ADK/FastAPI CORS settings if issues persist.

### Logs

-   **Local**: Check terminal output from `./run-local.sh`. Use `--log-level DEBUG` for more detail. Test script logs are saved to files like `agent_test_*.log`.
-   **Cloud Run**: View logs in the Google Cloud Console under Cloud Run -> `ai-service` -> Logs.
-   **Frontend**: Enable `DEBUG_ADK_INTEGRATION=true` in frontend `.env` for detailed request/auth logs.

## Components Details

### Agent Structure

- **Root Agent (`agent.py:root_agent`)**: Main orchestrator, likely using `adk.Agent(...)`.
- **Sub-agents/Tools**: Defined within `agent.py` or imported, potentially using `@adk.tool`. Check the code for specific agent logic.

### Tools

The agent likely includes tools defined using `@adk.tool` in `agent.py`. Examples might include:
- `get_session_history`: Retrieves conversation history.
- `search_web`: Performs web searches (may require API keys like `SERPER_API_KEY`).

Check `agent.py` for actual tools implemented.

## License

[Add your license information here] 