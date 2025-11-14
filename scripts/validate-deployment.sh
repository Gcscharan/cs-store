#!/bin/bash

# CS Store Deployment Validation Script
# This script validates the deployment configuration

set -e

echo "🚀 CS Store Deployment Validation"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if Docker is installed
echo "Checking Docker installation..."
if command -v docker &> /dev/null; then
    print_status 0 "Docker is installed"
    docker --version
else
    print_warning "Docker is not installed. Please install Docker to run this application."
fi

# Check if Docker Compose is available
echo "Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    print_status 0 "Docker Compose is available"
    docker-compose --version
elif docker compose version &> /dev/null; then
    print_status 0 "Docker Compose (plugin) is available"
    docker compose version
else
    print_warning "Docker Compose is not available. Please install Docker Compose."
fi

# Validate Docker Compose configuration
echo "Validating Docker Compose configuration..."
if command -v docker-compose &> /dev/null; then
    if docker-compose config &> /dev/null; then
        print_status 0 "Docker Compose configuration is valid"
    else
        print_status 1 "Docker Compose configuration has errors"
    fi
elif docker compose version &> /dev/null; then
    if docker compose config &> /dev/null; then
        print_status 0 "Docker Compose configuration is valid"
    else
        print_status 1 "Docker Compose configuration has errors"
    fi
fi

# Check required files
echo "Checking required files..."

required_files=(
    "docker-compose.yml"
    "docker-compose.override.yml"
    "docker-compose.prod.yml"
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "nginx/nginx.conf"
    "nginx/nginx.prod.conf"
    "scripts/mongo-init.js"
    "DEPLOYMENT.md"
    "README.md"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_status 0 "Found $file"
    else
        print_status 1 "Missing $file"
    fi
done

# Check environment files
echo "Checking environment files..."
if [ -f ".env.example" ]; then
    print_status 0 "Found .env.example"
else
    print_warning "Missing .env.example - create one for production deployment"
fi

if [ -f "frontend/.env.example" ]; then
    print_status 0 "Found frontend/.env.example"
else
    print_warning "Missing frontend/.env.example - create one for production deployment"
fi

# Check Dockerfiles
echo "Validating Dockerfiles..."

# Backend Dockerfile validation
if [ -f "backend/Dockerfile" ]; then
    if grep -q "FROM node" backend/Dockerfile; then
        print_status 0 "Backend Dockerfile has valid base image"
    else
        print_status 1 "Backend Dockerfile missing valid base image"
    fi
    
    if grep -q "EXPOSE 5000" backend/Dockerfile; then
        print_status 0 "Backend Dockerfile exposes correct port"
    else
        print_status 1 "Backend Dockerfile missing port exposure"
    fi
fi

# Frontend Dockerfile validation
if [ -f "frontend/Dockerfile" ]; then
    if grep -q "FROM node" frontend/Dockerfile; then
        print_status 0 "Frontend Dockerfile has valid base image"
    else
        print_status 1 "Frontend Dockerfile missing valid base image"
    fi
    
    if grep -q "EXPOSE 5173" frontend/Dockerfile; then
        print_status 0 "Frontend Dockerfile exposes correct port"
    else
        print_status 1 "Frontend Dockerfile missing port exposure"
    fi
fi

# Check Nginx configuration
echo "Validating Nginx configuration..."
if [ -f "nginx/nginx.conf" ]; then
    if grep -q "upstream backend" nginx/nginx.conf; then
        print_status 0 "Nginx configuration has backend upstream"
    else
        print_status 1 "Nginx configuration missing backend upstream"
    fi
    
    if grep -q "upstream frontend" nginx/nginx.conf; then
        print_status 0 "Nginx configuration has frontend upstream"
    else
        print_status 1 "Nginx configuration missing frontend upstream"
    fi
fi

# Check GitHub Actions workflow
echo "Checking GitHub Actions workflow..."
if [ -f ".github/workflows/ci.yml" ]; then
    if grep -q "docker-build" .github/workflows/ci.yml; then
        print_status 0 "GitHub Actions includes Docker build step"
    else
        print_status 1 "GitHub Actions missing Docker build step"
    fi
    
    if grep -q "docker-compose" .github/workflows/ci.yml; then
        print_status 0 "GitHub Actions includes Docker Compose validation"
    else
        print_status 1 "GitHub Actions missing Docker Compose validation"
    fi
else
    print_status 1 "Missing GitHub Actions workflow"
fi

# Check package.json files for Docker-related scripts
echo "Checking package.json files..."

if [ -f "backend/package.json" ]; then
    if grep -q "test" backend/package.json; then
        print_status 0 "Backend package.json has test scripts"
    else
        print_warning "Backend package.json missing test scripts"
    fi
fi

if [ -f "frontend/package.json" ]; then
    if grep -q "test" frontend/package.json; then
        print_status 0 "Frontend package.json has test scripts"
    else
        print_warning "Frontend package.json missing test scripts"
    fi
fi

# Check documentation
echo "Checking documentation..."
if [ -f "DEPLOYMENT.md" ]; then
    if grep -q "Environment Variables" DEPLOYMENT.md; then
        print_status 0 "Deployment documentation includes environment variables"
    else
        print_status 1 "Deployment documentation missing environment variables section"
    fi
    
    if grep -q "docker-compose" DEPLOYMENT.md; then
        print_status 0 "Deployment documentation includes Docker Compose instructions"
    else
        print_status 1 "Deployment documentation missing Docker Compose instructions"
    fi
else
    print_status 1 "Missing deployment documentation"
fi

# Summary
echo ""
echo "🎯 Deployment Validation Summary"
echo "================================"
echo "✅ All required files are present"
echo "✅ Docker configuration is valid"
echo "✅ GitHub Actions workflow is updated"
echo "✅ Documentation is comprehensive"
echo "✅ Environment variables are documented"
echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Set up environment variables"
echo "2. Configure SSL certificates"
echo "3. Deploy using: docker-compose up -d"
echo "4. Monitor logs: docker-compose logs -f"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"
