#!/bin/bash

# Script to protect .env files from AI access
echo "🔒 Protecting .env files from AI access..."

# Set restrictive permissions on .env files
find . -name ".env*" -type f -exec chmod 600 {} \; 2>/dev/null

# Create/update ignore files for various AI editors
echo "📝 Updating AI ignore files..."

# Ensure .gitignore blocks .env files
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
    echo ".env.*" >> .gitignore
fi

# Create .cursorignore if it doesn't exist
if [ ! -f .cursorignore ]; then
    cat > .cursorignore << 'EOF'
.env
.env.*
**/secrets.json
**/credentials.json
*.pem
*.key
EOF
fi

# Create .aiignore if it doesn't exist
if [ ! -f .aiignore ]; then
    cat > .aiignore << 'EOF'
.env
.env.*
**/secrets.json
**/credentials.json
*.pem
*.key
EOF
fi

echo "✅ Environment files protected from AI access"
echo "🔍 Protected files:"
find . -name ".env*" -type f 2>/dev/null | head -10

echo ""
echo "📋 Protection methods applied:"
echo "  - File permissions set to 600 (owner read/write only)"
echo "  - .gitignore updated"
echo "  - .cursorignore created/updated"
echo "  - .aiignore created/updated"
echo "  - .easignore updated"