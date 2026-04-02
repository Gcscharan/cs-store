# Embedding Service

Production-grade semantic embedding service for Phase 4 Voice AI.

## Setup

```bash
cd services/embedding-service
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8001
```

## Test

```bash
curl -X POST http://localhost:8001/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Green Lays Chips"}'
```

## Model

- **Model**: all-MiniLM-L6-v2
- **Dimensions**: 384
- **Speed**: ~50ms per embedding
- **Accuracy**: Good for product search

## Endpoints

- `GET /health` - Health check
- `POST /embed` - Single text embedding
- `POST /embed/batch` - Batch embedding (more efficient)
