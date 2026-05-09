#!/bin/bash
# Initialise the MongoDB replica set (rs0) on first container start.
# This script runs inside the mongo container via docker-entrypoint-initdb.d.

set -e

echo "[RS-INIT] Waiting for mongod to be ready..."
until mongosh --quiet --eval "db.adminCommand('ping').ok" > /dev/null 2>&1; do
  sleep 1
done

echo "[RS-INIT] Initiating replica set rs0..."
mongosh --quiet --eval "
  try {
    rs.status();
    print('[RS-INIT] Replica set already initialised.');
  } catch (e) {
    rs.initiate({
      _id: 'rs0',
      members: [{ _id: 0, host: 'mongodb:27017' }]
    });
    print('[RS-INIT] Replica set rs0 initiated.');
  }
"
