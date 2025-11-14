# CS Store - Testing Documentation

## Overview

This document outlines the comprehensive testing strategy for the CS Store e-commerce platform, including unit tests, integration tests, E2E tests, and CI/CD pipeline.

## Testing Strategy

### 1. Unit Tests (Backend)

- **Framework**: Jest + Supertest
- **Coverage**: Critical controllers and business logic
- **Location**: `backend/src/__tests__/`

#### Test Coverage

- ✅ Auth Controller (signup, login, refresh, logout)
- ✅ Admin Controller (analytics, CSV export)
- ✅ Delivery Controller (CRUD, assignment, status updates)
- ✅ Product Controller (CRUD operations)
- ✅ Order Controller (creation, status updates)

#### Running Backend Tests

```bash
cd backend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
npm run test:ci           # CI mode
```

### 2. E2E Tests (Frontend)

- **Framework**: Playwright
- **Coverage**: Complete user journeys
- **Location**: `frontend/tests/`

#### Test Scenarios

- ✅ User signup → add to cart → checkout → order tracking
- ✅ Minimum order validation
- ✅ Product search and filtering
- ✅ Profile management
- ✅ Admin dashboard access
- ✅ Delivery boy operations

#### Running E2E Tests

```bash
cd frontend
npm test                    # Run all E2E tests
npm run test:ui            # Interactive UI mode
npm run test:headed        # Run with browser visible
npm run test:debug         # Debug mode
npm run test:report        # View test report
```

### 3. Performance & Accessibility Tests

- **Framework**: Lighthouse
- **Coverage**: Performance, accessibility, best practices
- **Location**: `frontend/lighthouse-audit.js`

#### Running Lighthouse Audit

```bash
cd frontend
npm run audit:lighthouse
npm run audit:accessibility
```

## Test Data Management

### Global Setup

- **File**: `frontend/tests/global-setup.ts`
- **Purpose**: Create test users, products, and initial data
- **Users**: Customer, Admin, Delivery Boy
- **Products**: Test products with different categories
- **Orders**: Sample orders for testing

### Global Teardown

- **File**: `frontend/tests/global-teardown.ts`
- **Purpose**: Clean up test data after tests
- **Actions**: Delete test users, orders, products

## CI/CD Pipeline

### GitHub Actions Workflow

- **File**: `.github/workflows/ci.yml`
- **Triggers**: Push to main/develop, PRs

#### Pipeline Stages

1. **Backend Tests**

   - Linting
   - Unit tests with coverage
   - MongoDB service

2. **Frontend Tests**

   - Linting
   - Build verification
   - Playwright tests

3. **E2E Tests**

   - Full application testing
   - Backend + Frontend integration
   - Cross-browser testing

4. **Lighthouse Audit**

   - Performance scoring
   - Accessibility compliance
   - Best practices validation

5. **Security Audit**

   - Dependency vulnerability scan
   - Outdated package check

6. **Build & Deploy**
   - Production build
   - Artifact creation
   - Deployment preparation

## Test Environments

### Development

- **Backend**: `http://localhost:5000`
- **Frontend**: `http://localhost:5173`
- **Database**: MongoDB (in-memory for tests)

### CI/CD

- **OS**: Ubuntu Latest
- **Node**: v18
- **Services**: MongoDB 7.0
- **Browsers**: Chromium, Firefox, WebKit

## Test Configuration

### Jest Configuration (Backend)

```javascript
// backend/jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  collectCoverageFrom: ["src/**/*.ts"],
  coverageDirectory: "coverage",
  testTimeout: 10000,
};
```

### Playwright Configuration (Frontend)

```typescript
// frontend/playwright.config.ts
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html"], ["json"], ["junit"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
```

## Test Data Requirements

### User Accounts

- **Customer**: `test@example.com` / `password123`
- **Admin**: `admin@cpsstore.com` / `admin123`
- **Delivery**: `driver@cpsstore.com` / `driver123`

### Test Products

- **Electronics**: ₹1500 (sufficient for minimum order)
- **Clothing**: ₹800
- **Home**: ₹1200

### Test Addresses

- **Valid Pincodes**: 500001 (Hyderabad), 500002 (Hyderabad)
- **Invalid Pincodes**: 12345 (Outside AP/TS)

## Quality Gates

### Unit Test Requirements

- ✅ Coverage: >80%
- ✅ All critical paths tested
- ✅ Error scenarios covered
- ✅ Mock external dependencies

### E2E Test Requirements

- ✅ Complete user journeys
- ✅ Cross-browser compatibility
- ✅ Mobile responsiveness
- ✅ Performance benchmarks

### Lighthouse Requirements

- ✅ Performance: ≥80
- ✅ Accessibility: ≤5 issues
- ✅ Best Practices: ≥90
- ✅ SEO: ≥80

## Debugging Tests

### Backend Debugging

```bash
cd backend
npm run test:watch -- --verbose
```

### Frontend Debugging

```bash
cd frontend
npm run test:debug
# Opens browser with DevTools
```

### E2E Debugging

```bash
cd frontend
npx playwright test --debug --headed
```

## Test Reports

### Coverage Reports

- **Backend**: `backend/coverage/lcov-report/index.html`
- **Frontend**: `frontend/playwright-report/index.html`

### Lighthouse Reports

- **File**: `frontend/lighthouse-report.json`
- **Metrics**: Performance, Accessibility, Best Practices

### CI Reports

- **Artifacts**: Available in GitHub Actions
- **Retention**: 30 days
- **Access**: GitHub Actions → Artifacts

## Best Practices

### Test Writing

1. **Arrange-Act-Assert** pattern
2. **Descriptive test names**
3. **Independent tests**
4. **Proper cleanup**
5. **Mock external dependencies**

### Test Data

1. **Isolated test data**
2. **Realistic scenarios**
3. **Edge case coverage**
4. **Performance considerations**

### CI/CD

1. **Fast feedback loops**
2. **Parallel execution**
3. **Artifact management**
4. **Security scanning**

## Troubleshooting

### Common Issues

1. **MongoDB connection**: Ensure MongoDB is running
2. **Port conflicts**: Check for port 5000, 5173 availability
3. **Browser issues**: Run `npx playwright install`
4. **Timeout issues**: Increase test timeout values

### Debug Commands

```bash
# Check backend health
curl http://localhost:5000/health

# Check frontend
curl http://localhost:5173

# Run specific test
npm test -- --grep "specific test name"

# Debug Playwright
npx playwright test --debug --headed
```

## Metrics & Monitoring

### Test Metrics

- **Unit Test Coverage**: >80%
- **E2E Test Pass Rate**: >95%
- **Performance Score**: >80
- **Accessibility Issues**: <5

### Monitoring

- **CI/CD Status**: GitHub Actions
- **Test Results**: Artifacts
- **Coverage Reports**: Codecov
- **Performance**: Lighthouse CI

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**
2. **API Contract Testing**
3. **Load Testing**
4. **Security Testing**
5. **Mobile App Testing**

### Test Automation

1. **Scheduled test runs**
2. **Performance monitoring**
3. **Alert systems**
4. **Test data management**

---

## Quick Start

### Run All Tests

```bash
# Backend tests
cd backend && npm test

# Frontend E2E tests
cd frontend && npm test

# Lighthouse audit
cd frontend && npm run audit:lighthouse
```

### CI/CD Pipeline

- Push to `main` or `develop` branch
- GitHub Actions will run automatically
- Check Actions tab for results
- Download artifacts for detailed reports

### Local Development

```bash
# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev

# Run tests in watch mode
cd backend && npm run test:watch
cd frontend && npm run test:ui
```
