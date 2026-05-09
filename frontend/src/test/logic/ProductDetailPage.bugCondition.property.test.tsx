import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import ProductDetailPage from '../../pages/ProductDetailPage';
import { TestAppProviders } from '../testUtils';
import * as apiModule from '../../store/api';

/**
 * Bug Condition Exploration Property Test - Product Video User Display Fix
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
 * 
 * **Property 1: Bug Condition** - Video Display Missing for Products with Video
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * **GOAL**: Surface counterexamples that demonstrate the bug exists
 * 
 * **Scoped PBT Approach**: Scope the property to products with valid video metadata (video.url exists and is non-empty)
 */

// Mock the API hooks
vi.mock('../../store/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useGetProductByIdQuery: vi.fn(),
    useAddToCartMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
    useGetSimilarProductsQuery: vi.fn(() => ({
      data: { products: [] },
      isLoading: false,
      error: null,
    })),
  };
});

describe('Property 1: Bug Condition - Video Display Missing for Products with Video', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup(); // Clean up DOM between tests
  });
  /**
   * Bug Condition: Product has valid video metadata
   */
  const isBugCondition = (product: any): boolean => {
    return product.video !== null && 
           product.video !== undefined &&
           typeof product.video.url === 'string' &&
           product.video.url.length > 0;
  };

  /**
   * Generator for products with valid video metadata (bug condition)
   * This scopes the property to only test products that should display video
   */
  const productWithVideoArbitrary = fc.record({
    _id: fc.string({ minLength: 1 }),
    id: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    description: fc.string({ minLength: 1 }),
    price: fc.integer({ min: 1, max: 10000 }),
    mrp: fc.integer({ min: 1, max: 10000 }),
    category: fc.constantFrom('Electronics', 'Clothing', 'Food', 'Books'),
    stock: fc.integer({ min: 0, max: 1000 }),
    images: fc.array(
      fc.record({
        full: fc.constant('https://res.cloudinary.com/demo/image/upload/sample.jpg'),
        thumb: fc.constant('https://res.cloudinary.com/demo/image/upload/c_thumb,w_200/sample.jpg'),
      }),
      { minLength: 1, maxLength: 3 }
    ),
    video: fc.record({
      url: fc.constant('https://res.cloudinary.com/demo/video/upload/sample.mp4'),
      thumbnail: fc.constant('https://res.cloudinary.com/demo/video/upload/sample.jpg'),
      publicId: fc.string({ minLength: 1 }),
      hash: fc.option(fc.string({ minLength: 1 })),
      duration: fc.float({ min: 1, max: 30 }),
    }),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
    __v: fc.constant(0),
  });

  it('Feature: product-video-user-display-fix, Property 1: Video section exists with data-testid="video-section"', () => {
    fc.assert(
      fc.property(productWithVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify bug condition
        expect(isBugCondition(product)).toBe(true);

        // Mock the API to return our generated product
        (apiModule.useGetProductByIdQuery as any).mockReturnValue({
          data: product,
          isLoading: false,
          error: null,
        });

        // Render ProductDetailPage with mocked product
        // Note: This will fail on unfixed code because video section doesn't exist yet
        render(
          <TestAppProviders initialEntries={[`/product/${product._id}`]}>
            <ProductDetailPage />
          </TestAppProviders>
        );

        // Expected Behavior Property 1: Video section exists with data-testid="video-section"
        // This will FAIL on unfixed code (confirming the bug exists)
        const videoSection = screen.queryByTestId('video-section');
        expect(videoSection).not.toBeNull();
        expect(videoSection).toBeInTheDocument();
      }),
      { numRuns: 10 } // Run 10 iterations to find counterexamples
    );
  });

  it('Property 1: Video thumbnail displays with correct src (product.video.thumbnail)', () => {
    fc.assert(
      fc.property(productWithVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify bug condition
        expect(isBugCondition(product)).toBe(true);

        // Mock the API to return our generated product
        (apiModule.useGetProductByIdQuery as any).mockReturnValue({
          data: product,
          isLoading: false,
          error: null,
        });

        // Render ProductDetailPage
        render(
          <TestAppProviders initialEntries={[`/product/${product._id}`]}>
            <ProductDetailPage />
          </TestAppProviders>
        );

        // Expected Behavior: Video thumbnail displays with correct src
        const videoSection = screen.queryByTestId('video-section');
        expect(videoSection).not.toBeNull();

        const thumbnail = videoSection?.querySelector('img[alt*="video"]');
        expect(thumbnail).not.toBeNull();
        expect(thumbnail?.getAttribute('src')).toBe(product.video.thumbnail);
      }),
      { numRuns: 10 }
    );
  });

  it('Property 1: Play icon overlay exists with data-testid="play-icon"', () => {
    fc.assert(
      fc.property(productWithVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify bug condition
        expect(isBugCondition(product)).toBe(true);

        // Mock the API to return our generated product
        (apiModule.useGetProductByIdQuery as any).mockReturnValue({
          data: product,
          isLoading: false,
          error: null,
        });

        // Render ProductDetailPage
        render(
          <TestAppProviders initialEntries={[`/product/${product._id}`]}>
            <ProductDetailPage />
          </TestAppProviders>
        );

        // Expected Behavior: Play icon overlay exists
        const videoSection = screen.queryByTestId('video-section');
        expect(videoSection).not.toBeNull();

        const playIcon = screen.queryByTestId('play-icon');
        expect(playIcon).not.toBeNull();
        expect(playIcon).toBeInTheDocument();
      }),
      { numRuns: 10 }
    );
  });

  it('Property 1: Duration badge displays with correct duration (product.video.duration)', () => {
    fc.assert(
      fc.property(productWithVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify bug condition
        expect(isBugCondition(product)).toBe(true);

        // Mock the API to return our generated product
        (apiModule.useGetProductByIdQuery as any).mockReturnValue({
          data: product,
          isLoading: false,
          error: null,
        });

        // Render ProductDetailPage
        render(
          <TestAppProviders initialEntries={[`/product/${product._id}`]}>
            <ProductDetailPage />
          </TestAppProviders>
        );

        // Expected Behavior: Duration badge displays with correct duration
        const videoSection = screen.queryByTestId('video-section');
        expect(videoSection).not.toBeNull();

        const durationBadge = screen.queryByTestId('video-duration');
        expect(durationBadge).not.toBeNull();
        expect(durationBadge?.textContent).toContain(product.video.duration.toFixed(1));
      }),
      { numRuns: 10 }
    );
  });

  it('Property 1: Video thumbnail is clickable (has click handler)', () => {
    fc.assert(
      fc.property(productWithVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify bug condition
        expect(isBugCondition(product)).toBe(true);

        // Mock the API to return our generated product
        (apiModule.useGetProductByIdQuery as any).mockReturnValue({
          data: product,
          isLoading: false,
          error: null,
        });

        // Render ProductDetailPage
        render(
          <TestAppProviders initialEntries={[`/product/${product._id}`]}>
            <ProductDetailPage />
          </TestAppProviders>
        );

        // Expected Behavior: Video thumbnail is clickable
        const videoSection = screen.queryByTestId('video-section');
        expect(videoSection).not.toBeNull();

        const videoThumbnail = screen.queryByTestId('video-thumbnail');
        expect(videoThumbnail).not.toBeNull();
        
        // Check if element has click handler (cursor-pointer class or onclick)
        expect(
          videoThumbnail?.classList.contains('cursor-pointer') ||
          videoThumbnail?.onclick !== null
        ).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('Property 1: Video player not loaded until click (lazy loading)', () => {
    fc.assert(
      fc.property(productWithVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify bug condition
        expect(isBugCondition(product)).toBe(true);

        // Mock the API to return our generated product
        (apiModule.useGetProductByIdQuery as any).mockReturnValue({
          data: product,
          isLoading: false,
          error: null,
        });

        // Render ProductDetailPage
        render(
          <TestAppProviders initialEntries={[`/product/${product._id}`]}>
            <ProductDetailPage />
          </TestAppProviders>
        );

        // Expected Behavior: Video player should not exist until user clicks thumbnail
        const videoPlayer = document.querySelector('video');
        expect(videoPlayer).toBeNull();
      }),
      { numRuns: 10 }
    );
  });
});
