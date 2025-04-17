FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install ADK and other dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Verify ADK is installed and in path
RUN which adk && adk --help | head -n 1

# Copy agent code
COPY . .

# Expose port for Cloud Run
EXPOSE 8080

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Set environment variables for Google Cloud
ENV GOOGLE_CLOUD_PROJECT=ai-agent-457101
ENV GOOGLE_CLOUD_LOCATION=us-central1
ENV GOOGLE_GENAI_USE_VERTEXAI=TRUE

# Add parent directory to Python path to fix module import
ENV PYTHONPATH="${PYTHONPATH}:/app"

# Run using uvicorn with FastAPI app
CMD ["python", "main.py"] 