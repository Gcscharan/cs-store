# Design Document: Product Video User Display Fix

## Overview

This design document addresses the bugfix where product videos uploaded by admins are not visible to users on the ProductDetailPage. The admin upload flow works correctly and videos are stored in the database with complete metadata (url, thumbnail, publicId, hash, duration), but the user-facing ProductDetailPage lacks any video rendering code.

This is a display-only fix - no changes to the backend, database, or admin upload flow are required. We will add video display functionality to ProductDetailPage.tsx using patterns from the existing VideoUpload component.

## Bug Condition Specification

### Bug Condition (C)

The bug condition identifies inputs that trigger the defect:

```typescript
function isBugCondition(product: Product): boolean {
  return product.video !== null && 
         product.video !== undefined &&
         typeof product.video.url === 'string' &&
         product.video.url.length > 0;
}
```

**Explanation:** The bug occurs when a product has valid video metadata in the database. In this case, the ProductDetailPage should display the video but currently does not.

**Concrete Examples:**
- Product with video: `{ _id: "123", name: "Test Product", video: { url: "https://...", thumbnail: "https://...", duration: 15.5 } }`
- Product with video but no thumbnail: `{ _id: "456", name: "Another Product", video: { url: "https://...", thumbnail: "", duration: 10 } }`

### Expected Behavior Properties (P)

For all products where `isBugCondition(product)` is true, the following properties must hold:

**Property 1: Video Thumbnail Display**
```typescript
function hasVideoThumbnailDisplay(page: ProductDetailPage, product: Product): boolean {
  const videoSection = page.querySelector('[data-testid="video-section"]');
  const thumbnail = videoSection?.querySelector('img[alt*="video"]');
  const playIcon = videoSection?.querySelector('[data-testid="play-icon"]');
  
  return videoSection !== null &&
         thumbnail !== null &&
         thumbnail.src === product.video.thumbnail &&
         playIcon !== null;
}
```

**Property 2: Video Duration Display**
```typescript
function hasVideoDurationDisplay(page: ProductDetailPage, product: Product): boolean {
  const videoSection = page.querySelector('[data-testid="video-section"]');
  const durationElement = videoSection?.querySelector('[data-testid="video-duration"]');
  
  return durationElement !== null &&
         durationElement.textContent.includes(product.video.duration.toFixed(1));
}
```

**Property 3: Video Playback Capability**
```typescript
function hasVideoPlaybackCapability(page: ProductDetailPage, product: Product): boolean {
  const videoSection = page.querySelector('[data-testid="video-section"]');
  const clickableElement = videoSection?.querySelector('[data-testid="video-thumbnail"]');
  
  // Should have click handler that loads video player
  return clickableElement !== null &&
         clickableElement.onclick !== null;
}
```

**Property 4: Lazy Loading**
```typescript
function usesLazyLoading(page: ProductDetailPage): boolean {
  const videoPlayer = page.querySelector('video');
  
  // Video player should not exist until user clicks thumbnail
  return videoPlayer === null;
}
```

**Property 5: No Broken Placeholders**
```typescript
function noVideoBrokenState(page: ProductDetailPage, product: Product): boolean {
  if (!isBugCondition(product)) {
    const videoSection = page.querySelector('[data-testid="video-section"]');
    return videoSection === null; // No video section if no video
  }
  return true;
}
```

## Preservation Requirements

### Non-Bug Condition (¬C)

Products that should maintain existing behavior:

```typescript
function isNonBugCondition(product: Product): boolean {
  return product.video === null || 
         product.video === undefined ||
         product.video.url === '' ||
         product.video.url === null;
}
```

**Explanation:** Products without video metadata should continue to work exactly as they do now - no video section displayed, no errors, no broken placeholders.

### Preservation Properties

For all products where `isNonBugCondition(product)` is true, the following must remain unchanged:

**Preservation 1: No Video Section for Products Without Video**
```typescript
function noVideoSectionWhenNoVideo(page: ProductDetailPage, product: Product): boolean {
  if (isNonBugCondition(product)) {
    const videoSection = page.querySelector('[data-testid="video-section"]');
    return videoSection === null;
  }
  return true;
}
```

**Preservation 2: Image Display Unchanged**
```typescript
function imageDisplayUnchanged(page: ProductDetailPage, product: Product): boolean {
  const imageSection = page.querySelector('.aspect-square'); // Main product image
  const optimizedImage = imageSection?.querySelector('img');
  
  return imageSection !== null &&
         optimizedImage !== null &&
         optimizedImage.src.includes(product.images[0].thumb || product.images[0].full);
}
```

**Preservation 3: Add to Cart Functionality Unchanged**
```typescript
function addToCartUnchanged(page: ProductDetailPage): boolean {
  const addToCartButton = page.querySelector('button:has(ShoppingCart)');
  
  return addToCartButton !== null &&
         addToCartButton.onclick !== null;
}
```

**Preservation 4: Product Details Display Unchanged**
```typescript
function productDetailsUnchanged(page: ProductDetailPage, product: Product): boolean {
  const productName = page.querySelector('h1');
  const productPrice = page.querySelector('.text-3xl.font-bold');
  const productDescription = page.querySelector('p.text-gray-700');
  
  return productName?.textContent === product.name &&
         productPrice?.textContent.includes(product.price.toString()) &&
         productDescription?.textContent === product.description;
}
```

**Preservation 5: Reviews Section Unchanged**
```typescript
function reviewsSectionUnchanged(page: ProductDetailPage): boolean {
  const reviewsSection = page.querySelector('h2:contains("Customer Reviews")');
  const reviewForm = page.querySelector('h3:contains("Write a Review")');
  
  return reviewsSection !== null &&
         reviewForm !== null;
}
```

**Preservation 6: Similar Products Unchanged**
```typescript
function similarProductsUnchanged(page: ProductDetailPage): boolean {
  const similarSection = page.querySelector('h2:contains("Similar Products")');
  
  return similarSection !== null;
}
```

**Preservation 7: Layout and Responsive Design Unchanged**
```typescript
function layoutUnchanged(page: ProductDetailPage): boolean {
  const mainGrid = page.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2');
  const productMedia = mainGrid?.querySelector('.space-y-4');
  const productInfo = mainGrid?.querySelectorAll('.space-y-6')[0];
  
  return mainGrid !== null &&
         productMedia !== null &&
         productInfo !== null;
}
```

## Implementation Approach

### Component Structure

We will add a video display section to ProductDetailPage.tsx that:
1. Conditionally renders only when `product.video` exists
2. Displays video thumbnail with play icon overlay
3. Shows video duration in bottom-right corner
4. Implements lazy loading (video player loads on click)
5. Uses existing patterns from VideoUpload component

### Video Section Location

The video section will be placed in the "Product Media" column, below the main product image and above the "Add to Cart" section:

```
Product Media Column (Left Side)
├── Main Product Image (existing)
├── Video Section (NEW - conditional)
│   ├── Video Thumbnail
│   ├── Play Icon Overlay
│   ├── Duration Badge
│   └── Click Handler (lazy load player)
└── Add to Cart Section (existing)
```

### State Management

```typescript
// Add video player state
const [showVideoPlayer, setShowVideoPlayer] = useState(false);

// Handler to show video player
const handleVideoClick = () => {
  setShowVideoPlayer(true);
};
```

### Video Display Component

```typescript
// Conditional video section
{product?.video && (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden" data-testid="video-section">
    {!showVideoPlayer ? (
      // Thumbnail view
      <div 
        className="relative cursor-pointer group"
        onClick={handleVideoClick}
        data-testid="video-thumbnail"
      >
        <img
          src={product.video.thumbnail}
          alt={`${getTranslatedName(product)} video`}
          className="w-full aspect-video object-cover"
        />
        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-all">
          <div className="bg-white rounded-full p-4 group-hover:scale-110 transition-transform" data-testid="play-icon">
            <Play className="h-8 w-8 text-blue-600 fill-current" />
          </div>
        </div>
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm font-medium" data-testid="video-duration">
          {product.video.duration.toFixed(1)}s
        </div>
      </div>
    ) : (
      // Video player view (lazy loaded)
      <div className="relative">
        <video
          src={product.video.url}
          controls
          autoPlay
          className="w-full aspect-video"
          poster={product.video.thumbnail}
        >
          Your browser does not support the video tag.
        </video>
        <button
          onClick={() => setShowVideoPlayer(false)}
          className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    )}
  </div>
)}
```

### Type Safety

Ensure Product interface includes video field:

```typescript
interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: Array<{ full: string; thumb: string }>;
  video?: {
    url: string;
    thumbnail: string;
    publicId: string;
    hash?: string;
    duration: number;
  };
  // ... other fields
}
```

## Testing Strategy

### Bug Condition Exploration Test (Property 1)

**Goal:** Confirm the bug exists by testing on UNFIXED code

**Test Approach:**
- Scope property to concrete failing case: product with video metadata
- Test that video section does NOT exist (current defect)
- Run on UNFIXED code - expect FAILURE
- Document counterexamples

**Expected Outcome on Unfixed Code:** Test FAILS (confirms bug exists)

**Expected Outcome After Fix:** Test PASSES (confirms bug is fixed)

### Preservation Tests (Property 2)

**Goal:** Ensure non-buggy behavior is preserved

**Test Approach:**
- Observe behavior on UNFIXED code for products without video
- Write property-based tests capturing observed behavior
- Verify tests PASS on UNFIXED code
- After fix, verify tests still PASS

**Expected Outcome on Unfixed Code:** Tests PASS (baseline behavior)

**Expected Outcome After Fix:** Tests still PASS (no regressions)

### Test Cases

**Bug Condition Tests:**
1. Product with video shows thumbnail
2. Product with video shows play icon
3. Product with video shows duration
4. Clicking thumbnail loads video player
5. Video player not loaded until click (lazy loading)

**Preservation Tests:**
1. Product without video shows no video section
2. Product images display correctly (unchanged)
3. Add to cart works (unchanged)
4. Product details display correctly (unchanged)
5. Reviews section works (unchanged)
6. Similar products display (unchanged)
7. Layout remains responsive (unchanged)

## Accessibility Considerations

- Video thumbnail has descriptive alt text
- Play button has aria-label
- Video player has native controls
- Keyboard navigation supported
- Screen reader announces video availability
- Focus indicators visible

## Performance Considerations

- Lazy loading: video player only loads on user interaction
- Thumbnail optimized by Cloudinary
- No impact on page load time
- Video section conditionally rendered (no overhead for products without video)

## Security Considerations

- Video URLs from trusted source (Cloudinary)
- No user-provided video metadata
- No XSS risk (all data from backend)
- Video playback uses native browser controls

## Rollback Plan

If issues arise:
1. Remove video section from ProductDetailPage
2. Remove video state management
3. No data loss (video metadata remains in database)
4. Admin upload flow unaffected

## Future Enhancements

- Video preview on hover
- Multiple videos per product
- Video quality selection
- Video analytics tracking
- Picture-in-picture support
