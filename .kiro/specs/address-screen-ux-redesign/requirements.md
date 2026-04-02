# Requirements Document

## Introduction

This document specifies the requirements for redesigning the Add Address screen in the customer mobile app to follow mobile-first UX principles inspired by production-grade apps like Blinkit, Swiggy, and Amazon. The redesign addresses critical usability issues: poor thumb reachability, inefficient vertical space distribution, cluttered visual hierarchy, and form-heavy interaction patterns. The goal is to transform the address entry experience from a 30-second form-filling task into a 5-second guided flow.

## Glossary

- **Address_Screen**: The mobile screen where users add or edit delivery addresses
- **Location_Button**: The "Use Current Location" button that triggers GPS-based address detection
- **Detected_Address_Card**: A visual card component displaying the GPS-detected address with edit capability
- **House_Field**: The input field for house/flat number (the only field GPS cannot auto-detect)
- **Landmark_Field**: An optional input field for nearby landmarks
- **Pincode_Section**: The auto-filled section displaying pincode and city information
- **Save_Button**: The primary CTA button for saving the address
- **Thumb_Zone**: The lower 60% of the mobile screen reachable by thumb in one-handed use
- **Suggestion_Chip**: A compact, pill-shaped UI element displaying a location suggestion
- **Sticky_Element**: A UI element that remains fixed in position during scroll

## Requirements

### Requirement 1: Thumb-Reachable Location Detection

**User Story:** As a mobile user, I want the location detection button to be easily reachable with my thumb, so that I can quickly detect my address without stretching or using two hands.

#### Acceptance Criteria

1. THE Location_Button SHALL be positioned within the Thumb_Zone
2. THE Location_Button SHALL have a minimum touch target of 48dp height
3. WHEN the user taps the Location_Button, THE Address_Screen SHALL trigger GPS location detection
4. WHILE location detection is in progress, THE Location_Button SHALL display a loading state with "Detecting..." text
5. THE Location_Button SHALL use prominent visual styling with primary color and icon

### Requirement 2: Detected Address Display

**User Story:** As a user, I want to see my detected address in a clear card format, so that I can quickly verify the location without parsing raw form fields.

#### Acceptance Criteria

1. WHEN GPS location is successfully detected, THE Address_Screen SHALL display the Detected_Address_Card
2. THE Detected_Address_Card SHALL show the complete address text in a single readable format
3. THE Detected_Address_Card SHALL include an edit icon or button
4. WHEN the user taps the edit control on Detected_Address_Card, THE Address_Screen SHALL allow inline editing of the address
5. THE Detected_Address_Card SHALL use card styling with 16px padding and subtle elevation

### Requirement 3: House Number Priority

**User Story:** As a user, I want the house/flat number field to be the most prominent input, so that I can quickly enter the only information GPS cannot detect.

#### Acceptance Criteria

1. THE House_Field SHALL be positioned immediately after the Detected_Address_Card
2. THE House_Field SHALL have a larger font size than secondary fields
3. THE House_Field SHALL include a clear label "House/Flat Number"
4. THE House_Field SHALL auto-focus when the Detected_Address_Card is displayed
5. THE House_Field SHALL be marked as required with visual indicator

### Requirement 4: Optional Landmark Entry

**User Story:** As a user, I want to optionally add a landmark, so that I can provide additional location context without being forced to fill unnecessary fields.

#### Acceptance Criteria

1. THE Landmark_Field SHALL be positioned after the House_Field
2. THE Landmark_Field SHALL be visually styled as optional (lighter label, no asterisk)
3. THE Landmark_Field SHALL include placeholder text "Nearby landmark (optional)"
4. THE Address_Screen SHALL allow form submission without Landmark_Field data
5. THE Landmark_Field SHALL have smaller visual weight than the House_Field

### Requirement 5: Auto-Filled Pincode Display

**User Story:** As a user, I want pincode and city to be auto-filled and minimally styled, so that I can focus on the essential information without visual clutter.

#### Acceptance Criteria

1. WHEN GPS location is detected, THE Pincode_Section SHALL auto-populate with pincode and city data
2. THE Pincode_Section SHALL use read-only styling with muted colors
3. THE Pincode_Section SHALL display pincode and city in a compact horizontal layout
4. THE Pincode_Section SHALL show a deliverability status indicator
5. IF pincode validation fails, THEN THE Pincode_Section SHALL display an error message with option to edit

### Requirement 6: Sticky Bottom Save Button

**User Story:** As a user, I want the save button to always be visible at the bottom of the screen, so that I can quickly save my address without scrolling.

#### Acceptance Criteria

1. THE Save_Button SHALL be positioned as a Sticky_Element at the bottom of the Address_Screen
2. THE Save_Button SHALL remain visible during scroll
3. THE Save_Button SHALL span the full width minus 16px padding on each side
4. THE Save_Button SHALL use primary color with high contrast text
5. WHILE form validation is in progress, THE Save_Button SHALL be disabled with visual feedback
6. THE Save_Button SHALL have a minimum height of 48dp for thumb accessibility

### Requirement 7: Minimal Suggestion Display

**User Story:** As a user, I want to see a maximum of 3 location suggestions in a clean chip format, so that I can quickly select without scrolling through cluttered lists.

#### Acceptance Criteria

1. WHEN city suggestions are available, THE Address_Screen SHALL display a maximum of 3 suggestions
2. THE Address_Screen SHALL render suggestions as Suggestion_Chip elements
3. THE Suggestion_Chip SHALL use pill-shaped styling with 8px padding
4. WHEN the user taps a Suggestion_Chip, THE Address_Screen SHALL populate the city field
5. THE Address_Screen SHALL display suggestions in a horizontal scrollable row

### Requirement 8: Consistent Spacing

**User Story:** As a user, I want consistent spacing throughout the screen, so that the interface feels polished and professional.

#### Acceptance Criteria

1. THE Address_Screen SHALL use 16px padding on left and right edges
2. THE Address_Screen SHALL use 12px vertical spacing between form fields
3. THE Address_Screen SHALL use 8px padding within input fields
4. THE Address_Screen SHALL use 24px spacing between major sections
5. THE Address_Screen SHALL maintain consistent spacing across all screen sizes

### Requirement 9: Reduced Form Complexity

**User Story:** As a user, I want to see only essential fields initially, so that the screen feels like a guided flow rather than a heavy form.

#### Acceptance Criteria

1. THE Address_Screen SHALL display a maximum of 5 visible input fields initially
2. THE Address_Screen SHALL auto-fill district and state fields without displaying them prominently
3. THE Address_Screen SHALL hide the map picker by default
4. WHERE the user needs to manually adjust location, THE Address_Screen SHALL provide a "Adjust on Map" option
5. THE Address_Screen SHALL group related fields (pincode/city) into single visual units

### Requirement 10: Fast Address Entry Flow

**User Story:** As a user, I want to complete address entry in under 5 seconds, so that I can quickly proceed with my order.

#### Acceptance Criteria

1. WHEN GPS location is detected successfully, THE Address_Screen SHALL require only house number input for submission
2. THE Address_Screen SHALL validate pincode in the background without blocking user input
3. THE Address_Screen SHALL pre-fill name and phone from user profile if available
4. THE Address_Screen SHALL enable the Save_Button as soon as minimum required fields are valid
5. WHEN the user taps Save_Button, THE Address_Screen SHALL submit within 500ms

### Requirement 11: Visual Hierarchy

**User Story:** As a user, I want to immediately understand which fields are most important, so that I can efficiently complete the form.

#### Acceptance Criteria

1. THE Address_Screen SHALL use font size hierarchy: 18px for primary fields, 16px for secondary, 14px for tertiary
2. THE Address_Screen SHALL use color hierarchy: primary color for actionable elements, muted for auto-filled
3. THE Address_Screen SHALL use visual weight: bold for required labels, regular for optional
4. THE Address_Screen SHALL display required field indicators only on user-editable fields
5. THE Address_Screen SHALL use subtle borders (1px) for secondary fields and prominent borders (2px) for primary fields

### Requirement 12: Error State Handling

**User Story:** As a user, I want clear error messages positioned near the relevant field, so that I can quickly understand and fix validation issues.

#### Acceptance Criteria

1. WHEN a field validation fails, THE Address_Screen SHALL display an error message directly below the field
2. THE Address_Screen SHALL use error color (red) for invalid field borders
3. THE Address_Screen SHALL display error messages in 12px font size
4. IF pincode is not deliverable, THEN THE Address_Screen SHALL disable the Save_Button and show inline error
5. THE Address_Screen SHALL clear error messages when the user begins editing the field

## Parser and Serializer Requirements

This feature does not introduce new parsers or serializers. The existing address API serialization and GPS coordinate parsing remain unchanged.
