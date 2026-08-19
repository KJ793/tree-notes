FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install Docker CLI so backend container can exec into Ollama container
RUN apt-get update && apt-get install docker-cli -y

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY backend/ ./backend

# Expose FastAPI port
EXPOSE 8000

# Start FastAPI with uvicorn
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
