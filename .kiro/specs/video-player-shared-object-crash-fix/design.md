# Video Player Shared Object Crash Fix Design

## Overview

The ProductDetailScreen crashes with "Cannot use shared object that was already released" errors when displaying video content in the media carousel. This occurs because the VideoItem component creates video player instances using `useVideoPlayer` hook without proper lifecycle management, leading to attempts to use already-released shared objects when the component re-renders or unmounts. The fix involves implementing proper video player lifecycle management with cleanup on component unmount and preventing operations on released players.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when VideoView components attempt to use already-released video player shared objects
- **Property (P)**: The desired behavior when video content is displayed - videos should render without crashing and properly manage player lifecycle
- **Preservation**: Existing image display, carousel functionality, and video controls that must remain unchanged by the fix
- **VideoItem**: The React component in `ProductDetailScreen.tsx` that renders video content using expo-video
- **useVideoPlayer**: The expo-video hook that creates video player instances with shared native objects
- **Shared Object**: The native video player object managed by expo-video that can be released/disposed

## Bug Details

### Bug Condition

The bug manifests when VideoItem components try to set player props on VideoView components using already-released shared objects. The `useVideoPlayer` hook creates native shared objects that can be released, but the VideoItem component doesn't properly manage the lifecycle of these objects, leading to crashes when React re-renders or when users navigate between screens.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type VideoRenderEvent
  OUTPUT: boolean
  
  RETURN input.hasVideoContent == true
         AND input.playerInstance.isReleased == true
         AND input.componentAction IN ['render', 'setPlayerProp', 'play', 'pause']
END FUNCTION
```

### Examples

- **Navigation Crash**: User navigates from Product A (with video) to Product B (with video) → VideoItem tries to use released player from Product A → "Cannot use shared object that was already released" crash
- **Re-render Crash**: Product screen re-renders due to state change → VideoItem attempts to set player prop on already-released shared object → crash
- **Carousel Scroll**: User scrolls through media carousel containing video → VideoItem component unmounts/remounts → attempts to use released player → crash
- **Component Unmount**: User navigates away from product screen → VideoItem cleanup doesn't properly release player → subsequent access attempts crash

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Image display in media carousel must continue to work exactly as before
- Carousel pagination, scrolling, and dot indicators must remain unchanged
- Video autoplay/pause functionality when working correctly must continue to work
- Product information display, pricing, reviews, and add-to-cart functionality must remain unchanged

**Scope:**
All inputs that do NOT involve video player lifecycle management should be completely unaffected by this fix. This includes:
- Image rendering in media carousel
- Carousel navigation and pagination
- Non-video product interactions (add to cart, reviews, etc.)
- Screen navigation for products without videos

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Missing Player Cleanup**: The VideoItem component doesn't properly release video players on unmount
   - `useVideoPlayer` creates shared native objects that need explicit cleanup
   - Component unmount doesn't call `player.release()` to free native resources
   - Subsequent renders try to use already-released objects

2. **Player Instance Reuse**: React component re-renders may attempt to reuse released player instances
   - State changes cause VideoItem to re-render with stale player references
   - Navigation between products doesn't properly clean up previous players

3. **Async Player Operations**: Video player operations (play/pause) may be called on released objects
   - `useEffect` cleanup doesn't prevent async operations from completing
   - Player state changes occur after component unmount

4. **Memory Management Issues**: expo-video shared objects aren't being properly managed across component lifecycle
   - Native video player resources accumulate without proper disposal
   - React's component lifecycle doesn't align with native object lifecycle

## Correctness Properties

Property 1: Bug Condition - Video Player Lifecycle Management

_For any_ video content rendering where a VideoItem component is mounted, the fixed component SHALL properly manage the video player lifecycle, ensuring that video players are created, used, and released without attempting operations on already-released shared objects.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-Video Content Behavior

_For any_ media carousel interaction that does NOT involve video content (image display, carousel navigation, product interactions), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for non-video content.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/customer-app/src/screens/products/ProductDetailScreen.tsx`

**Component**: `VideoItem`

**Specific Changes**:
1. **Add Player Cleanup**: Implement proper cleanup in VideoItem component
   - Add `useEffect` cleanup function to call `player.release()` on unmount
   - Ensure cleanup prevents operations on released players

2. **Add Player State Tracking**: Track player release state to prevent operations on released objects
   - Add local state to track if player has been released
   - Guard all player operations with release state checks

3. **Improve Error Handling**: Add try-catch blocks around player operations
   - Wrap `player.play()`, `player.pause()`, and other operations in error handling
   - Log errors gracefully instead of crashing the app

4. **Optimize Player Creation**: Ensure player instances are created only when needed
   - Add null checks before player operations
   - Prevent player creation for invalid video URLs

5. **Add Component Key**: Ensure VideoItem components are properly keyed for React reconciliation
   - Use stable keys based on video URL to prevent unnecessary re-renders
   - Help React properly manage component lifecycle

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate video rendering scenarios and navigation patterns. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Navigation Between Video Products**: Navigate from Product A (with video) to Product B (with video) (will fail on unfixed code)
2. **Component Re-render Test**: Force re-render of ProductDetailScreen with video content (will fail on unfixed code)
3. **Rapid Carousel Scrolling**: Quickly scroll through media carousel containing videos (will fail on unfixed code)
4. **Memory Pressure Test**: Load multiple products with videos in sequence (may fail on unfixed code)

**Expected Counterexamples**:
- "Cannot use shared object that was already released" errors during navigation
- Possible causes: missing cleanup, player reuse, async operations on released objects

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := VideoItem_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT VideoItem_original(input) = VideoItem_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for image content and non-video interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Image Display Preservation**: Observe that image rendering works correctly on unfixed code, then write test to verify this continues after fix
2. **Carousel Navigation Preservation**: Observe that carousel scrolling and pagination work correctly on unfixed code, then write test to verify this continues after fix
3. **Product Interaction Preservation**: Observe that add-to-cart, reviews, and other product interactions work correctly on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test video player creation and cleanup lifecycle
- Test error handling for player operations on released objects
- Test component unmount cleanup behavior
- Test navigation between products with videos

### Property-Based Tests

- Generate random navigation patterns between products with/without videos to verify crash prevention
- Generate random media carousel configurations to verify preservation of image display behavior
- Test across many video URL formats and edge cases to ensure robust error handling

### Integration Tests

- Test full product detail flow with video content without crashes
- Test navigation between multiple products containing videos
- Test memory usage doesn't accumulate with repeated video product views
- Test that video controls (play/pause) work correctly after fix