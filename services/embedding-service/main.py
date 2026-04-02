"""
Embedding Service - Semantic AI Layer

Production-grade embedding service using sentence-transformers
Model: all-MiniLM-L6-v2 (384 dimensions, fast, accurate)

Usage:
    uvicorn main:app --reload --port 8001
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from typing import List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Embedding Service",
    description="Semantic embedding service for product search",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model on startup (cached in memory)
logger.info("Loading sentence-transformers model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
logger.info("✅ Model loaded successfully")

# Request/Response models
class TextInput(BaseModel):
    text: str

class BatchTextInput(BaseModel):
    texts: List[str]

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    dimensions: int

class BatchEmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    dimensions: int
    count: int

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": "all-MiniLM-L6-v2",
        "dimensions": 384
    }

@app.post("/embed", response_model=EmbeddingResponse)
def embed_text(input: TextInput):
    """
    Generate embedding for single text
    
    Example:
        POST /embed
        {"text": "Green Lays Chips 50g"}
    """
    try:
        if not input.text or not input.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Generate embedding
        vector = model.encode(input.text).tolist()
        
        logger.info(f"Generated embedding for: {input.text[:50]}...")
        
        return {
            "embedding": vector,
            "dimensions": len(vector)
        }
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed/batch", response_model=BatchEmbeddingResponse)
def embed_batch(input: BatchTextInput):
    """
    Generate embeddings for multiple texts (batch processing)
    
    More efficient than calling /embed multiple times
    
    Example:
        POST /embed/batch
        {"texts": ["Green Lays", "Pepsi 500ml", "Dairy Milk"]}
    """
    try:
        if not input.texts or len(input.texts) == 0:
            raise HTTPException(status_code=400, detail="Texts list cannot be empty")
        
        # Batch encode (more efficient)
        vectors = model.encode(input.texts).tolist()
        
        logger.info(f"Generated {len(vectors)} embeddings in batch")
        
        return {
            "embeddings": vectors,
            "dimensions": len(vectors[0]) if vectors else 0,
            "count": len(vectors)
        }
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
