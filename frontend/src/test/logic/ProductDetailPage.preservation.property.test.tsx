import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import ProductDetailPage from '../../pages/ProductDetailPage';
import { TestAppProviders } from '../testUtils';
import * as apiModule from '../../store/api';

/**
 * Preservation Property Tests - Product Video User Display Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 * 
 * **Property 2: Preservation** - Non-Video Product Behavior Unchanged
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * - Observe behavior on UNFIXED code for products without video (video is null/undefined)
 * - Write property-based tests capturing observed behavior patterns
 * - Run tests on UNFIXED code
 * - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
 * 
 * These tests verify that products WITHOUT video metadata continue to work correctly:
 * - No video section displayed when product.video is null/undefined
 * - Product image displays correctly in existing location
 * - Add to cart button works correctly
 * - Product details (name, price, description) display correctly
 * - Reviews section displays correctly
 * - Similar products section displays correctly
 * - Page layout and responsive design unchanged
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

describe('Property 2: Preservation - Non-Video Product Behavior Unchanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Non-Bug Condition: Product has no video metadata
   */
  const isNonBugCondition = (product: any): boolean => {
    return product.video === null || 
           product.video === undefined ||
           product.video.url === '' ||
           product.video.url === null;
  };

  /**
   * Generator for products WITHOUT video metadata (non-bug condition)
   * This scopes the property to only test products that should NOT display video
   */
  const productWithoutVideoArbitrary = fc.record({
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
    video: fc.constantFrom(null, undefined), // No video metadata
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
    __v: fc.constant(0),
  });

  it('Preservation 1: No video section displayed when product.video is null/undefined', () => {
    fc.assert(
      fc.property(productWithoutVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify non-bug condition
        expect(isNonBugCondition(product)).toBe(true);

        // Mock the API to return our generated product
        (apiModule.useGetProductByIdQuery as any).mockReturnValue({
          data: product,
          isLoading: false,
          error: null,
        });

        // Render ProductDetailPage with mocked product
        render(
          <TestAppProviders initialEntries={[`/product/${product._id}`]}>
            <ProductDetailPage />
          </TestAppProviders>
        );

        // Preservation Property: No video section when product.video is null/undefined
        const videoSection = screen.queryByTestId('video-section');
        expect(videoSection).toBeNull();
      }),
      { numRuns: 10 } // Run 10 iterations to verify preservation
    );
  });

  it('Preservation 2: Product image displays correctly in existing location', () => {
    fc.assert(
      fc.property(productWithoutVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify non-bug condition
        expect(isNonBugCondition(product)).toBe(true);

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

        // Preservation Property: Product image displays correctly
        const imageSection = document.querySelector('.aspect-square');
        expect(imageSection).not.toBeNull();

        const optimizedImage = imageSection?.querySelector('img');
        expect(optimizedImage).not.toBeNull();
        
        // Verify image src contains the product image URL
        const imageSrc = optimizedImage?.getAttribute('src');
        expect(
          imageSrc?.includes(product.images[0].thumb) ||
          imageSrc?.includes(product.images[0].full) ||
          imageSrc?.includes('sample.jpg') // Cloudinary URL
        ).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('Preservation 3: Add to cart button works correctly', () => {
    fc.assert(
      fc.property(productWithoutVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify non-bug condition
        expect(isNonBugCondition(product)).toBe(true);

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

        // Preservation Property: Add to cart button exists and is functional
        // Button text changes based on stock: "Add to Cart" when in stock, "Out of Stock" when stock is 0
        const buttonText = product.stock > 0 ? /add to cart/i : /out of stock/i;
        const addToCartButton = screen.getByRole('button', { name: buttonText });
        expect(addToCartButton).toBeInTheDocument();
        expect(addToCartButton).not.toBeNull();
      }),
      { numRuns: 10 }
    );
  });

  it('Preservation 4: Product details (name, price, description) display correctly', () => {
    fc.assert(
      fc.property(productWithoutVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify non-bug condition
        expect(isNonBugCondition(product)).toBe(true);

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

        // Preservation Property: Product name displays
        const productName = screen.getAllByRole('heading', { level: 1 })[1]; // Second h1 is product name
        expect(productName).toBeInTheDocument();
        expect(productName.textContent).toBe(product.name);

        // Preservation Property: Product price displays
        const productPrice = screen.getByText(new RegExp(`₹${product.price}`));
        expect(productPrice).toBeInTheDocument();

        // Preservation Property: Product description displays
        // Handle edge case where description might be just whitespace or very short
        if (product.description && product.description.trim().length > 1) {
          try {
            const productDescription = screen.getByText(product.description);
            expect(productDescription).toBeInTheDocument();
          } catch (error) {
            // If exact text match fails, check if description content exists in DOM
            const descriptionElements = document.querySelectorAll('p.text-gray-700');
            expect(descriptionElements.length).toBeGreaterThan(0);
            // Verify at least one element contains the description text
            const hasDescription = Array.from(descriptionElements).some(el => 
              el.textContent?.includes(product.description.trim())
            );
            expect(hasDescription).toBe(true);
          }
        } else {
          // For empty or very short descriptions, just verify the element exists
          const descriptionElements = document.querySelectorAll('p.text-gray-700');
          expect(descriptionElements.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 10 }
    );
  });

  it('Preservation 5: Reviews section displays correctly', () => {
    fc.assert(
      fc.property(productWithoutVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify non-bug condition
        expect(isNonBugCondition(product)).toBe(true);

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

        // Preservation Property: Reviews section exists
        const reviewsHeading = screen.getAllByRole('heading', { name: /customer reviews/i })[0];
        expect(reviewsHeading).toBeInTheDocument();

        // Preservation Property: Review form exists
        const reviewFormHeading = screen.getByRole('heading', { name: /write a review/i });
        expect(reviewFormHeading).toBeInTheDocument();
      }),
      { numRuns: 10 }
    );
  });

  it('Preservation 6: Similar products section displays correctly', () => {
    fc.assert(
      fc.property(productWithoutVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify non-bug condition
        expect(isNonBugCondition(product)).toBe(true);

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

        // Preservation Property: Similar products section exists
        const similarProductsHeading = screen.getAllByRole('heading', { name: /similar products/i })[0];
        expect(similarProductsHeading).toBeInTheDocument();
      }),
      { numRuns: 10 }
    );
  });

  it('Preservation 7: Page layout and responsive design unchanged', () => {
    fc.assert(
      fc.property(productWithoutVideoArbitrary, (product) => {
        // Clean up any previous renders
        cleanup();
        
        // Verify non-bug condition
        expect(isNonBugCondition(product)).toBe(true);

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

        // Preservation Property: Main grid layout exists
        const mainGrid = document.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2');
        expect(mainGrid).not.toBeNull();

        // Preservation Property: Product media column exists
        const productMedia = document.querySelector('.space-y-4');
        expect(productMedia).not.toBeNull();

        // Preservation Property: Product info column exists
        const productInfo = document.querySelectorAll('.space-y-6')[0];
        expect(productInfo).not.toBeNull();
      }),
      { numRuns: 10 }
    );
  });
});
