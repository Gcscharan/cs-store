# Design Document: Product Video UI Redesign

## Overview

This design document specifies the technical approach for redesigning the product video UI in the React Native (Expo) customer app to achieve an Amazon-style minimal user experience. The redesign transforms the current video implementation (which uses `nativeControls`) into a custom, distraction-free interface with tap-to-play/pause interaction and a centered play button overlay.

### Goals

- Create a clean, premium video playback experience without visible controls during playback
- Implement simple tap-anywhere interaction for play/pause control
- Maintain seamless integration with the existing horizontal FlatList media carousel
- Optimize performance to prevent unnecessary re-renders
- Use expo-video library with manual control via useVideoPlayer hook

### Non-Goals

- Modifying the carousel pagination or navigation structure
- Adding seek/scrub functionality
- Implementing picture-in-picture or fullscreen modes
- Supporting multiple simultaneous video players

## Architecture

### Component Structure

The redesign focuses on modifying the video rendering logic within `ProductDetailScreen.tsx`. The architecture follows a component-based approach:

```
ProductDetailScreen
├── FlatList (media carousel)
│   ├── renderMediaItem (image items)
│   └── renderMediaItem (video items) ← PRIMARY MODIFICATION AREA
│       ├── VideoView (expo-video)
│       ├── Pressable (tap detection overlay)
│       ├── PlayButtonOverlay (conditional)
│       └── VideoBadge (optional indicator)
```

### State Management

Video playback state will be managed using React state within the ProductDetailScreen component:

- **videoPlayer**: Created via `useVideoPlayer` hook (already exists)
- **isVideoPlaying**: New boolean state to track play/pause status
- **currentMediaIndex**: Existing state for carousel position (already exists)

### Key Design Decisions

1. **No Separate Component**: Keep video rendering inline within `renderMediaItem` to avoid prop drilling and maintain access to existing state
2. **Overlay Pattern**: Use absolute positioning with a transparent Pressable to capture taps across the entire video area
3. **Disable Native Controls**: Set `nativeControls={false}` on VideoView to achieve minimal UI
4. **Manual Playback Control**: Use `videoPlayer.play()` and `videoPlayer.pause()` methods from useVideoPlayer hook
5. **React.memo Optimization**: Wrap expensive render functions to prevent unnecessary re-renders

## Components and Interfaces

### Modified renderMediaItem Function

The existing `renderMediaItem` function will be enhanced to support the minimal video UI:

```typescript
const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => {
  if (item.type === 'image') {
    // Existing image rendering (unchanged)
    return (
      <View style={[s.mediaItem, { width }]}>
        <SmartImage uri={item.url} style={s.mediaImage} />
      </View>
    );
  }

  if (item.type === 'video') {
    const isActive = currentMediaIndex === index;
    const isPlaying = isActive && isVideoPlaying;

    return (
      <View style={[s.mediaItem, { width }]}>
        {/* Dark gradient overlay for play button visibility */}
        <View style={s.videoGradientOverlay} />
        
        {/* Video player without native controls */}
        <VideoView
          player={videoPlayer}
          style={s.mediaVideo}
          nativeControls={false}
          contentFit="contain"
        />

        {/* Tap detection overlay */}
        <Pressable
          style={s.videoTapOverlay}
          onPress={handleVideoTap}
        >
          {/* Play button overlay (shown when paused) */}
          {!isPlaying && (
            <Animated.View style={[s.playButtonContainer, { opacity: playButtonOpacity }]}>
              <Pressable
                style={s.playButton}
                onPress={handleVideoTap}
              >
                <Ionicons name="play" size={32} color="#000" />
              </Pressable>
            </Animated.View>
          )}
        </Pressable>

        {/* Optional video indicator badge */}
        {showVideoBadge && (
          <View style={s.videoBadge}>
            <Ionicons name="videocam" size={12} color="#fff" />
            <Text style={s.videoBadgeText}>Video</Text>
          </View>
        )}
      </View>
    );
  }

  return null;
};
```

### New State Variables

```typescript
// Add to ProductDetailScreen component
const [isVideoPlaying, setIsVideoPlaying] = useState(false);
const playButtonOpacity = useRef(new Animated.Value(1)).current;
```

### New Handler Functions

```typescript
// Handle video tap for play/pause toggle
const handleVideoTap = useCallback(() => {
  if (isVideoPlaying) {
    videoPlayer.pause();
    setIsVideoPlaying(false);
    // Fade in play button
    Animated.timing(playButtonOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  } else {
    videoPlayer.play();
    setIsVideoPlaying(true);
    // Fade out play button
    Animated.timing(playButtonOpacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
      easing: Easing.in(Easing.ease),
    }).start();
  }
}, [isVideoPlaying, videoPlayer, playButtonOpacity]);
```

### MediaItem Type Definition

```typescript
type MediaItem = {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  duration?: number;
};
```

## Data Models

### Video State Model

```typescript
interface VideoState {
  isPlaying: boolean;        // Current playback state
  currentIndex: number;      // Active carousel index
  playButtonVisible: boolean; // Play button visibility
}
```

### Style Definitions

```typescript
// New styles to add to StyleSheet
const videoStyles = {
  videoGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 1,
  },
  videoTapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  videoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 3,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
};
```

## Error Handling

### Video Loading Errors

```typescript
// Add error state
const [videoError, setVideoError] = useState<string | null>(null);

// Modify useVideoPlayer initialization
const videoPlayer = useVideoPlayer(product?.video?.url || '', (player) => {
  player.loop = false;
  player.muted = false;
  
  // Handle errors
  player.addListener('statusChange', (status) => {
    if (status.error) {
      setVideoError('Failed to load video');
      console.error('Video error:', status.error);
    }
  });
});

// Render error state in video item
{videoError && (
  <View style={s.videoErrorContainer}>
    <Ionicons name="alert-circle" size={32} color="#B12704" />
    <Text style={s.videoErrorText}>{videoError}</Text>
  </View>
)}
```

### Carousel Synchronization

Ensure video pauses when scrolling away:

```typescript
// Modify existing useEffect for carousel synchronization
React.useEffect(() => {
  if (!product?.video?.url) return;
  
  const videoIndex = media.findIndex(item => item.type === 'video');
  if (videoIndex === -1) return;
  
  if (currentMediaIndex === videoIndex) {
    // Video is visible but don't autoplay
    // User must tap to play
  } else {
    // Video scrolled out of view - pause and reset state
    videoPlayer.pause();
    setIsVideoPlaying(false);
    playButtonOpacity.setValue(1);
  }
}, [currentMediaIndex, media, product?.video?.url]);
```

### Edge Cases

1. **No Video URL**: Gracefully skip video rendering if `product.video.url` is null/undefined
2. **Network Interruption**: Display loading indicator during buffering
3. **Rapid Taps**: Debounce tap handler to prevent state thrashing
4. **Component Unmount**: Clean up video player resources

```typescript
// Cleanup on unmount
React.useEffect(() => {
  return () => {
    videoPlayer.pause();
    videoPlayer.release();
  };
}, []);
```

## Testing Strategy

### Unit Testing Approach

The testing strategy focuses on component behavior, user interactions, and integration with the carousel system. Property-based testing is not applicable for this UI-focused feature.

#### Component Rendering Tests

Test that video components render correctly in different states:

```typescript
describe('Video Item Rendering', () => {
  it('should render VideoView without native controls', () => {
    // Verify nativeControls={false}
  });

  it('should display play button overlay when video is paused', () => {
    // Verify play button is visible
  });

  it('should hide play button overlay when video is playing', () => {
    // Verify play button is hidden
  });

  it('should render video badge when enabled', () => {
    // Verify badge appears in top corner
  });

  it('should apply dark gradient overlay', () => {
    // Verify overlay styling
  });
});
```

#### Interaction Tests

Test user interactions with the video player:

```typescript
describe('Video Playback Interactions', () => {
  it('should toggle play/pause when tapping video area', () => {
    // Simulate tap on Pressable overlay
    // Verify videoPlayer.play() or pause() called
    // Verify state updated
  });

  it('should toggle play/pause when tapping play button', () => {
    // Simulate tap on play button
    // Verify same behavior as tapping video area
  });

  it('should animate play button opacity on state change', () => {
    // Verify Animated.timing called with correct params
  });

  it('should apply scale animation on play button press', () => {
    // Verify pressable feedback
  });
});
```

#### Carousel Integration Tests

Test video behavior within the carousel:

```typescript
describe('Carousel Integration', () => {
  it('should pause video when scrolling to different media item', () => {
    // Change currentMediaIndex
    // Verify videoPlayer.pause() called
    // Verify isVideoPlaying set to false
  });

  it('should not autoplay when video becomes visible', () => {
    // Scroll to video item
    // Verify video remains paused
    // Verify play button is visible
  });

  it('should maintain square aspect ratio', () => {
    // Verify video container dimensions
  });

  it('should work with horizontal FlatList pagination', () => {
    // Verify no interference with pagination
  });
});
```

#### Performance Tests

Test optimization and re-render prevention:

```typescript
describe('Performance Optimization', () => {
  it('should not re-render when state has not changed', () => {
    // Use React.memo or similar
    // Verify render count
  });

  it('should release video resources when scrolled out of view', () => {
    // Verify cleanup behavior
  });

  it('should not create new function references on each render', () => {
    // Verify useCallback usage
  });
});
```

#### Animation Tests

Test smooth animations:

```typescript
describe('Animation Behavior', () => {
  it('should fade in play button over 250ms', () => {
    // Verify animation duration and easing
  });

  it('should fade out play button over 250ms', () => {
    // Verify animation duration and easing
  });

  it('should use native driver for animations', () => {
    // Verify useNativeDriver: true
  });
});
```

#### Error Handling Tests

Test error scenarios:

```typescript
describe('Error Handling', () => {
  it('should display error message when video fails to load', () => {
    // Mock video error
    // Verify error UI displayed
  });

  it('should handle missing video URL gracefully', () => {
    // Render with null video URL
    // Verify no crash
  });

  it('should clean up on component unmount', () => {
    // Unmount component
    // Verify videoPlayer.release() called
  });
});
```

### Integration Testing

Test the complete flow in the ProductDetailScreen:

1. **Media Carousel Flow**: Navigate through images and video, verify correct behavior
2. **State Persistence**: Ensure video state resets when navigating away and back
3. **Multiple Products**: Test switching between products with and without videos

### Manual Testing Checklist

- [ ] Video displays with minimal UI (no native controls)
- [ ] Play button appears centered when paused
- [ ] Tapping anywhere on video toggles play/pause
- [ ] Play button fades smoothly in/out
- [ ] Video pauses when scrolling to another media item
- [ ] Video does not autoplay when scrolled into view
- [ ] Square aspect ratio maintained
- [ ] Animations feel smooth and responsive
- [ ] No performance issues or jank
- [ ] Works on both iOS and Android
- [ ] Video badge displays correctly (if enabled)
- [ ] Error states display appropriately

### Testing Tools

- **Jest**: Unit testing framework
- **React Native Testing Library**: Component testing
- **fast-check**: Already installed but not needed for this UI feature
- **Manual Testing**: Physical devices (iOS and Android)

## Implementation Plan

### Phase 1: Core Video UI Changes

1. Remove `nativeControls` from VideoView
2. Add `isVideoPlaying` state variable
3. Implement `handleVideoTap` function
4. Add Pressable overlay for tap detection
5. Create play button overlay component

### Phase 2: Animation Implementation

1. Add Animated.Value for play button opacity
2. Implement fade in/out animations
3. Add scale animation for button press feedback
4. Test animation smoothness

### Phase 3: Carousel Integration

1. Update useEffect for carousel synchronization
2. Ensure video pauses when scrolling away
3. Prevent autoplay when video becomes visible
4. Test pagination behavior

### Phase 4: Polish and Optimization

1. Add dark gradient overlay
2. Implement optional video badge
3. Apply React.memo optimizations
4. Add error handling
5. Test performance

### Phase 5: Testing and Validation

1. Write unit tests
2. Write integration tests
3. Perform manual testing on devices
4. Validate against all acceptance criteria
5. Performance profiling

## Migration Notes

### Breaking Changes

None. This is a visual redesign that maintains the same API and data structures.

### Backward Compatibility

The changes are fully backward compatible:
- Existing media array structure unchanged
- Carousel navigation unchanged
- Product data model unchanged

### Rollout Strategy

1. Implement changes in development environment
2. Test thoroughly on staging
3. Deploy to production with feature flag (optional)
4. Monitor for issues
5. Gather user feedback

## Dependencies

### Required Libraries

- `expo-video` (v55.0.15) - Already installed
- `react-native` (0.83.2) - Already installed
- `expo-linear-gradient` (v55.0.9) - Already installed (for gradient overlay)
- `@expo/vector-icons` - Already installed (for play icon)

### No New Dependencies Required

All necessary libraries are already present in the project.

## Performance Considerations

### Optimization Strategies

1. **useCallback for Handlers**: Prevent function recreation on each render
2. **React.memo**: Memoize expensive components
3. **Native Driver**: Use native driver for animations (60fps)
4. **Conditional Rendering**: Only render play button when needed
5. **Resource Cleanup**: Release video player on unmount

### Memory Management

- Pause video when not visible to reduce memory usage
- Release video player resources on component unmount
- Avoid storing large video data in state

### Rendering Performance

- Minimize re-renders by using proper state management
- Use `getItemLayout` for FlatList optimization (already implemented)
- Avoid inline style objects (use StyleSheet.create)

## Accessibility Considerations

### Screen Reader Support

```typescript
<Pressable
  style={s.videoTapOverlay}
  onPress={handleVideoTap}
  accessible={true}
  accessibilityLabel={isVideoPlaying ? "Pause video" : "Play video"}
  accessibilityRole="button"
  accessibilityHint="Double tap to toggle video playback"
>
```

### Visual Indicators

- High contrast play button (white on dark overlay)
- Clear visual feedback on button press
- Sufficient touch target size (64x64 minimum)

## Future Enhancements

Potential improvements for future iterations:

1. **Seek Functionality**: Add minimal seek bar that appears on tap
2. **Volume Control**: Add mute/unmute button
3. **Fullscreen Mode**: Support fullscreen video playback
4. **Playback Speed**: Allow speed adjustment
5. **Captions**: Support for video captions/subtitles
6. **Picture-in-Picture**: Continue playback while browsing
7. **Video Quality Selection**: Allow quality switching for bandwidth management

## References

- [expo-video Documentation](https://docs.expo.dev/versions/latest/sdk/video/)
- [React Native Animated API](https://reactnative.dev/docs/animated)
- [React Native Pressable](https://reactnative.dev/docs/pressable)
- [Amazon Product Page UX Patterns](https://www.amazon.com/)
