# Test Cases: Address Management System

**Module**: Address Management System  
**Criticality**: 🔴 CRITICAL  
**Total Test Cases**: 850  
**Last Updated**: 2026-04-01

---

## Test Case Summary

| Category | Count | Priority |
|----------|-------|----------|
| Functional - Happy Path | 120 | P0 |
| GPS Detection | 150 | P0 |
| Pincode Validation | 180 | P0 |
| Edge Cases | 200 | P1 |
| Failure Scenarios | 120 | P0 |
| Network Issues | 80 | P1 |

---

## BATCH 1: FUNCTIONAL - HAPPY PATH (1-120)

### GPS Detection Flow (1-40)

1. [P0] **Test Case**: GPS Detection Success with Valid Pincode
   - **Scenario**: User clicks "Use Current Location", GPS detects location, reverse geocoding succeeds, pincode is deliverable
   - **Expected Result**: Form pre-fills with house, area, city, state, pincode. Pincode validated once. Submit button enabled.

2. [P0] **Test Case**: GPS Detection with High Accuracy (<50m)
   - **Scenario**: GPS returns location with accuracy 30m
   - **Expected Result**: Location accepted, no accuracy warning shown

3. [P0] **Test Case**: GPS Detection with Medium Accuracy (50-100m)
   - **Scenario**: GPS returns location with accuracy 75m
   - **Expected Result**: Location accepted, accuracy warning shown, user can continue

4. [P0] **Test Case**: GPS Detection Sets Validation Source to "gps"
   - **Scenario**: User uses GPS detection
   - **Expected Result**: validationSource state = "gps", logged in console

5. [P0] **Test Case**: GPS Pincode Validated Exactly Once
   - **Scenario**: User uses GPS detection, pincode auto-filled
   - **Expected Result**: Pincode API called exactly 1 time, logged as "PINCODE_VALIDATION" with source="gps"

6. [P0] **Test Case**: GPS Detection Pre-fills All Address Fields
   - **Scenario**: GPS detection successful with complete address data
   - **Expected Result**: house, area, city, state, pincode all populated

7. [P0] **Test Case**: GPS Detection Auto-focuses House Field
   - **Scenario**: GPS detection completes successfully
   - **Expected Result**: House/flat/building field receives focus after 400ms

8. [P0] **Test Case**: GPS Detection Preserves Scroll Position
   - **Scenario**: User scrolls down, then uses GPS detection
   - **Expected Result**: Scroll position restored after form update

9. [P0] **Test Case**: GPS Detection Shows Map with Marker
   - **Scenario**: GPS detection successful
   - **Expected Result**: Map displayed with marker at detected location

10. [P0] **Test Case**: GPS Detection Caches Geocoding Results
    - **Scenario**: GPS detection at same location twice
    - **Expected Result**: Second detection uses cached data, no duplicate API call


11. [P0] **Test Case**: GPS Detection with Deliverable Pincode
    - **Scenario**: GPS detects location with deliverable pincode
    - **Expected Result**: Pincode status shows "Deliverable", submit button enabled

12. [P0] **Test Case**: GPS Detection Updates Form State Correctly
    - **Scenario**: GPS detection completes
    - **Expected Result**: formData state updated with all fields, no undefined values

13. [P0] **Test Case**: GPS Detection Cleans Location Names
    - **Scenario**: Reverse geocoding returns "City S O"
    - **Expected Result**: Displayed as "City" (postal suffix removed)

14. [P0] **Test Case**: GPS Detection Extracts Area from Formatted Address
    - **Scenario**: Reverse geocoding returns formattedAddress with locality
    - **Expected Result**: Area extracted correctly, not using fallback

15. [P0] **Test Case**: GPS Detection Fallback to Street
    - **Scenario**: formattedAddress parsing fails, street available
    - **Expected Result**: Area populated with street value

16. [P0] **Test Case**: GPS Detection Fallback to Subregion
    - **Scenario**: formattedAddress and street unavailable, subregion available
    - **Expected Result**: Area populated with subregion value

17. [P0] **Test Case**: GPS Detection Shows Area Hint When Fallback Used
    - **Scenario**: Area populated using fallback (not formattedAddress)
    - **Expected Result**: Helper text shown: "Detected nearby area. Please verify."

18. [P0] **Test Case**: GPS Detection Within India Bounds
    - **Scenario**: GPS detects location at lat=28.6, lng=77.2 (Delhi)
    - **Expected Result**: Location accepted, processing continues

19. [P0] **Test Case**: GPS Detection Smooth Transition
    - **Scenario**: GPS detection completes
    - **Expected Result**: Form update delayed 120ms for smooth UX

20. [P0] **Test Case**: GPS Detection Releases Lock After Completion
    - **Scenario**: GPS detection completes successfully
    - **Expected Result**: isFetchingRef.current = false, can trigger again

21. [P1] **Test Case**: GPS Detection with Partial Address Data
    - **Scenario**: Reverse geocoding returns only city and state, no area
    - **Expected Result**: Available fields populated, missing fields left empty for manual entry

22. [P1] **Test Case**: GPS Detection Updates Map Region
    - **Scenario**: GPS detection successful
    - **Expected Result**: Map region centered on detected coordinates with 0.005 delta

23. [P1] **Test Case**: GPS Detection Validates Coordinates
    - **Scenario**: GPS returns valid lat/lng
    - **Expected Result**: Coordinates sanitized and validated before use

24. [P1] **Test Case**: GPS Detection Logs All Steps
    - **Scenario**: GPS detection flow executes
    - **Expected Result**: Console logs for permission, GPS fetch, geocoding, validation

25. [P1] **Test Case**: GPS Detection Shows Loading State
    - **Scenario**: User clicks "Use Current Location"
    - **Expected Result**: Button shows spinner, text changes to "Detecting location..."

26. [P1] **Test Case**: GPS Detection Disables Button During Detection
    - **Scenario**: GPS detection in progress
    - **Expected Result**: Button disabled, cannot trigger duplicate detection

27. [P1] **Test Case**: GPS Detection Handles Empty Postal Code
    - **Scenario**: Reverse geocoding returns no postalCode
    - **Expected Result**: Warning logged, pincode field left empty, no validation triggered

28. [P1] **Test Case**: GPS Detection Area Validation
    - **Scenario**: Extracted area contains "near" or "opposite"
    - **Expected Result**: Area rejected, next fallback used

29. [P1] **Test Case**: GPS Detection Locality Keywords Check
    - **Scenario**: Area contains "nagar", "colony", or "road"
    - **Expected Result**: Area accepted as likely locality

30. [P1] **Test Case**: GPS Detection Multiple Address Parts
    - **Scenario**: formattedAddress has 5+ comma-separated parts
    - **Expected Result**: Correctly filters and extracts locality

31. [P1] **Test Case**: GPS Detection Removes Duplicate Parts
    - **Scenario**: formattedAddress contains duplicate city name
    - **Expected Result**: Duplicates filtered out

32. [P1] **Test Case**: GPS Detection Trims Whitespace
    - **Scenario**: Geocoding returns " City  " with extra spaces
    - **Expected Result**: Trimmed to "City"

33. [P1] **Test Case**: GPS Detection State Mapping
    - **Scenario**: Geocoding returns region="Karnataka"
    - **Expected Result**: State field populated with "Karnataka"

34. [P1] **Test Case**: GPS Detection Admin District Mapping
    - **Scenario**: Geocoding returns subregion="Bangalore Urban"
    - **Expected Result**: admin_district populated correctly

35. [P1] **Test Case**: GPS Detection City Fallback to District
    - **Scenario**: Geocoding returns no city but has district
    - **Expected Result**: City populated with district value

36. [P1] **Test Case**: GPS Detection Preserves Existing Data
    - **Scenario**: User has partially filled form, then uses GPS
    - **Expected Result**: GPS data overwrites only location fields, preserves name/phone

37. [P1] **Test Case**: GPS Detection Clears Previous Errors
    - **Scenario**: Form has validation errors, user uses GPS
    - **Expected Result**: Location-related errors cleared

38. [P1] **Test Case**: GPS Detection Updates Available Cities
    - **Scenario**: Pincode validation returns multiple cities
    - **Expected Result**: City suggestions displayed below city field

39. [P1] **Test Case**: GPS Detection Timestamp Logging
    - **Scenario**: GPS detection flow executes
    - **Expected Result**: All logs include timestamp for debugging

40. [P1] **Test Case**: GPS Detection Performance
    - **Scenario**: GPS detection from click to form update
    - **Expected Result**: Completes within 5 seconds under normal conditions

### Manual Pincode Entry Flow (41-80)

41. [P0] **Test Case**: Manual Pincode Entry Success
    - **Scenario**: User manually types 6-digit deliverable pincode
    - **Expected Result**: Pincode validated after 500ms debounce, city/state auto-filled

42. [P0] **Test Case**: Manual Entry Sets Validation Source to "manual"
    - **Scenario**: User types in pincode field
    - **Expected Result**: validationSource = "manual", logged in console

43. [P0] **Test Case**: Manual Entry Triggers Debounced Validation
    - **Scenario**: User types 6-digit pincode
    - **Expected Result**: Validation triggered after 500ms, not immediately

44. [P0] **Test Case**: Manual Entry Debounce Cancels Previous Timer
    - **Scenario**: User types "560", waits 300ms, types "001"
    - **Expected Result**: Only 1 API call after final keystroke + 500ms

45. [P0] **Test Case**: Manual Entry Only Validates 6-Digit Pincode
    - **Scenario**: User types "5600" (4 digits)
    - **Expected Result**: No validation triggered, no API call

46. [P0] **Test Case**: Manual Entry Strips Non-Numeric Characters
    - **Scenario**: User types "56-00-01"
    - **Expected Result**: Cleaned to "560001", validation triggered

47. [P0] **Test Case**: Manual Entry Max Length 6
    - **Scenario**: User tries to type 7th digit
    - **Expected Result**: Input blocked at 6 characters

48. [P0] **Test Case**: Manual Entry Deliverable Pincode
    - **Scenario**: User enters deliverable pincode
    - **Expected Result**: Status shows "Deliverable", city/state auto-filled, submit enabled

49. [P0] **Test Case**: Manual Entry Non-Deliverable Pincode
    - **Scenario**: User enters non-deliverable pincode
    - **Expected Result**: Status shows "Not deliverable", submit button disabled

50. [P0] **Test Case**: Manual Entry Updates City Suggestions
    - **Scenario**: Pincode validation returns 3 cities
    - **Expected Result**: City chips displayed with all 3 options
