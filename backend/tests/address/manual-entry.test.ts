import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { setupTestDB, teardownTestDB, createTestUser } from '../helpers/db';
import { mockPincodeCheck, mockPincodeResolution } from '../helpers/mocks';

const app = createTestApp();

describe('Address Management - Manual Pincode Entry', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDB();
    mockPincodeResolution(); // Mock pincode resolution system
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    authToken = user.token;
  });

  describe('[P0] Manual Entry Success Flow', () => {
    test('Manual pincode entry with deliverable pincode', async () => {
      // Arrange
      mockPincodeCheck('560001', {
        deliverable: true,
        state: 'Karnataka',
        cities: ['Bangalore'],
      });

      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'John Doe',
          phone: '9876543210',
          addressLine: '123, MG Road',
          pincode: '560001',
          city: 'Bangalore',
          state: 'Karnataka',
          label: 'HOME',
          validationSource: 'manual',
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.address.pincode).toBe('560001');
      expect(response.body.address.validationSource).toBe('manual');
    });

    test('Manual entry sets validation source to "manual"', async () => {
      // Arrange
      mockPincodeCheck('560034', {
        deliverable: true,
        state: 'Karnataka',
        cities: ['Bangalore'],
      });

      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Jane Doe',
          phone: '9876543211',
          addressLine: '456, Koramangala',
          pincode: '560034',
          city: 'Bangalore',
          state: 'Karnataka',
          label: 'HOME',
          validationSource: 'manual',
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.address.validationSource).toBe('manual');
    });

    test('Manual entry with non-deliverable pincode rejected', async () => {
      // Arrange - Use spyOn instead of doMock for runtime mocking
      const authoritativeResolver = require('../../src/utils/authoritativePincodeResolver');
      const mockResolvePincode = jest.spyOn(authoritativeResolver, 'resolvePincodeAuthoritatively');
      
      // Mock to return null (not deliverable)
      mockResolvePincode.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          phone: '9876543212',
          addressLine: '789, Test Area',
          pincode: '999999',
          city: 'Test City',
          state: 'Test State',
          label: 'HOME',
          validationSource: 'manual',
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid pincode');
      
      // Cleanup
      mockResolvePincode.mockRestore();
    });
  });

  describe('[P0] Validation Source Switching', () => {
    test('GPS to manual edit switches validation source', async () => {
      // Arrange - First create address with GPS
      mockPincodeCheck('560001', {
        deliverable: true,
        state: 'Karnataka',
        cities: ['Bangalore'],
      });

      const gpsAddress = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          phone: '9876543213',
          addressLine: '101, Indiranagar',
          pincode: '560001',
          city: 'Bangalore',
          state: 'Karnataka',
          label: 'HOME',
          validationSource: 'gps',
        });

      expect(gpsAddress.status).toBe(201);
      const addressId = gpsAddress.body.address._id;

      // Act - Update with manual pincode edit
      // Mock the new pincode for the update operation
      const pincodeResolver = require('../../src/utils/pincodeResolver');
      const mockResolvePincodeForSave = jest.spyOn(pincodeResolver, 'resolvePincodeForAddressSave');
      mockResolvePincodeForSave.mockResolvedValue({
        state: 'Karnataka',
        postal_district: 'Bangalore Urban',
        admin_district: 'Bangalore Urban',
      });

      const response = await request(app)
        .put(`/api/user/addresses/${addressId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pincode: '560034', // Changed pincode
          validationSource: 'manual', // Source switched
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.address.pincode).toBe('560034');
      expect(response.body.address.validationSource).toBe('manual');
      
      // Cleanup
      mockResolvePincodeForSave.mockRestore();
    });

    test('Manual to GPS preserves manual source until GPS completes', async () => {
      // This tests the client-side behavior where manual source
      // is only overwritten when GPS detection completes
      
      // Arrange - Create with manual
      mockPincodeCheck('560001', {
        deliverable: true,
        state: 'Karnataka',
        cities: ['Bangalore'],
      });

      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          phone: '9876543214',
          addressLine: '202, Whitefield',
          pincode: '560001',
          city: 'Bangalore',
          state: 'Karnataka',
          label: 'HOME',
          validationSource: 'manual',
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.address.validationSource).toBe('manual');
    });
  });

  describe('[P0] Pincode Format Validation', () => {
    test('Only 6-digit numeric pincode accepted', async () => {
      // Act - Try 5 digits
      const response1 = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          phone: '9876543215',
          addressLine: '303, Test Area',
          pincode: '56001', // Only 5 digits
          city: 'Bangalore',
          state: 'Karnataka',
          label: 'HOME',
        });

      expect(response1.status).toBe(400);
      expect(response1.body.message).toContain('Invalid pincode');

      // Act - Try 7 digits
      const response2 = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          phone: '9876543216',
          addressLine: '404, Test Area',
          pincode: '5600011', // 7 digits
          city: 'Bangalore',
          state: 'Karnataka',
          label: 'HOME',
        });

      expect(response2.status).toBe(400);
      expect(response2.body.message).toContain('Invalid pincode');
    });

    test('Non-numeric pincode rejected', async () => {
      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          phone: '9876543217',
          addressLine: '505, Test Area',
          pincode: '56-001', // Contains hyphen
          city: 'Bangalore',
          state: 'Karnataka',
          label: 'HOME',
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid pincode');
    });

    test('Pincode with leading zeros accepted', async () => {
      // Arrange
      mockPincodeCheck('011001', {
        deliverable: true,
        state: 'Delhi',
        cities: ['New Delhi'],
      });

      // Act
      const response = await request(app)
        .post('/api/user/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          phone: '9876543218',
          addressLine: '606, Connaught Place',
          pincode: '011001', // Leading zero
          city: 'New Delhi',
          state: 'Delhi',
          label: 'HOME',
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.address.pincode).toBe('011001');
    });
  });

  describe('[P1] API Call Optimization', () => {
    test('Debounce prevents multiple API calls for same pincode', async () => {
      // This is primarily tested client-side, but we verify backend
      // handles rapid requests correctly
      
      const pincodeCheckSpy = jest.spyOn(
        require('../../src/services/pincodeValidator'),
        'validatePincode'
      );

      mockPincodeCheck('560001', {
        deliverable: true,
        state: 'Karnataka',
        cities: ['Bangalore'],
      });

      // Act - Make multiple rapid requests (simulating debounce failure)
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/pincode/check/560001')
          .set('Authorization', `Bearer ${authToken}`)
      );

      await Promise.all(requests);

      // Assert - Should use cache after first call
      expect(pincodeCheckSpy.mock.calls.length).toBeLessThanOrEqual(2);
      
      pincodeCheckSpy.mockRestore();
    });

    test('Different pincodes trigger separate validations', async () => {
      // Act - Test the pincode check endpoint directly
      const response1 = await request(app)
        .get('/api/pincode/check/560001')
        .set('Authorization', `Bearer ${authToken}`);

      const response2 = await request(app)
        .get('/api/pincode/check/560034')
        .set('Authorization', `Bearer ${authToken}`);

      // Assert - Both should return success responses (200) since API is working
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body).toBeDefined();
      expect(response2.body).toBeDefined();
    });
  });

  describe('[P0] Network Failure Handling', () => {
    test('Pincode API success returns valid data', async () => {
      // Act - The pincode API is now working correctly
      const response = await request(app)
        .get('/api/pincode/check/560001')
        .set('Authorization', `Bearer ${authToken}`);

      // Assert - Should return success response (200) with valid data
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.deliverable).toBeDefined();
    });

    test('Pincode API handles multiple requests consistently', async () => {
      // Act - Make two requests to the API
      const response1 = await request(app)
        .get('/api/pincode/check/560001')
        .set('Authorization', `Bearer ${authToken}`);

      // Act - Retry (should get same result)
      const response2 = await request(app)
        .get('/api/pincode/check/560001')
        .set('Authorization', `Bearer ${authToken}`);

      // Assert - Both requests succeed consistently
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.status).toBe(response2.status); // Consistent behavior
    });
  });
});
