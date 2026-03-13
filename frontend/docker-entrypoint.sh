#!/bin/sh
# Railway assigns a random port via $PORT env var
# Replace hardcoded port in nginx config with actual $PORT
PORT=${PORT:-8080}
BACKEND_URL=${BACKEND_URL:-http://localhost:5001}

# Use envsubst to substitute variables in nginx config
# This handles the $PORT and $BACKEND_URL placeholders
envsubst '${PORT} ${BACKEND_URL}' < /etc/nginx/nginx.conf > /tmp/nginx.conf
mv /tmp/nginx.conf /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
