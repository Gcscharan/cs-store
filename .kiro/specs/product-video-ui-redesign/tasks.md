# Implementation Plan: Product Video UI Redesign

## Overview

This implementation plan transforms the product video UI from native controls to an Amazon-style minimal interface with tap-to-play/pause interaction. The implementation focuses on modifying the video rendering logic within ProductDetailScreen.tsx while maintaining carousel integration and optimizing performance.

## Tasks

- [x] 1. Set up video state management and core infrastructure
  - Add `isVideoPlaying` state variable to ProductDetailScreen component
  - Create `playButtonOpacity` Animated.Value ref for fade animations
  - Import required dependencies (Animated, Easing, Pressable from react-native)
  - _Requirements: 2.4, 4.4, 6.4_

- [x] 2. Implement video tap handler with playback control
  - [x] 2.1 Create handleVideoTap function using useCallback
    - Implement play/pause toggle logic using videoPlayer.play() and videoPlayer.pause()
    - Update isVideoPlaying state on toggle
    - Add fade in/out animation for play button opacity (250ms duration)
    - Use Easing.out and Easing.in for natural motion
    - _Requirements: 2.2, 2.3, 2.4, 8.1, 8.2, 8.4_

- [x] 3. Modify renderMediaItem function for minimal video UI
  - [x] 3.1 Update video rendering block in renderMediaItem
    - Set nativeControls={false} on VideoView component
    - Add dark gradient overlay View with rgba(0,0,0,0.2) background
    - Position gradient overlay absolutely with zIndex: 1
    - _Requirements: 1.1, 1.3, 1.4, 4.2_
  
  - [x] 3.2 Add Pressable tap detection overlay
    - Create Pressable component with absolute positioning covering entire video area
    - Set zIndex: 2 to layer above video and gradient
    - Connect onPress to handleVideoTap function
    - Add accessibility props (accessibilityLabel, accessibilityRole, accessibilityHint)
    - _Requirements: 2.2, 4.5_
  
  - [x] 3.3 Implement conditional play button overlay
    - Render Animated.View with play button when !isPlaying
    - Apply playButtonOpacity to Animated.View style
    - Create white circular button (64x64) with play icon
    - Add shadow styling (shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation)
    - Use Ionicons "play" icon (size 32, color black)
    - Center button using justifyContent and alignItems
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

- [ ]* 3.4 Write unit tests for video rendering
    - Test VideoView renders with nativeControls={false}
    - Test play button displays when isVideoPlaying is false
    - Test play button hides when isVideoPlaying is true
    - Test gradient overlay is applied
    - Test Pressable overlay covers video area
    - _Requirements: 1.1, 2.3, 2.4_

- [x] 4. Implement play button press animation
  - Add scale animation to play button Pressable (scale to 0.95 on press)
  - Use Animated.timing with 150ms duration
  - Apply useNativeDriver: true for performance
  - _Requirements: 3.5, 8.3, 8.5_

- [ ]* 4.1 Write unit tests for play button animations
    - Test fade in animation (opacity 0 to 1, 250ms)
    - Test fade out animation (opacity 1 to 0, 250ms)
    - Test scale animation on button press
    - Test useNativeDriver is enabled
    - Test easing functions are applied
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 5. Update carousel synchronization logic
  - [x] 5.1 Modify existing useEffect for currentMediaIndex changes
    - Find video index in media array
    - When currentMediaIndex !== videoIndex, pause video and reset state
    - Call videoPlayer.pause() and setIsVideoPlaying(false)
    - Reset playButtonOpacity to 1 using setValue
    - Do NOT autoplay when video becomes visible (user must tap)
    - _Requirements: 2.1, 5.3, 5.4, 6.2_

- [ ]* 5.2 Write integration tests for carousel behavior
    - Test video pauses when scrolling to different media item
    - Test video does not autoplay when scrolled into view
    - Test play button appears when video becomes visible
    - Test state resets correctly on carousel navigation
    - _Requirements: 2.1, 5.3, 5.4_

- [x] 6. Add video resource cleanup
  - Create useEffect cleanup function to release video player on unmount
  - Call videoPlayer.pause() and videoPlayer.release() in cleanup
  - _Requirements: 6.3_

- [x] 7. Checkpoint - Ensure core functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add optional video badge indicator
  - Create conditional video badge View in top-left corner (position absolute, top: 12, left: 12)
  - Add Ionicons "videocam" icon (size 12, color white)
  - Add "Video" text label (fontSize 11, fontWeight 600, color white)
  - Apply semi-transparent black background (rgba(0,0,0,0.6))
  - Set zIndex: 3 to layer above all other elements
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. Create and apply video styles to StyleSheet
  - Define videoGradientOverlay style (absolute positioning, rgba background)
  - Define videoTapOverlay style (absolute positioning, centered content)
  - Define playButtonContainer style (centered layout)
  - Define playButton style (64x64 white circle with shadow)
  - Define videoBadge style (top-left positioning, semi-transparent background)
  - Define videoBadgeText style (white text, 11px, bold)
  - _Requirements: 1.4, 1.5, 3.1, 3.2, 3.3_

- [x] 10. Apply performance optimizations
  - Wrap renderMediaItem with React.memo to prevent unnecessary re-renders
  - Verify handleVideoTap uses useCallback with correct dependencies
  - Ensure no inline style objects are created on each render
  - Verify animations use native driver
  - _Requirements: 6.1, 6.4, 6.5, 8.5_

- [ ]* 10.1 Write performance tests
    - Test component does not re-render when state unchanged
    - Test video resources released when scrolled out of view
    - Test no new function references created on render
    - Test native driver used for animations
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. Add error handling for video loading failures
  - Add videoError state variable
  - Add statusChange listener to videoPlayer for error detection
  - Render error UI with alert icon and error message when videoError is set
  - Log errors to console for debugging
  - _Requirements: 4.3_

- [ ]* 11.1 Write unit tests for error handling
    - Test error message displays when video fails to load
    - Test graceful handling of missing video URL
    - Test cleanup on component unmount
    - _Requirements: 4.3_

- [x] 12. Final checkpoint and validation
  - Verify all acceptance criteria met
  - Test on both iOS and Android devices
  - Verify square aspect ratio maintained
  - Verify no interference with carousel pagination
  - Verify smooth animations and no performance issues
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design uses TypeScript/React Native, so all code should follow TypeScript conventions
- No new dependencies required - all libraries already installed
- Focus on minimal, clean implementation matching Amazon's product video UX
- Checkpoints ensure incremental validation and user feedback opportunities
