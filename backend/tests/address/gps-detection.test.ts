import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { setupTestDB, teardownTestDB, createTestUser } from '../helpers/db';
import { mockGPSLocation, mockReverseGeocode, resetMocks, mockPincodeResolution } from '../helpers/mocks';

const app = createTestApp();

describe('Address Management - GPS Detection', () => {
  let authToken: string;
  let userId: string;
  let mocks: ReturnType<typeof mockPincodeResolution>;

  beforeAll(async () => {
    await setupTestDB();
    // Seed test pincodes for GPS detection tests
    await (global as any).seedTestPincodes();
    // Set up mocks and store references
    mocks = mockPincodeResolution();
  });

  afterAll(async () => {
    await teardownTestDB();
    resetMocks(); // Reset service registry after all tests
  });

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    authToken = user.token;
    // Clear mock call history before each test
    mocks.validatePincodeMock.mockClear();
    mocks.resolvePincodeMock.mockClear();
  });

  describe('[P0] GPS Detection Success Flow', () => {
    test('GPS detection with valid deliverable pincode', async () => {
      // Arrange
      const gpsLocation = mockGPSLocation({
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 30,
      });

      const geocodeResult = mockReverseGeocode({
        postalCode: '560001',
        city: 'Bangalore',
        state: 'Karnataka',
        area: 'MG Road',
      });

      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'John Doe',
          phone: '9876543210',
          addressLine: `${geocodeResult.name}, ${geocodeResult.area}`, // Combined house + area
          pincode: geocodeResult.postalCode,
          city: geocodeResult.city,
          state: geocodeResult.state,
          label: 'HOME',
          validationSource: 'gps',
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.address).toBeDefined();
      expect(response.body.address.pincode).toBe('560001');
      expect(response.body.address.validationSource).toBe('gps');
    });

    test('GPS detection sets validation source to "gps"', async () => {
      // Arrange
      const addressData = {
        name: 'Jane Doe',
        phone: '9876543211',
        addressLine: '123, Koramangala',
        pincode: '560034',
        city: 'Bangalore',
        state: 'Karnataka',
        label: 'HOME',
        validationSource: 'gps',
      };

      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(addressData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.address.validationSource).toBe('gps');
    });

    test('GPS pincode validated exactly once', async () => {
      // Arrange
      const addressData = {
        name: 'Test User',
        phone: '9876543212',
        addressLine: '456, Indiranagar',
        pincode: '560038',
        city: 'Bangalore',
        state: 'Karnataka',
        label: 'HOME',
        validationSource: 'gps',
      };

      // Act
      await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(addressData);

      // Assert - use the mock from service registry
      expect(mocks.validatePincodeMock).toHaveBeenCalledTimes(1);
      expect(mocks.validatePincodeMock).toHaveBeenCalledWith('560038');
    });
  });

  describe('[P0] GPS Detection with High Accuracy', () => {
    test('GPS accuracy <50m accepted without warning', async () => {
      // Arrange
      const gpsLocation = mockGPSLocation({
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 30,
      });

      // Act - accuracy check happens client-side, but we verify backend accepts it
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          phone: '9876543213',
          addressLine: '789, Whitefield',
          pincode: '560066',
          city: 'Bangalore',
          state: 'Karnataka',
          label: 'HOME',
          gpsAccuracy: 30,
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.address.gpsAccuracy).toBe(30);
    });

    test('GPS accuracy 50-100m accepted with warning flag', async () => {
      // Arrange & Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          phone: '9876543214',
          addressLine: '101, Electronic City',
          pincode: '560100',
          city: 'Bangalore',
          state: 'Karnataka',
          label: 'HOME',
          gpsAccuracy: 75,
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.address.gpsAccuracy).toBe(75);
      expect(response.body.warnings).toContain('low_gps_accuracy');
    });
  });

  describe('[P1] GPS Detection Edge Cases', () => {
    test('GPS detection with partial address data', async () => {
      // Arrange - geocoding returns only city and state, no area
      const partialData = {
        name: 'Test User',
        phone: '9876543215',
        addressLine: '202', // Minimal address
        pincode: '560001',
        city: 'Bangalore',
        state: 'Karnataka',
        label: 'HOME',
        validationSource: 'gps',
      };

      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.address.city).toBe('Bangalore');
      expect(response.body.address.state).toBe('Karnataka');
      expect(response.body.address.addressLine).toBe('202'); // Minimal but accepted
    });

    test('GPS detection outside India bounds rejected', async () => {
      // Arrange - coordinates outside India
      const outsideIndiaData = {
        name: 'Test User',
        phone: '9876543216',
        addressLine: '303, Test Area',
        pincode: '000000',
        city: 'Test City',
        state: 'Test State',
        label: 'HOME',
        lat: 51.5074, // London
        lng: -0.1278,
      };

      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(outsideIndiaData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid pincode');
    });

    test('GPS detection with empty postal code', async () => {
      // Arrange
      const noPostalCodeData = {
        name: 'Test User',
        phone: '9876543217',
        addressLine: '404, Test Area',
        pincode: '', // Empty pincode from geocoding
        city: 'Bangalore',
        state: 'Karnataka',
        label: 'HOME',
        validationSource: 'gps',
      };

      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noPostalCodeData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid pincode');
    });
  });

  describe('[P0] GPS Detection Failure Scenarios', () => {
    test('GPS permission denied handled gracefully', async () => {
      // This is primarily a client-side test, but we verify backend doesn't break
      // when user falls back to manual entry after GPS denial
      
      const manualData = {
        name: 'Test User',
        phone: '9876543218',
        addressLine: '505, Manual Area',
        pincode: '560001',
        city: 'Bangalore',
        state: 'Karnataka',
        label: 'HOME',
        validationSource: 'manual', // User fell back to manual
      };

      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(manualData);

      expect(response.status).toBe(201);
      expect(response.body.address.validationSource).toBe('manual');
    });

    test('Reverse geocoding timeout handled', async () => {
      // Simulate timeout by not providing geocoded data
      const timeoutData = {
        name: 'Test User',
        phone: '9876543219',
        addressLine: '560001, Bangalore', // User entered manually after timeout
        pincode: '560001', // User entered manually after timeout
        city: 'Bangalore',
        state: 'Karnataka',
        label: 'HOME',
        validationSource: 'manual',
      };

      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(timeoutData);

      expect(response.status).toBe(201);
    });
  });
});
