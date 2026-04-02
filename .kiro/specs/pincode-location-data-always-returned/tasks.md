# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Non-Deliverable Pincode Returns Location Metadata
  - **CRITICAL**: This test MUST FAIL on unfixed code/data - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (non-deliverable pincodes returning no location data)
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test implementation details from Bug Condition in design: pincode is not deliverable but has valid location metadata (isBugCondition returns true)
  - The test assertions should match the Expected Behavior Properties from design: response contains deliverable: false AND state, postal_district, admin_district, cities fields
  - Test with known non-deliverable AP/Telangana pincodes (e.g., 521237 - Tiruvuru, Andhra Pradesh)
  - Assert response contains: `{ deliverable: false, state: "Andhra Pradesh", cities: ["Tiruvuru"], admin_district: "NTR", postal_district: "Krishna", message: "Not deliverable to this location or pincode" }`
  - Run test on UNFIXED code/data
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., "API returns { deliverable: false, message: '...' } without location fields")
  - Investigate whether issue is in controller logic, data availability (CSV/MongoDB), or resolver logic
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Deliverable and Invalid Pincode Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for deliverable pincodes (e.g., 500001 - Hyderabad)
  - Observe: checkPincodeController(500001) returns full location data with deliverable: true on unfixed code
  - Observe behavior on UNFIXED code for invalid pincodes (e.g., 999999, "abc123")
  - Observe: checkPincodeController(999999) returns { deliverable: false, message: "..." } without location data on unfixed code
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all deliverable pincodes, response contains deliverable: true AND all location metadata fields
    - For all invalid/malformed pincodes, response contains deliverable: false WITHOUT location metadata fields
    - For pincodes not found in system (resolvePincodeDetails returns null), response contains deliverable: false WITHOUT location metadata
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix data coverage issue

  - [x] 3.1 Add missing pincode to JSON dataset
    - Added pincode 521237 to backend/data/pincodes_ap_ts.json
    - Entry includes: state (Andhra Pradesh), district (Krishna), taluka (Tiruvuru)
    - _Bug_Condition: Pincode 521237 was missing from dataset, causing resolver to return null_
    - _Expected_Behavior: Resolver will now return location data with deliverable: false_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3_

  - [x] 3.2 Create MongoDB seeding script
    - Created backend/scripts/seedPincodesFromJSON.ts
    - Script reads JSON file and syncs to MongoDB
    - Verifies 521237 exists after seeding
    - Run: `cd backend && npx ts-node scripts/seedPincodesFromJSON.ts`
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Seed MongoDB with updated data
    - Run the seeding script to populate MongoDB
    - Verify 521237 exists in MongoDB collection
    - Check that resolver can find the pincode
    - _Requirements: 2.1, 2.2_

  - [ ] 3.4 Test API endpoint with 521237
    - Call GET /api/pincode/check/521237
    - Verify response contains: deliverable: false, state, postal_district, admin_district, cities
    - Expected: `{ deliverable: false, state: "Andhra Pradesh", postal_district: "Krishna", admin_district: "NTR", cities: ["Tiruvuru"], message: "Not deliverable to this location or pincode" }`
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 4. Verify fix with tests

  - [ ] 4.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Non-Deliverable Pincode Returns Location Metadata
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify response for pincode 521237 now contains: `{ deliverable: false, state: "Andhra Pradesh", cities: ["Tiruvuru"], admin_district: "NTR", postal_district: "Krishna", message: "..." }`
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 4.2 Verify preservation tests still pass
    - **Property 2: Preservation** - Deliverable and Invalid Pincode Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm deliverable pincodes (500001, etc.) still return full location data with deliverable: true
    - Confirm invalid pincodes (999999, "abc123") still return deliverable: false without location data
    - Confirm other endpoints (validatePincodeController, etc.) continue to work unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify bug condition test passes (non-deliverable pincodes return location metadata)
  - Verify preservation tests pass (deliverable and invalid pincodes unchanged)
  - Verify no regressions in other pincode endpoints
  - Document any findings from root cause investigation
