# CS Store Deployment Guide

This guide covers deploying the CS Store application using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [SSL Configuration](#ssl-configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Git
- 4GB RAM minimum
- 20GB disk space

## Environment Variables

### Backend Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
MONGODB_URI=mongodb://admin:password123@mongodb:27017/cps_store?authSource=admin
REDIS_URL=redis://redis:6379

# JWT Secrets (Generate strong secrets)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Cloudinary Image Storage
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Google Maps API
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Server Configuration
NODE_ENV=production
PORT=5000
```

### Frontend Environment Variables

Create a `.env` file in the frontend directory:

```bash
# API Configuration
VITE_API_URL=http://localhost:5000

# Google Maps API
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Razorpay Configuration
VITE_RAZORPAY_KEY_ID=your-razorpay-key-id

# OAuth (Optional)
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_FACEBOOK_APP_ID=your-facebook-app-id
```

## Local Development

### 1. Clone the Repository

```bash
git clone <repository-url>
cd cps-store
```

### 2. Start Development Environment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 3. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

### 4. Development Commands

```bash
# Rebuild and restart
docker-compose up --build

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Execute commands in containers
docker-compose exec backend npm run test
docker-compose exec frontend npm run test

# Clean up
docker-compose down -v
```

## Production Deployment

### 1. Prepare Production Environment

```bash
# Set production environment
export NODE_ENV=production

# Create production directory
mkdir -p /opt/cps-store
cd /opt/cps-store

# Clone repository
git clone <repository-url> .
```

### 2. Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 3. Generate SSL Certificates

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem

# For production, use Let's Encrypt or commercial certificates
```

### 4. Deploy with Docker Compose

```bash
# Start production services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify services are running
docker-compose ps

# View logs
docker-compose logs -f
```

### 5. Set up Reverse Proxy (Optional)

If using a reverse proxy like Nginx or Traefik:

```bash
# Install Nginx
sudo apt update
sudo apt install nginx

# Copy configuration
sudo cp nginx/nginx.prod.conf /etc/nginx/sites-available/cps-store
sudo ln -s /etc/nginx/sites-available/cps-store /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Configuration

### Using Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Using Commercial Certificates

1. Obtain SSL certificate from your provider
2. Place certificate files in `nginx/ssl/`
3. Update `nginx/nginx.prod.conf` with correct paths

## Monitoring

### Health Checks

```bash
# Check application health
curl http://localhost/health

# Check individual services
curl http://localhost:5000/health
curl http://localhost:5173
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Database Backup

```bash
# Create backup
docker-compose exec mongodb mongodump --out /backups/$(date +%Y%m%d_%H%M%S)

# Restore backup
docker-compose exec mongodb mongorestore /backups/20240101_120000
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Check what's using the port
sudo netstat -tulpn | grep :5000

# Kill the process
sudo kill -9 <PID>
```

#### 2. Database Connection Issues

```bash
# Check MongoDB logs
docker-compose logs mongodb

# Test connection
docker-compose exec mongodb mongosh --eval "db.runCommand({ ping: 1 })"
```

#### 3. Memory Issues

```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.prod.yml
```

#### 4. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Test SSL configuration
openssl s_client -connect yourdomain.com:443
```

### Performance Optimization

#### 1. Database Optimization

```bash
# Create indexes
docker-compose exec mongodb mongosh cps_store --eval "
db.users.createIndex({ email: 1 });
db.products.createIndex({ name: 'text' });
db.orders.createIndex({ userId: 1, createdAt: -1 });
"
```

#### 2. Nginx Optimization

```bash
# Enable gzip compression
# Add to nginx.conf:
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

#### 3. Docker Optimization

```bash
# Use multi-stage builds
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build with cache
docker-compose build --parallel
```

### Security Considerations

1. **Change default passwords**
2. **Use strong JWT secrets**
3. **Enable firewall**
4. **Regular security updates**
5. **Monitor logs for suspicious activity**

### Backup Strategy

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec mongodb mongodump --out /backups/$DATE
tar -czf /backups/cps-store-$DATE.tar.gz /backups/$DATE
rm -rf /backups/$DATE
```

### Scaling

For high-traffic scenarios:

1. **Use multiple backend instances**
2. **Implement load balancing**
3. **Use MongoDB replica sets**
4. **Implement Redis clustering**

## Environment-Specific Configurations

### Development

```bash
# Use development overrides
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

### Staging

```bash
# Use production configuration with staging environment variables
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

### Production

```bash
# Full production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Maintenance

### Regular Tasks

1. **Update dependencies**
2. **Monitor disk space**
3. **Check logs for errors**
4. **Backup database**
5. **Update SSL certificates**

### Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

## Support

For deployment issues:

1. Check logs: `docker-compose logs -f`
2. Verify environment variables
3. Check network connectivity
4. Review security settings
5. Contact support team
