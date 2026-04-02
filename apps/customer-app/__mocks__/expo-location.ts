// Mock expo-location for testing
export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

export const requestForegroundPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
}));

export const getCurrentPositionAsync = jest.fn(async () => ({
  coords: {
    latitude: 17.385044,
    longitude: 78.486671,
    accuracy: 20,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
}));

export const reverseGeocodeAsync = jest.fn(async () => [
  {
    postalCode: '500081',
    city: 'Hyderabad',
    district: 'Hyderabad',
    region: 'Telangana',
    subregion: 'Madhapur',
    street: 'Hitech City Road',
    name: 'Building 5',
    formattedAddress: 'Building 5, Hitech City Road, Madhapur, Hyderabad, Telangana 500081',
  },
]);

export default {
  Accuracy,
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  reverseGeocodeAsync,
};
