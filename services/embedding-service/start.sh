#!/bin/bash

# Embedding Service Startup Script
# Starts the Python embedding service on port 8001

echo "🚀 Starting Embedding Service..."
echo "📍 Port: 8001"
echo "🔧 Model: all-MiniLM-L6-v2"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check if uvicorn is installed
if ! python3 -c "import uvicorn" 2>/dev/null; then
    echo "⚠️  uvicorn not found. Installing dependencies..."
    pip3 install -r requirements.txt
fi

# Start the service
echo "✅ Starting service..."
python3 -m uvicorn main:app --reload --port 8001 --host 0.0.0.0
