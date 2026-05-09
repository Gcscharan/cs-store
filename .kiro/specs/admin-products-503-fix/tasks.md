# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Admin Products POST Route Missing
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that POST /admin/products with valid admin authentication and multipart form data fails with 503 error on unfixed code
  - Test that frontend createAdminProduct API calls fail due to missing route
  - Test that multer cannot process image uploads on non-existent /admin/products POST route
  - The test assertions should match the Expected Behavior Properties from design (successful product creation with 201 status)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (503 errors, route not found)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Admin and API Routes Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for existing admin routes (GET, PUT, DELETE /admin/products)
  - Observe behavior on UNFIXED code for all /api/products routes (GET, POST, PUT, DELETE)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that existing GET /admin/products returns product lists correctly
  - Test that existing PUT /admin/products/:id updates products successfully
  - Test that existing DELETE /admin/products/:id deletes products successfully
  - Test that all /api/products routes continue to work exactly as before
  - Test that authentication and authorization patterns remain consistent
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix for missing POST /admin/products route

  - [x] 3.1 Implement the missing POST route in admin router
    - Add multer import and configuration for image upload handling in backend/src/routes/admin.ts
    - Import createProduct controller from domains/catalog/controllers/productController
    - Add POST /products route to admin router with proper middleware chain:
      - authenticateToken middleware for authentication
      - requireRole(["admin"]) middleware for authorization  
      - upload.array("images") multer middleware for file handling
      - auditLog middleware for admin action tracking
      - Route to existing createProduct controller function
    - Ensure proper route ordering to avoid conflicts with existing routes
    - Use consistent middleware pattern with other admin routes
    - _Bug_Condition: isBugCondition(input) where input.method == 'POST' AND input.path == '/admin/products' AND routeExists('/admin/products', 'POST') == false_
    - _Expected_Behavior: expectedBehavior(result) - successful product creation with 201 status, image processing via Cloudinary, and database save_
    - _Preservation: All existing GET, PUT, DELETE /admin/products routes and all /api/products routes must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Admin Products POST Route Working
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify POST /admin/products now successfully creates products with 201 status
    - Verify image upload and Cloudinary integration works via admin route
    - Verify authentication and authorization work correctly for admin product creation
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3)_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Admin and API Routes Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all existing admin routes (GET, PUT, DELETE) still work correctly
    - Confirm all /api/products routes continue to work exactly as before
    - Confirm authentication and authorization patterns remain unchanged
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.