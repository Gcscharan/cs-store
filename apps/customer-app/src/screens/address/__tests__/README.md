# AddAddressScreen Test Suite

## 🎯 Overview

Production-grade test suite for the "Use Current Location" feature with 100+ high-value test cases organized in 5 layers.

## 📊 Test Architecture

### Layer 1: Core Flow (P0 - Critical)
**30 tests** - Must-pass scenarios for 90% of users

- TC-001: GPS Autofill Success
- TC-002: GPS → Pincode Validation → Success
- TC-003: GPS → User Edits → Submit
- TC-004: Manual Entry → Valid Pincode → Submit
- TC-005: Default Address Toggle

### Layer 2: Failure Scenarios (P1 - High Priority)
**40 tests** - Real-world failure handling

- TC-012: Permission Denied
- TC-013: GPS Timeout (30s)
- TC-014: Reverse Geocode Timeout
- TC-015: Reverse Geocode Returns Empty
- TC-016: Low GPS Accuracy (>100m)
- TC-017: Spam Click Prevention
- TC-018: Location Fetch Error

### Layer 3: Edge Cases (P2 - Medium Priority)
**20 tests** - India-specific scenarios

- TC-025: Village Address (No Street)
- TC-026: Apartment (No Flat Number)
- TC-027: Landmark Instead of Street
- TC-028: Multiple Cities for Pincode
- TC-029: Missing formattedAddress

### Layer 4: Security/Abuse (P3 - Security)
**10 tests** - Prevent misuse

- TC-040: Outside India Coordinates
- TC-041: Coordinates (0, 0)
- TC-042: Fake GPS Detection
- TC-043: Invalid Numeric Values

### Layer 5: Performance (Bonus)
**10 tests** - Stability under stress

- TC-055: Geocode Cache Working
- Rapid API calls
- Memory management

## 🚀 Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific test file
npm test AddAddressScreen.test.tsx

# Run specific test case
npm test -t "TC-001"
```

## 📈 Coverage Goals

- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >80%
- **Lines**: >80%

## 🧪 Test Patterns

### Mocking GPS Success
```typescript
(Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
  coords: { latitude: 17.385, longitude: 78.486, accuracy: 20 }
});
```

### Mocking GPS Failure
```typescript
(Location.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(
  new Error('GPS hardware failure')
);
```

### Mocking Permission Denied
```typescript
(Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
  status: 'denied',
  granted: false
});
```

### Testing User Interaction
```typescript
const button = getByText(/use current location/i);
fireEvent.press(button);

await waitFor(() => {
  expect(getByPlaceholderText('House / Flat / Building').props.value).toBe('Building 5');
});
```

## 🔄 Scaling to 10,000 Tests

### Phase 1: Foundation (Current)
- 100 high-value tests
- 5-layer architecture
- Core mocks setup

### Phase 2: Expansion
- Device variations (Android/iOS)
- Network conditions (2G/3G/4G/5G)
- Location types (urban/rural/tier-2/tier-3)

### Phase 3: Comprehensive
- Language variations (Hindi/Telugu/Tamil)
- API response variations
- Stress testing
- Property-based testing

## 📝 Adding New Tests

1. Identify the layer (P0/P1/P2/P3)
2. Follow naming convention: `TC-XXX: Description`
3. Use descriptive test names
4. Mock external dependencies
5. Test one thing per test
6. Use `waitFor` for async operations

## 🐛 Debugging Tests

```bash
# Run with verbose output
npm test -- --verbose

# Run single test in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand AddAddressScreen.test.tsx
```

## 📚 Resources

- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
