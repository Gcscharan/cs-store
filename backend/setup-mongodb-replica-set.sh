#!/bin/bash

# MongoDB Replica Set Setup Script
# This script converts a standalone MongoDB instance to a single-node replica set
# Required for MongoDB transactions to work

echo "🔧 MongoDB Replica Set Setup"
echo "=============================="
echo ""

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "❌ MongoDB is not running!"
    echo ""
    echo "Please start MongoDB first:"
    echo "  brew services start mongodb-community"
    echo "  # OR"
    echo "  mongod --dbpath /path/to/data"
    exit 1
fi

echo "✅ MongoDB is running"
echo ""

# Check current replica set status
echo "📋 Checking current configuration..."
REPLICA_STATUS=$(mongosh --quiet --eval "rs.status().ok" 2>/dev/null || echo "0")

if [ "$REPLICA_STATUS" = "1" ]; then
    echo "✅ Replica set is already configured!"
    echo ""
    mongosh --quiet --eval "rs.status()" | head -20
    exit 0
fi

echo "⚠️  MongoDB is running in standalone mode"
echo ""
echo "🔄 Converting to replica set..."
echo ""

# Stop MongoDB
echo "1. Stopping MongoDB..."
brew services stop mongodb-community 2>/dev/null || pkill mongod
sleep 2

# Start MongoDB with replica set
echo "2. Starting MongoDB with replica set..."
echo ""
echo "   Run this command in a separate terminal:"
echo "   mongod --replSet rs0 --dbpath /opt/homebrew/var/mongodb"
echo ""
echo "   Press Enter when MongoDB is running..."
read

# Initialize replica set
echo "3. Initializing replica set..."
mongosh --eval "rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: 'localhost:27017' }]
})"

echo ""
echo "4. Waiting for replica set to initialize..."
sleep 5

# Check status
echo ""
echo "5. Checking replica set status..."
mongosh --eval "rs.status()" | head -20

echo ""
echo "✅ Replica set setup complete!"
echo ""
echo "📝 To make this permanent, update your MongoDB config:"
echo "   File: /opt/homebrew/etc/mongod.conf"
echo "   Add:"
echo "     replication:"
echo "       replSetName: rs0"
echo ""
echo "   Then restart MongoDB:"
echo "     brew services restart mongodb-community"
