# AI Agent Frontend

This is the frontend application for the AI Agent, built with:

- **Next.js 14** (React framework with App Router)
- **TypeScript** (Type-safe JavaScript)
- **Tailwind CSS** (Utility-first CSS framework)
- **Firebase** (Authentication and Firestore database)
- **Google's Agent Development Kit** (ADK) integration

## Prerequisites

- Node.js 18+ and npm/pnpm
- Firebase project with Firestore and Authentication enabled
- Access to the AI agent service (local or Cloud Run)

## Environment Setup

1.  **Ensure Firebase Project is Ready:**
    Make sure you have a Firebase project linked to your Google Cloud Project (`ai-agent-457101`).
    - Go to the [Firebase Console](https://console.firebase.google.com/) and add or select your project.
    - Ensure **Authentication** (with desired providers, e.g., Email/Password, Google) and **Firestore Database** are enabled.

2.  **Copy Environment File:**
    If it doesn't exist, copy the example environment file:
    ```bash
    cp .env.local.example .env.local
    ```

3.  **Update `.env.local`:**
    Fill in the variables in `.env.local` with values specific to your project. See the detailed explanation below.

### Environment Variable Details (`.env.local`)

This file contains sensitive keys and configuration. **Do not commit it to version control.**

**Firebase Client Configuration (Required for Frontend)**
*   `NEXT_PUBLIC_FIREBASE_API_KEY`: Your Firebase project's Web API Key.
    *   *How to find:* Firebase Console -> Project Settings (gear icon) -> General -> Your apps -> Web apps -> SDK setup and configuration -> `apiKey`.
*   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Your Firebase project's auth domain.
    *   *How to find:* Same location as API Key -> `authDomain`.
*   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Your Firebase project ID.
    *   *How to find:* Same location as API Key -> `projectId` (should match your GCP project ID `ai-agent-457101`).
*   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Your Firebase project's Cloud Storage bucket.
    *   *How to find:* Same location as API Key -> `storageBucket`.
*   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase project's messaging sender ID.
    *   *How to find:* Same location as API Key -> `messagingSenderId`.
*   `NEXT_PUBLIC_FIREBASE_APP_ID`: Your Firebase Web App's ID.
    *   *How to find:* Same location as API Key -> `appId`.

**Firebase Admin SDK Configuration (Required for Server-Side Functions/API Routes)**
These are used by Next.js API routes (like `/api/adk`) to perform admin tasks (e.g., verifying user tokens).
*   `FIREBASE_ADMIN_PROJECT_ID`: Your Firebase/GCP project ID (`ai-agent-457101`).
*   `FIREBASE_ADMIN_CLIENT_EMAIL`: Email of the service account used by the Admin SDK.
    *   *How to find:* Firebase Console -> Project Settings -> Service accounts -> Generate new private key (or use an existing one like `firebase-adminsdk-xxxx@...`). The `client_email` is in the downloaded JSON key file.
    *   *Note:* You could potentially use the same service account created for the AI Agent (`ai-agent@ai-agent-457101.iam.gserviceaccount.com`) if it has appropriate Firebase permissions (e.g., Firebase Admin role, or specific roles needed).
*   `FIREBASE_ADMIN_PRIVATE_KEY`: The private key for the service account above.
    *   *How to find:* Found in the JSON key file downloaded from Firebase/GCP. **Important:** Copy the entire key string, including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`, and replace literal newline characters (`\n`) with the escaped sequence `\\n` when setting it in `.env.local` (or use quotes as shown in the example).

**ADK Integration Configuration**
*   `LOCAL_ADK_URL`: URL for the locally running `ai-agent` service. Default in `ai-agent/run-local.sh` is `http://127.0.0.1:8000` or `http://localhost:8000`.
*   `ADK_PRIMARY_ENDPOINT`: The API route on the ADK service used for sending messages (usually `/run`).
*   `CLOUD_ADK_URL`: The HTTPS URL of your deployed `ai-service` on Cloud Run. Get this from the output of the `ai-agent/deploy-cloud-run.sh` script.
*   `USE_CLOUD_ADK`: Set to `true` when you want the frontend to talk to the deployed Cloud Run service. Set to `false` to talk to the local ADK service.
*   `NEXT_PUBLIC_DEPLOY_URL`: The base URL where this frontend application itself is running (e.g., `http://localhost:3000` for local dev, or your production Vercel/Cloud Run URL).
*   `NO_ADK_AUTH`: For local development **only**. Set to `true` if your *local* ADK agent doesn't require authentication. Keep `false` for Cloud Run unless the service is intentionally public.
*   `DEBUG_ADK_INTEGRATION`: Set to `true` to enable detailed console logging within the `/api/adk` route for troubleshooting requests and authentication.

**Client-Side Cloud Run Authentication (Required if `USE_CLOUD_ADK=true` and Service is Authenticated)**
This is needed if your frontend needs to authenticate its requests to the secured Cloud Run `ai-service` directly from server-side API routes.
*   `GOOGLE_APPLICATION_CREDENTIALS_JSON`: Contains the **base64-encoded** JSON key of a service account authorized to call the `ai-service`.
    *   **Which Service Account?** This account needs the `roles/run.invoker` role on the `ai-service` Cloud Run service. You can use the `ai-agent@ai-agent-457101.iam.gserviceaccount.com` service account (after granting it the invoker role) or create a dedicated one for the frontend.
    *   **How to get:**
        1.  Ensure the chosen service account has the `roles/run.invoker` role on `ai-service`:
            ```bash
            gcloud run services add-iam-policy-binding ai-service --region=us-central1 --member="serviceAccount:<your-sa-email>" --role="roles/run.invoker" --project=ai-agent-457101
            ```
        2.  Download the JSON key for that service account:
            ```bash
            gcloud iam service-accounts keys create frontend-key.json --iam-account=<your-sa-email> --project=ai-agent-457101
            ```
        3.  **Base64 encode** the key file contents:
            ```bash
            # On macOS:
            cat frontend-key.json | base64 | tr -d '\n' 
            # On Linux:
            cat frontend-key.json | base64 -w 0
            ```
        4.  Copy the resulting long base64 string and paste it as the value for `GOOGLE_APPLICATION_CREDENTIALS_JSON` in `.env.local`.
        5.  Securely delete the `frontend-key.json` file.

## Development

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## ADK Agent Integration

### Local Development

To use the AI agent locally:

1. Start the AI Agent Service:
   Ensure the backend AI agent service is running locally. Navigate to the `ai-agent` directory and run:
   ```bash
   ./run-local.sh
   # or with custom port, e.g.:
   # ./run-local.sh --port 8000
   ```

2. Ensure your `.env.local` has:
   ```
   LOCAL_ADK_URL=http://localhost:8000
   USE_CLOUD_ADK=false
   ADK_PRIMARY_ENDPOINT=/run
   ```

3. Start the frontend:
   ```bash
   pnpm dev
   ```

### Production Deployment

For production with Cloud Run:

1. Deploy the ADK agent to Cloud Run using the deployment script in the `ai-agent` directory.
   Make sure you have configured the project ID and service account correctly in `ai-agent/deploy-cloud-run.sh`.
   ```bash
   cd ../ai-agent
   ./deploy-cloud-run.sh
   ```

2. Update your `.env.local` with:
   ```
   CLOUD_ADK_URL=https://your-cloud-run-url.a.run.app
   USE_CLOUD_ADK=true
   GOOGLE_APPLICATION_CREDENTIALS_JSON={"your":"service-account-json"}
   NEXT_PUBLIC_DEPLOY_URL=https://your-frontend-url.vercel.app
   ```

## ADK Communication Flow

The frontend communicates with the ADK agent through these detailed steps:

1. **User sends a message in a chat session**
   - The message is saved to the UI state
   - A loading state is triggered for the assistant response

2. **Frontend saves the user message to Firestore**
   - The message is stored in the `sessions/{sessionId}/messages` collection
   - The session's `updatedAt` timestamp is updated

3. **Frontend calls the ADK agent via the `/api/adk` proxy endpoint**
   - The request includes:
     ```json
     {
       "user_id": "firebase-user-id",
       "session_id": "firestore-session-id",
       "new_message": {
         "role": "user",
         "text": "user message content"
       },
       "context": { /* optional additional context */ }
     }
     ```

4. **API Gateway (`/api/adk`) processing**
   - Authenticates the request using Firebase ID token
   - Determines whether to use local or cloud-hosted ADK
   - For cloud deployment, obtains an authenticated ID token for Cloud Run
   - Forwards the request to the appropriate ADK endpoint

5. **ADK agent processes the message and returns a response**
   - The agent processes the message and context
   - It returns a structured response with text content and events

6. **Frontend parses and saves the AI response to Firestore**
   - The API extracts the text response from the ADK response
   - It saves the assistant message to the `sessions/{sessionId}/messages` collection

7. **Frontend displays the response to the user**
   - The UI updates to show the assistant's response
   - Loading state is cleared

## Troubleshooting

If you're experiencing connection issues with the ADK agent:

1. Verify that the ADK agent is running (check terminal where `adk run` was executed)
2. Confirm that the correct URLs and endpoints are set in `.env.local`
3. Check browser console and server logs for errors
4. Enable debug mode with `DEBUG_ADK_INTEGRATION=true` 
5. Try sending a test request directly to the ADK agent:
   ```bash
   curl -X POST http://localhost:8000/run \
     -H "Content-Type: application/json" \
     -d '{"user_id": "test-user", "session_id": "test-session", "new_message": {"role": "user", "text": "Hello"}}'
   ```

### Common Issues

- **Authentication errors**: Ensure proper Firebase auth setup and tokens
- **CORS issues**: Check that the ADK agent allows requests from your frontend URL
- **Timeout errors**: The ADK agent might be taking too long to respond; check its logs
- **Parsing errors**: Ensure the response format from ADK matches what the frontend expects

## Building for Production

```bash
pnpm build
```

This will create an optimized production build in the `.next` folder.

## Deployment

The frontend can be deployed to Vercel or any other Next.js compatible hosting platform.

For Vercel deployment:

```bash
vercel
```

Remember to set the environment variables in your hosting platform.
