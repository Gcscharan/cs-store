# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Video Display Missing for Products with Video
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to products with valid video metadata (video.url exists and is non-empty)
  - Test that ProductDetailPage displays video section with thumbnail, play icon, and duration for products with video metadata
  - The test assertions should match the Expected Behavior Properties from design:
    - Video section exists with data-testid="video-section"
    - Video thumbnail displays with correct src (product.video.thumbnail)
    - Play icon overlay exists with data-testid="play-icon"
    - Duration badge displays with correct duration (product.video.duration)
    - Video thumbnail is clickable (has click handler)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "Product with video metadata shows no video section")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Video Product Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for products without video (video is null/undefined)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - No video section displayed when product.video is null/undefined
    - Product image displays correctly in existing location
    - Add to cart button works correctly
    - Product details (name, price, description) display correctly
    - Reviews section displays correctly
    - Similar products section displays correctly
    - Page layout and responsive design unchanged
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for product video display missing

  - [x] 3.1 Add video display section to ProductDetailPage
    - Import Play and X icons from lucide-react
    - Add showVideoPlayer state: `const [showVideoPlayer, setShowVideoPlayer] = useState(false);`
    - Add handleVideoClick handler: `const handleVideoClick = () => { setShowVideoPlayer(true); };`
    - Add conditional video section in Product Media column (below main image, above Add to Cart)
    - Implement thumbnail view with play icon overlay and duration badge
    - Implement lazy-loaded video player view with close button
    - Use data-testid attributes for testing: "video-section", "video-thumbnail", "play-icon", "video-duration"
    - Ensure video section only renders when `product?.video` exists
    - _Bug_Condition: isBugCondition(product) where product.video exists with valid url_
    - _Expected_Behavior: Video section displays with thumbnail, play icon, duration badge, and click handler (Properties 1-5 from design)_
    - _Preservation: No video section when product.video is null/undefined; all existing functionality unchanged (Preservation Properties 1-7 from design)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Video Display Present for Products with Video
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Video Product Behavior Still Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
