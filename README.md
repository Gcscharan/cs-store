# CS Store - E-commerce Platform

A production-grade e-commerce application built for Andhra Pradesh and Telangana, featuring real-time order tracking, delivery management, and comprehensive analytics.

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Git
- 4GB RAM minimum

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd cps-store

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

## 📋 Features

### Customer Features

- User registration and authentication
- Product browsing and search
- Shopping cart and checkout
- Real-time order tracking
- Multiple address management
- Payment integration (Razorpay)

### Admin Features

- Dashboard with analytics
- Order management
- Product management
- Delivery boy management
- CSV export functionality
- Real-time delivery tracking

### Delivery Features

- Delivery boy dashboard
- Order assignment
- Real-time location tracking
- Status updates
- Earnings tracking
- QR code payment collection
- Silent background payment monitoring
- Automatic order completion on payment

## 🏗️ Architecture

### Tech Stack

**Frontend:**

- React 19 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Redux Toolkit for state management
- Socket.io for real-time communication
- Google Maps API for location services

**Backend:**

- Node.js with Express
- TypeScript
- MongoDB with Mongoose
- Socket.io for real-time communication
- JWT authentication
- Razorpay payment integration
- Cloudinary for image storage

**DevOps:**

- Docker containerization
- Docker Compose for orchestration
- GitHub Actions CI/CD
- Nginx reverse proxy
- SSL/TLS support

### Database Schema

- **Users**: Customer, admin, and delivery boy accounts
- **Products**: Product catalog with categories and inventory
- **Orders**: Order management with status tracking
- **DeliveryBoys**: Delivery personnel management
- **Pincodes**: Service area validation

## 🔧 Development

### Environment Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd cps-store
   ```

2. **Configure environment variables**

   ```bash
   # Copy environment templates
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```

3. **Start development environment**
   ```bash
   docker-compose up -d
   ```

### Available Scripts

**Backend:**

```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
```

**Frontend:**

```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run E2E tests
npm run test:ui      # Run tests in UI mode
npm run lint         # Run ESLint
```

## 🐳 Docker Deployment

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production

```bash
# Deploy with production configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify services
docker-compose ps
```

## 🔐 Environment Variables

### Backend (.env)

```bash
# Database
MONGODB_URI=mongodb://admin:password123@mongodb:27017/cps_store?authSource=admin
REDIS_URL=redis://redis:6379

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Payment Gateway
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Image Storage
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Frontend (.env)

```bash
# API Configuration
VITE_API_URL=http://localhost:5000

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Razorpay
VITE_RAZORPAY_KEY_ID=your-razorpay-key-id
```

## 🧪 Testing

### Unit Tests (Backend)

```bash
cd backend
npm test
npm run test:coverage
```

### E2E Tests (Frontend)

```bash
cd frontend
npm test
npm run test:ui
```

### Lighthouse Audit

```bash
cd frontend
npm run audit:lighthouse
```

## 📊 Monitoring

### Health Checks

```bash
# Application health
curl http://localhost/health

# Individual services
curl http://localhost:5000/health
curl http://localhost:5173
```

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 🔒 Security

### SSL Configuration

1. **Generate SSL certificates**

   ```bash
   mkdir -p nginx/ssl
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout nginx/ssl/key.pem \
     -out nginx/ssl/cert.pem
   ```

2. **Use Let's Encrypt (Production)**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

### Security Headers

- Strict-Transport-Security
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Content-Security-Policy

## 📈 Performance

### Optimization Features

- Gzip compression
- Static file caching
- Database indexing
- Redis caching
- CDN integration (Cloudinary)

### Monitoring

- Health check endpoints
- Log aggregation
- Performance metrics
- Error tracking

## 🚀 Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database backups configured
- [ ] Monitoring setup
- [ ] Security headers enabled
- [ ] Performance optimization
- [ ] Error handling
- [ ] Logging configuration

### Deployment Commands

```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify deployment
docker-compose ps
curl http://localhost/health
```

## 📚 Documentation

- [API Documentation](docs/API.md)
- [Database Schema](docs/DATABASE.md)
- [Testing Guide](TESTING.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Contributing Guide](CONTRIBUTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Contact the development team

## 🔄 CI/CD Pipeline

The project includes a comprehensive CI/CD pipeline with:

- Automated testing
- Code quality checks
- Security scanning
- Performance audits
- Docker builds
- Deployment automation

### Pipeline Stages

1. **Code Quality**: ESLint, TypeScript checks
2. **Testing**: Unit tests, E2E tests
3. **Security**: Dependency scanning, vulnerability checks
4. **Performance**: Lighthouse audits
5. **Build**: Docker image creation
6. **Deploy**: Automated deployment

## 📊 Metrics

### Test Coverage

- Backend: >80%
- Frontend: >80%

### Performance

- Lighthouse Score: >80
- Accessibility: <5 issues
- Best Practices: >80

### Security

- Dependency vulnerabilities: 0
- Security headers: Enabled
- SSL/TLS: Configured

## 🎯 Business Rules

- **Minimum Order Value**: ₹2000
- **Service Area**: Andhra Pradesh & Telangana pincodes
- **Delivery Assignment**: Nearest driver + workload balance
- **Payment**: Razorpay integration
- **Real-time Tracking**: Socket.io implementation

## 🔧 Troubleshooting

### Common Issues

1. **Port conflicts**: Check for port 5000, 5173 availability
2. **Database connection**: Verify MongoDB is running
3. **Environment variables**: Ensure all required variables are set
4. **SSL certificates**: Check certificate validity

### Debug Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Test connectivity
curl http://localhost:5000/health
curl http://localhost:5173
```

## 📈 Roadmap

- [ ] Mobile app development
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] Inventory management
- [ ] Supplier integration
- [ ] Advanced reporting

## 🎨 Recent UI Improvements

### Delivery Dashboard Enhancements (Nov 2025)

**Silent Payment Monitoring**
- Removed visual payment monitoring indicators from delivery partner UI
- Payment status now tracked silently in the background
- Clean, distraction-free interface for delivery partners
- Backend monitoring logic continues running every 3 seconds
- Automatic order completion when payment detected

**Changes Made:**
- `EnhancedHomeTab.tsx`: Removed "Monitoring Payment Status..." status box
- `PaymentQRModal.tsx`: Removed payment status indicators from QR modal
- Complete Delivery button remains disabled until payment received
- No visual loaders or monitoring spinners displayed
- Toast notifications still trigger on successful payment

**Technical Details:**
- Backend monitoring: `useEffect` hooks poll payment status every 3 seconds
- Auto-completion: Orders automatically complete when COD payment detected
- State management: Payment monitoring state maintained but not displayed
- User experience: Cleaner UI without compromising functionality

## 🏆 Achievements

- ✅ Production-ready deployment
- ✅ Comprehensive testing
- ✅ Security implementation
- ✅ Performance optimization
- ✅ CI/CD pipeline
- ✅ Documentation
- ✅ Monitoring setup
- ✅ Silent payment monitoring system
