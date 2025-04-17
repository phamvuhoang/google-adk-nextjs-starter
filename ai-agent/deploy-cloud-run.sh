#!/bin/bash
set -e

# Variables
PROJECT_ID="ai-agent-457101"  # Your Google Cloud project ID
REGION="us-central1"       # Cloud Run region
SERVICE_NAME="ai-service"  # Name for your Cloud Run service
# Ensure SERVICE_ACCOUNT_EMAIL is set correctly
SERVICE_ACCOUNT_EMAIL="ai-agent@ai-agent-457101.iam.gserviceaccount.com"
# IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"  # Container image name
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}"

# Print setup
echo "Deploying to Google Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Ensure gcloud is configured with the right project
gcloud config set project $PROJECT_ID

# Build and push the container image using Cloud Build to Artifact Registry
echo "Building and pushing Docker image to Artifact Registry..."
gcloud builds submit --tag $IMAGE_NAME

# Deploy to Cloud Run
echo "Deploying to Cloud Run service: $SERVICE_NAME in region $REGION..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --service-account=$SERVICE_ACCOUNT_EMAIL \
  --timeout=600s \
  --no-allow-unauthenticated \
  --update-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION,GOOGLE_GENAI_USE_VERTEXAI=TRUE,PYTHONPATH=/app" \
  --update-labels "gcb-trigger-id=ai-service-trigger" \
  --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")

echo "Deployment complete!"
echo "Your ADK agent is available at: $SERVICE_URL"
echo ""
echo "To connect your frontend to this service, update the .env.local file:"
echo "CLOUD_ADK_URL=$SERVICE_URL"
echo "USE_CLOUD_ADK=true"
echo ""
echo "IMPORTANT: Your service requires authentication."
echo "1. Grant the necessary invoker role to the service account or principal that needs to call this service:"
echo "   Example for the service account itself (e.g., for client key generation):"
echo "   gcloud run services add-iam-policy-binding $SERVICE_NAME --region=$REGION --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL --role=roles/run.invoker"
echo "   Example for another service account (e.g., frontend service account):"
echo "   gcloud run services add-iam-policy-binding $SERVICE_NAME --region=$REGION --member=serviceAccount:FRONTEND_SA_EMAIL --role=roles/run.invoker"
echo ""
echo "2. If using service account keys for the frontend (Method 2 in README):"
echo "   Download the key for the service account *that has the invoker role* (e.g., $SERVICE_ACCOUNT_EMAIL if granted above):"
echo "   gcloud iam service-accounts keys create key.json --iam-account=$SERVICE_ACCOUNT_EMAIL"
echo ""
echo "3. Add the service account key to your environment variables (IMPORTANT: keep it secure):"
echo "cat key.json | base64 | tr -d '\n' > key_base64.txt"
echo "# Then copy the contents of key_base64.txt to your environment variable GOOGLE_APPLICATION_CREDENTIALS_JSON"
echo ""
echo "4. Enable debugging with:"
echo "DEBUG_ADK_INTEGRATION=true"
echo ""
echo "5. Ensure the service account ($SERVICE_ACCOUNT_EMAIL) has the 'Vertex AI User' role in the project:"
echo "   gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL --role=roles/aiplatform.user"
echo "   (This should have been done during SA creation, but double-check)"

# Grant access to your organization domain (Optional)
# echo "To grant access to your organization domain, run:"
# echo "gcloud run services add-iam-policy-binding $SERVICE_NAME --region=$REGION --member=domain:YOUR_DOMAIN.com --role=roles/run.invoker" 
echo ""
# Final check commands echoed for reference
echo "Reference Commands (Verify roles/permissions):"
echo "gcloud run services add-iam-policy-binding $SERVICE_NAME --region=$REGION --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL --role=roles/run.invoker" # Example: grant SA invoker role
echo "gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL --role=roles/aiplatform.user" # Verify Vertex AI role