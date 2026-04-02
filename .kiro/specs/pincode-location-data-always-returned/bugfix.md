# Bugfix Requirements Document

## Introduction

The pincode API endpoint (`checkPincodeController`) currently returns location metadata (state, cities, admin_district, postal_district) only when a pincode is deliverable. When a pincode is not deliverable, the response omits this critical location information, causing the frontend to lose context about the user's actual location. This creates a poor user experience where users don't understand WHERE they are when delivery is unavailable, and prevents future distance-based delivery logic from functioning properly.

This bug affects the architectural separation of concerns: location identification (WHERE the user is) should be independent from delivery coverage (WHETHER we deliver there).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a pincode is not deliverable (e.g., 521237 - Tiruvuru, Andhra Pradesh) THEN the system returns `{ deliverable: false, message: "Not deliverable..." }` without state, cities, admin_district, or postal_district fields

1.2 WHEN `resolvePincodeDetails` returns data with `deliverable: false` THEN the system discards the location metadata (state, postal_district, cities) and only returns the deliverability status

1.3 WHEN the frontend receives a non-deliverable response THEN the system loses GPS-detected location context because the API response contains no location data to preserve or merge with

### Expected Behavior (Correct)

2.1 WHEN a pincode is not deliverable (e.g., 521237) THEN the system SHALL return `{ deliverable: false, state: "Andhra Pradesh", cities: ["Tiruvuru"], admin_district: "NTR", postal_district: "Krishna", message: "Not deliverable to this location" }`

2.2 WHEN `resolvePincodeDetails` returns data with `deliverable: false` THEN the system SHALL include all location metadata fields (state, postal_district, admin_district, cities) in the response

2.3 WHEN the frontend receives a non-deliverable response with location data THEN the system SHALL preserve and display the user's location context even when delivery is unavailable

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a pincode is deliverable THEN the system SHALL CONTINUE TO return all location metadata fields as it currently does

3.2 WHEN a pincode is invalid or malformed THEN the system SHALL CONTINUE TO return `{ deliverable: false, message: "Not deliverable to this location or pincode" }` without location data

3.3 WHEN `resolvePincodeDetails` returns null (pincode not found) THEN the system SHALL CONTINUE TO return `{ deliverable: false, message: "Not deliverable to this location or pincode" }` without location data

3.4 WHEN the pincode validation endpoint (`validatePincodeController`) is called THEN the system SHALL CONTINUE TO function unchanged (this fix only affects `checkPincodeController`)
