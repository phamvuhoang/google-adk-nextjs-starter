# google-adk-nextjs-starter

This project provides a starter template for building AI-powered applications using Google's Agent Development Kit (ADK) for the backend and Next.js for the frontend.

## Project Structure

- `ai-agent/`: Contains the Python backend powered by Google ADK. This agent handles core AI logic, such as brainstorming, validation, and market research assistance.
- `ai-agent-fe/`: Contains the Next.js frontend application. It provides the user interface, including a landing page and a chat interface to interact with the AI agent.

## Setup

### Prerequisites

- Python (>= 3.9 recommended)
- Node.js (>= 18 recommended) & pnpm
- Google Cloud SDK (`gcloud`)
- [ADK CLI](https://github.com/google/agent-development-kit) (`adk`)

### Initial Setup

1.  **Authenticate with Google Cloud:**
    ```bash
    gcloud auth login
    gcloud auth application-default login
    ```
    *Optional: Set your quota project if needed.*
    ```bash
    # gcloud config set core/project YOUR_PROJECT_ID
    # gcloud auth application-default set-quota-project YOUR_PROJECT_ID
    ```

2.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <your-repo-url>
    cd google-adk-nextjs-starter
    ```

### Backend Setup (`ai-agent`)

1.  **Navigate to the backend directory:**
    ```bash
    cd ai-agent
    ```

2.  **Create and activate a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate # On Windows use `venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure environment variables:**
    - Copy `.env.example` to `.env`.
    - Fill in the required values in the `.env` file.

### Frontend Setup (`ai-agent-fe`)

1.  **Navigate to the frontend directory:**
    ```bash
    cd ../ai-agent-fe # Or from the root: cd ai-agent-fe
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Configure environment variables:**
    - Copy `.env.example` to `.env.local`.
    - Fill in the required values, especially the backend URL (`NEXT_PUBLIC_API_BASE_URL`). If running the backend locally with ADK, this is typically `http://127.0.0.1:8080`.

## Running Locally

1.  **Run the Backend (`ai-agent`):**
    - Make sure you are in the `ai-agent` directory with the virtual environment activated.
    - Start the agent using the ADK CLI:
      ```bash
      adk run .
      ```
    - The backend API will usually be available at `http://127.0.0.1:8080`.

2.  **Run the Frontend (`ai-agent-fe`):**
    - Open a new terminal window.
    - Navigate to the `ai-agent-fe` directory.
    - Start the Next.js development server:
      ```bash
      pnpm run dev
      ```
    - The frontend will usually be available at `http://localhost:3000`.

## Deployment (Example: Google Cloud Run)

Refer to the specific deployment scripts or documentation within each sub-project (`ai-agent/deploy-cloud-run.sh`, etc.) for detailed deployment instructions.

Generally, you will need to:

- Build Docker images for the backend ai agent service.
- Push the images to a container registry (e.g., Google Artifact Registry).
- Deploy the images as Cloud Run services.
- Configure necessary IAM permissions (like allowing the frontend service account to invoke the backend).

