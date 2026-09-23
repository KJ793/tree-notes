FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl unzip

COPY backend/asr/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/asr/ ./backend/asr

EXPOSE 8000
CMD ["uvicorn", "backend.asr.main:app", "--host", \
     "0.0.0.0", "--port", "8000", \
     "--reload", "--reload-dir", "/app/backend", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
