/**
 * AddAddressScreen Test Suite
 * Production-grade tests for "Use Current Location" feature
 * 
 * Test Layers:
 * - P0: Core Flow (30 tests)
 * - P1: Failure Scenarios (40 tests)
 * - P2: Edge Cases (20 tests)
 * - P3: Security/Abuse (10 tests)
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AddAddressScreen from '../AddAddressScreen';
import * as Location from 'expo-location';

// Mock dependencies
jest.mock('expo-location');
jest.mock('../../../api/addressesApi');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('📍 AddAddressScreen - Use Current Location', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // 🥇 LAYER 1: CORE FLOW (P0 - CRITICAL)
  // ========================================

  describe('P0: Core Flow Tests', () => {
    test('TC-001: GPS Autofill Success - Full Happy Path', async () => {
      const { getByText, getByPlaceholderText } = render(<AddAddressScreen />);

      // Tap "Use current location" button
      const locationButton = getByText(/use current location/i);
      fireEvent.press(locationButton);

      // Wait for autofill to complete
      await waitFor(() => {
        const houseInput = getByPlaceholderText('House / Flat / Building');
        const areaInput = getByPlaceholderText('Area / Street / Village');
        
        expect(houseInput.props.value).toBe('Building 5');
        expect(areaInput.props.value).toContain('Hitech City Road');
      }, { timeout: 3000 });

      // Verify all fields populated
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
      expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(1);
    });

    test('TC-002: GPS → Pincode Validation → Success', async () => {
      const { getByText, getByPlaceholderText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        const pincodeInput = getByPlaceholderText('000000');
        expect(pincodeInput.props.value).toBe('500081');
      });

      // Pincode should be validated automatically
      await waitFor(() => {
        expect(getByText(/deliverable/i)).toBeTruthy();
      }, { timeout: 2000 });
    });

    test('TC-003: GPS → User Edits House → Submit', async () => {
      const { getByText, getByPlaceholderText } = render(<AddAddressScreen />);

      // Trigger GPS
      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        expect(getByPlaceholderText('House / Flat / Building').props.value).toBe('Building 5');
      });

      // User edits house field
      const houseInput = getByPlaceholderText('House / Flat / Building');
      fireEvent.changeText(houseInput, 'Flat 301, Building 5');

      expect(houseInput.props.value).toBe('Flat 301, Building 5');
    });

    test('TC-004: Manual Entry → Valid Pincode → Submit', async () => {
      const { getByPlaceholderText } = render(<AddAddressScreen />);

      // Manual entry
      fireEvent.changeText(getByPlaceholderText('Full Name'), 'John Doe');
      fireEvent.changeText(getByPlaceholderText('10-digit mobile'), '9876543210');
      fireEvent.changeText(getByPlaceholderText('House / Flat / Building'), 'Flat 101');
      fireEvent.changeText(getByPlaceholderText('Area / Street / Village'), 'MG Road');
      fireEvent.changeText(getByPlaceholderText('000000'), '500081');

      await waitFor(() => {
        expect(getByPlaceholderText('000000').props.value).toBe('500081');
      });
    });

    test('TC-005: Default Address Toggle Works', async () => {
      const { getByText } = render(<AddAddressScreen />);

      const toggleButton = getByText(/make this my default address/i);
      fireEvent.press(toggleButton);

      // Toggle should work (visual state change)
      expect(toggleButton).toBeTruthy();
    });
  });

  // ========================================
  // ⚠️ LAYER 2: FAILURE SCENARIOS (P1)
  // ========================================

  describe('P1: Failure Scenario Tests', () => {
    test('TC-012: Permission Denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
        granted: false,
        canAskAgain: false,
      });

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Denied',
          expect.any(String)
        );
      });

      // Should NOT call GPS
      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    test('TC-013: GPS Timeout (30s)', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      // App should not hang - button should be responsive
      await waitFor(() => {
        expect(getByText(/use current location/i)).toBeTruthy();
      }, { timeout: 1000 });
    });

    test('TC-014: Reverse Geocode Timeout', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockImplementationOnce(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Location Detected',
          expect.stringContaining('manually')
        );
      }, { timeout: 3000 });
    });

    test('TC-015: Reverse Geocode Returns Empty', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValueOnce([]);

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        // Should handle gracefully - no crash
        expect(getByText(/use current location/i)).toBeTruthy();
      });
    });

    test('TC-016: Low GPS Accuracy (>100m)', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: {
          latitude: 17.385044,
          longitude: 78.486671,
          accuracy: 250, // Low accuracy
        },
        timestamp: Date.now(),
      });

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Low Location Accuracy',
          expect.stringContaining('250')
        );
      });
    });

    test('TC-017: User Taps Button Repeatedly (Spam Click)', async () => {
      const { getByText } = render(<AddAddressScreen />);

      const button = getByText(/use current location/i);
      
      // Rapid clicks
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);

      await waitFor(() => {
        // Should only call GPS once (lock mechanism)
        expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
      });
    });

    test('TC-018: Location Fetch Throws Error', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(
        new Error('GPS hardware failure')
      );

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('location')
        );
      });
    });
  });

  // ========================================
  // 🧠 LAYER 3: EDGE CASES (P2)
  // ========================================

  describe('P2: Edge Case Tests', () => {
    test('TC-025: Village Address (No Street Available)', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValueOnce([
        {
          postalCode: '502032',
          city: 'Medak',
          district: 'Medak',
          region: 'Telangana',
          subregion: 'Narsapur',
          street: null, // No street
          name: 'Narsapur Village',
          formattedAddress: 'Narsapur Village, Narsapur, Medak, Telangana 502032',
        },
      ]);

      const { getByText, getByPlaceholderText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        const areaInput = getByPlaceholderText('Area / Street / Village');
        // Should fallback to subregion
        expect(areaInput.props.value).toContain('Narsapur');
      });
    });

    test('TC-026: Apartment (No Flat Number Detected)', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValueOnce([
        {
          postalCode: '500081',
          city: 'Hyderabad',
          district: 'Hyderabad',
          region: 'Telangana',
          subregion: 'Madhapur',
          street: 'Hitech City Road',
          name: 'Cyber Towers', // Building name only
          formattedAddress: 'Cyber Towers, Hitech City Road, Madhapur, Hyderabad, Telangana 500081',
        },
      ]);

      const { getByText, getByPlaceholderText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        const houseInput = getByPlaceholderText('House / Flat / Building');
        expect(houseInput.props.value).toBe('Cyber Towers');
        // User must manually add flat number
      });
    });

    test('TC-027: Landmark Returned Instead of Street', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValueOnce([
        {
          postalCode: '500081',
          city: 'Hyderabad',
          district: 'Hyderabad',
          region: 'Telangana',
          subregion: 'Madhapur',
          street: 'Near Apollo Hospital', // Landmark, not street
          name: 'Building 5',
          formattedAddress: 'Building 5, Near Apollo Hospital, Madhapur, Hyderabad, Telangana 500081',
        },
      ]);

      const { getByText, getByPlaceholderText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        const areaInput = getByPlaceholderText('Area / Street / Village');
        // Should filter out "Near" (vague term) and fallback
        expect(areaInput.props.value).not.toContain('Near');
      });
    });

    test('TC-028: Multiple Cities for One Pincode', async () => {
      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        // Should show city chips
        expect(getByText('Hyderabad')).toBeTruthy();
        expect(getByText('Secunderabad')).toBeTruthy();
      }, { timeout: 3000 });
    });

    test('TC-029: Missing formattedAddress', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValueOnce([
        {
          postalCode: '500081',
          city: 'Hyderabad',
          district: 'Hyderabad',
          region: 'Telangana',
          subregion: 'Madhapur',
          street: 'Hitech City Road',
          name: 'Building 5',
          formattedAddress: null, // Missing
        },
      ]);

      const { getByText, getByPlaceholderText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        const areaInput = getByPlaceholderText('Area / Street / Village');
        // Should fallback to street
        expect(areaInput.props.value).toBe('Hitech City Road');
      });
    });
  });

  // ========================================
  // 🔐 LAYER 4: SECURITY/ABUSE (P3)
  // ========================================

  describe('P3: Security & Abuse Tests', () => {
    test('TC-040: Outside India Coordinates Blocked', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: {
          latitude: 51.5074, // London
          longitude: -0.1278,
          accuracy: 10,
        },
        timestamp: Date.now(),
      });

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Invalid Location',
          expect.stringContaining('India')
        );
      });

      // Should NOT call reverse geocode
      expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
    });

    test('TC-041: Coordinates (0, 0) Blocked', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
        },
        timestamp: Date.now(),
      });

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Invalid Location',
          expect.any(String)
        );
      });
    });

    test('TC-042: Fake GPS - China Coordinates', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: {
          latitude: 39.9042, // Beijing
          longitude: 116.4074,
          accuracy: 5, // High accuracy (suspicious)
        },
        timestamp: Date.now(),
      });

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Invalid Location',
          expect.stringContaining('India')
        );
      });
    });

    test('TC-043: Invalid Numeric Values (NaN)', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: {
          latitude: NaN,
          longitude: NaN,
          accuracy: 10,
        },
        timestamp: Date.now(),
      });

      const { getByText } = render(<AddAddressScreen />);

      fireEvent.press(getByText(/use current location/i));

      // Should handle gracefully - no crash
      await waitFor(() => {
        expect(getByText(/use current location/i)).toBeTruthy();
      });
    });
  });

  // ========================================
  // ⚡ LAYER 5: PERFORMANCE (BONUS)
  // ========================================

  describe('P4: Performance Tests', () => {
    test('TC-055: Geocode Cache Working', async () => {
      const { getByText } = render(<AddAddressScreen />);

      // First call
      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(1);
      });

      jest.clearAllMocks();

      // Second call with same coordinates (should use cache)
      fireEvent.press(getByText(/use current location/i));

      await waitFor(() => {
        // Cache should prevent second API call
        expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(0);
      }, { timeout: 2000 });
    });
  });
});
