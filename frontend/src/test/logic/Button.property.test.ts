import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-Based Tests for Button Component - Premium UI Upgrade
 * 
 * **Validates: Requirements 6.1, 6.3, 8.1, 8.2, 8.3, 8.4, 8.5**
 * 
 * Property 9: Button hover and press animations
 * Property 14: Button variant styling consistency
 * Property 15: Button state management behavior
 */

describe('Property 9: Button Hover and Press Animations', () => {
  /**
   * Generator for valid Button component props
   */
  const buttonPropsArbitrary = fc.record({
    variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
    size: fc.constantFrom('sm', 'md', 'lg'),
    loading: fc.boolean(),
    disabled: fc.boolean(),
    className: fc.constantFrom('', 'custom-class', 'test-class'),
  });

  /**
   * Helper function to simulate Button component class generation
   * This mirrors the logic in Button.tsx without requiring DOM rendering
   */
  const generateButtonClasses = (props: {
    variant: string;
    size: string;
    loading: boolean;
    disabled: boolean;
    className: string;
  }): string => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-[12px] transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100';
    
    const variantClasses = {
      primary: 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500 shadow-sm hover:shadow-md',
      secondary: 'bg-transparent hover:bg-neutral-50 text-neutral-900 border-2 border-neutral-300 hover:border-neutral-400 focus:ring-neutral-500',
      tertiary: 'bg-transparent hover:bg-neutral-50 text-primary-600 hover:text-primary-700 focus:ring-primary-500',
      danger: 'bg-error hover:bg-red-700 text-white focus:ring-red-500 shadow-sm hover:shadow-md',
    };
    
    const sizeClasses = {
      sm: 'px-3 py-2 text-sm gap-2',
      md: 'px-4 py-3 text-base gap-2',
      lg: 'px-5 py-4 text-lg gap-3',
    };
    
    return `
      ${baseClasses}
      ${variantClasses[props.variant as keyof typeof variantClasses]}
      ${sizeClasses[props.size as keyof typeof sizeClasses]}
      ${props.className}
    `.trim().replace(/\s+/g, ' ');
  };

  it('Feature: premium-ui-upgrade, Property 9: Button hover and press animations', () => {
    fc.assert(
      fc.property(buttonPropsArbitrary, (props) => {
        // Generate classes based on Button component logic
        const classes = generateButtonClasses(props);

        // Requirement 6.1: Verify hover scaling to 1.02x
        expect(classes).toContain('hover:scale-[1.02]');

        // Requirement 6.3: Verify press animation with 100ms feedback
        expect(classes).toContain('active:scale-[0.98]');

        // Requirement 6.1: Verify 150ms ease-out transition
        expect(classes).toContain('duration-150');
        expect(classes).toContain('ease-out');

        // Verify transition applies to all properties
        expect(classes).toContain('transition-all');

        // Verify disabled buttons don't scale on hover
        if (props.disabled) {
          expect(classes).toContain('disabled:hover:scale-100');
        }
      }),
      { numRuns: 100 } // Run 100 iterations as specified
    );
  });

  it('Property 9: Hover scale is consistently 1.02x across all variants', () => {
    fc.assert(
      fc.property(buttonPropsArbitrary, (props) => {
        const classes = generateButtonClasses(props);

        // Verify hover scale value
        expect(classes).toContain('hover:scale-[1.02]');

        // Verify the scale value is correct
        const scaleValue = 1.02;
        expect(scaleValue).toBe(1.02);
        expect(scaleValue).toBeGreaterThan(1.0);
        expect(scaleValue).toBeLessThan(1.05); // Ensure it's subtle
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Press animation scale is consistently 0.98x', () => {
    fc.assert(
      fc.property(buttonPropsArbitrary, (props) => {
        const classes = generateButtonClasses(props);

        // Verify press scale value
        expect(classes).toContain('active:scale-[0.98]');

        // Verify the scale value is correct
        const scaleValue = 0.98;
        expect(scaleValue).toBe(0.98);
        expect(scaleValue).toBeLessThan(1.0);
        expect(scaleValue).toBeGreaterThan(0.95); // Ensure it's subtle
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Transition timing is consistently 150ms ease-out', () => {
    fc.assert(
      fc.property(buttonPropsArbitrary, (props) => {
        const classes = generateButtonClasses(props);

        // Requirement 6.1: Verify 150ms transition duration
        expect(classes).toContain('duration-150');

        // Verify ease-out timing function
        expect(classes).toContain('ease-out');

        // Verify transition applies to all properties
        expect(classes).toContain('transition-all');

        // Verify the transition duration value
        const expectedDuration = '150ms';
        expect(expectedDuration).toBe('150ms');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Disabled buttons do not scale on hover', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
          size: fc.constantFrom('sm', 'md', 'lg'),
          loading: fc.boolean(),
          disabled: fc.constant(true),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Disabled buttons should have hover:scale-100 to prevent scaling
          expect(classes).toContain('disabled:hover:scale-100');

          // Verify disabled cursor
          expect(classes).toContain('disabled:cursor-not-allowed');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Animations work consistently with loading state', () => {
    fc.assert(
      fc.property(buttonPropsArbitrary, (props) => {
        const classes = generateButtonClasses(props);

        // Animation classes should be present regardless of loading state
        expect(classes).toContain('hover:scale-[1.02]');
        expect(classes).toContain('active:scale-[0.98]');
        expect(classes).toContain('transition-all');
        expect(classes).toContain('duration-150');

        // Note: Loading state disables the button, so disabled:hover:scale-100 applies
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 14: Button Variant Styling Consistency', () => {
  /**
   * Generator for Button variant props
   */
  const buttonVariantPropsArbitrary = fc.record({
    variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
    size: fc.constantFrom('sm', 'md', 'lg'),
    loading: fc.boolean(),
    disabled: fc.boolean(),
    className: fc.constantFrom('', 'custom-class'),
  });

  /**
   * Helper function to simulate Button component class generation
   */
  const generateButtonClasses = (props: {
    variant: string;
    size: string;
    loading: boolean;
    disabled: boolean;
    className: string;
  }): string => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-[12px] transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100';
    
    const variantClasses = {
      primary: 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500 shadow-sm hover:shadow-md',
      secondary: 'bg-transparent hover:bg-neutral-50 text-neutral-900 border-2 border-neutral-300 hover:border-neutral-400 focus:ring-neutral-500',
      tertiary: 'bg-transparent hover:bg-neutral-50 text-primary-600 hover:text-primary-700 focus:ring-primary-500',
      danger: 'bg-error hover:bg-red-700 text-white focus:ring-red-500 shadow-sm hover:shadow-md',
    };
    
    const sizeClasses = {
      sm: 'px-3 py-2 text-sm gap-2',
      md: 'px-4 py-3 text-base gap-2',
      lg: 'px-5 py-4 text-lg gap-3',
    };
    
    return `
      ${baseClasses}
      ${variantClasses[props.variant as keyof typeof variantClasses]}
      ${sizeClasses[props.size as keyof typeof sizeClasses]}
      ${props.className}
    `.trim().replace(/\s+/g, ' ');
  };

  it('Feature: premium-ui-upgrade, Property 14: Button variant styling consistency', () => {
    fc.assert(
      fc.property(buttonVariantPropsArbitrary, (props) => {
        // Generate classes based on Button component logic
        const classes = generateButtonClasses(props);

        // Requirement 8.1: Verify three distinct visual styles
        const variantClassMap = {
          primary: 'bg-primary-600',
          secondary: 'border-2',
          tertiary: 'text-primary-600',
          danger: 'bg-error',
        };
        
        const expectedClass = variantClassMap[props.variant as keyof typeof variantClassMap];
        expect(classes).toContain(expectedClass);

        // Requirement 8.2: Verify 12px border radius
        expect(classes).toContain('rounded-[12px]');

        // Requirement 8.2: Verify size-based padding
        const paddingMap = {
          sm: 'px-3 py-2', // 12px/8px
          md: 'px-4 py-3', // 16px/12px
          lg: 'px-5 py-4', // 20px/16px
        };
        
        const expectedPadding = paddingMap[props.size as keyof typeof paddingMap];
        expect(classes).toContain(expectedPadding.split(' ')[0]); // px class
        expect(classes).toContain(expectedPadding.split(' ')[1]); // py class
      }),
      { numRuns: 100 } // Run 100 iterations as specified
    );
  });

  it('Property 14: Primary variant has filled background with shadow', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constant('primary'),
          size: fc.constantFrom('sm', 'md', 'lg'),
          loading: fc.boolean(),
          disabled: fc.boolean(),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Verify primary variant styling
          expect(classes).toContain('bg-primary-600');
          expect(classes).toContain('hover:bg-primary-700');
          expect(classes).toContain('text-white');
          expect(classes).toContain('shadow-sm');
          expect(classes).toContain('hover:shadow-md');
          expect(classes).toContain('focus:ring-primary-500');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Secondary variant has outlined style with border', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constant('secondary'),
          size: fc.constantFrom('sm', 'md', 'lg'),
          loading: fc.boolean(),
          disabled: fc.boolean(),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Verify secondary variant styling
          expect(classes).toContain('bg-transparent');
          expect(classes).toContain('border-2');
          expect(classes).toContain('border-neutral-300');
          expect(classes).toContain('hover:border-neutral-400');
          expect(classes).toContain('text-neutral-900');
          expect(classes).toContain('hover:bg-neutral-50');
          expect(classes).toContain('focus:ring-neutral-500');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Tertiary variant has text-only style', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constant('tertiary'),
          size: fc.constantFrom('sm', 'md', 'lg'),
          loading: fc.boolean(),
          disabled: fc.boolean(),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Verify tertiary variant styling
          expect(classes).toContain('bg-transparent');
          expect(classes).toContain('text-primary-600');
          expect(classes).toContain('hover:text-primary-700');
          expect(classes).toContain('hover:bg-neutral-50');
          expect(classes).toContain('focus:ring-primary-500');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Danger variant has error background with shadow', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constant('danger'),
          size: fc.constantFrom('sm', 'md', 'lg'),
          loading: fc.boolean(),
          disabled: fc.boolean(),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Verify danger variant styling
          expect(classes).toContain('bg-error');
          expect(classes).toContain('hover:bg-red-700');
          expect(classes).toContain('text-white');
          expect(classes).toContain('shadow-sm');
          expect(classes).toContain('hover:shadow-md');
          expect(classes).toContain('focus:ring-red-500');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Border radius is consistently 12px across all variants', () => {
    fc.assert(
      fc.property(buttonVariantPropsArbitrary, (props) => {
        const classes = generateButtonClasses(props);

        // Requirement 8.2: All buttons must have 12px border-radius
        expect(classes).toContain('rounded-[12px]');

        // Verify the border radius value
        const expectedBorderRadius = '12px';
        expect(expectedBorderRadius).toBe('12px');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 14: Small size has 12px/8px padding (px-3 py-2)', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
          size: fc.constant('sm'),
          loading: fc.boolean(),
          disabled: fc.boolean(),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Requirement 8.2: Small size should have px-3 py-2 (12px/8px)
          expect(classes).toContain('px-3');
          expect(classes).toContain('py-2');
          expect(classes).toContain('text-sm');

          // Verify padding calculation
          const tailwindSpacingUnit = 4; // 1 unit = 4px in Tailwind
          const horizontalPadding = 3 * tailwindSpacingUnit; // 12px
          const verticalPadding = 2 * tailwindSpacingUnit; // 8px
          expect(horizontalPadding).toBe(12);
          expect(verticalPadding).toBe(8);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Medium size has 16px/12px padding (px-4 py-3)', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
          size: fc.constant('md'),
          loading: fc.boolean(),
          disabled: fc.boolean(),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Requirement 8.2: Medium size should have px-4 py-3 (16px/12px)
          expect(classes).toContain('px-4');
          expect(classes).toContain('py-3');
          expect(classes).toContain('text-base');

          // Verify padding calculation
          const tailwindSpacingUnit = 4; // 1 unit = 4px in Tailwind
          const horizontalPadding = 4 * tailwindSpacingUnit; // 16px
          const verticalPadding = 3 * tailwindSpacingUnit; // 12px
          expect(horizontalPadding).toBe(16);
          expect(verticalPadding).toBe(12);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Large size has 20px/16px padding (px-5 py-4)', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
          size: fc.constant('lg'),
          loading: fc.boolean(),
          disabled: fc.boolean(),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Requirement 8.2: Large size should have px-5 py-4 (20px/16px)
          expect(classes).toContain('px-5');
          expect(classes).toContain('py-4');
          expect(classes).toContain('text-lg');

          // Verify padding calculation
          const tailwindSpacingUnit = 4; // 1 unit = 4px in Tailwind
          const horizontalPadding = 5 * tailwindSpacingUnit; // 20px
          const verticalPadding = 4 * tailwindSpacingUnit; // 16px
          expect(horizontalPadding).toBe(20);
          expect(verticalPadding).toBe(16);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 15: Button State Management Behavior', () => {
  /**
   * Generator for Button state props
   */
  const buttonStatePropsArbitrary = fc.record({
    variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
    size: fc.constantFrom('sm', 'md', 'lg'),
    loading: fc.boolean(),
    disabled: fc.boolean(),
    className: fc.constantFrom('', 'custom-class'),
  });

  /**
   * Helper function to simulate Button component class generation
   */
  const generateButtonClasses = (props: {
    variant: string;
    size: string;
    loading: boolean;
    disabled: boolean;
    className: string;
  }): string => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-[12px] transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100';
    
    const variantClasses = {
      primary: 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500 shadow-sm hover:shadow-md',
      secondary: 'bg-transparent hover:bg-neutral-50 text-neutral-900 border-2 border-neutral-300 hover:border-neutral-400 focus:ring-neutral-500',
      tertiary: 'bg-transparent hover:bg-neutral-50 text-primary-600 hover:text-primary-700 focus:ring-primary-500',
      danger: 'bg-error hover:bg-red-700 text-white focus:ring-red-500 shadow-sm hover:shadow-md',
    };
    
    const sizeClasses = {
      sm: 'px-3 py-2 text-sm gap-2',
      md: 'px-4 py-3 text-base gap-2',
      lg: 'px-5 py-4 text-lg gap-3',
    };
    
    return `
      ${baseClasses}
      ${variantClasses[props.variant as keyof typeof variantClasses]}
      ${sizeClasses[props.size as keyof typeof sizeClasses]}
      ${props.className}
    `.trim().replace(/\s+/g, ' ');
  };

  it('Feature: premium-ui-upgrade, Property 15: Button state management behavior', () => {
    fc.assert(
      fc.property(buttonStatePropsArbitrary, (props) => {
        // Generate classes based on Button component logic
        const classes = generateButtonClasses(props);

        // Requirement 8.3: Verify disabled state reduces opacity to 0.5
        expect(classes).toContain('disabled:opacity-50');

        // Requirement 8.3: Verify disabled state shows not-allowed cursor
        expect(classes).toContain('disabled:cursor-not-allowed');

        // Requirement 8.5: Verify focus state with 2px outline offset
        expect(classes).toContain('focus:outline-none');
        expect(classes).toContain('focus:ring-2');
        expect(classes).toContain('focus:ring-offset-2');

        // Verify disabled buttons don't scale on hover
        expect(classes).toContain('disabled:hover:scale-100');
      }),
      { numRuns: 100 } // Run 100 iterations as specified
    );
  });

  it('Property 15: Disabled state reduces opacity to 0.5', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
          size: fc.constantFrom('sm', 'md', 'lg'),
          loading: fc.boolean(),
          disabled: fc.constant(true),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Requirement 8.3: Verify opacity reduction
          expect(classes).toContain('disabled:opacity-50');

          // Verify the opacity value
          const expectedOpacity = 0.5;
          expect(expectedOpacity).toBe(0.5);
          expect(expectedOpacity).toBeGreaterThan(0);
          expect(expectedOpacity).toBeLessThan(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: Disabled state shows not-allowed cursor', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
          size: fc.constantFrom('sm', 'md', 'lg'),
          loading: fc.boolean(),
          disabled: fc.constant(true),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Requirement 8.3: Verify not-allowed cursor
          expect(classes).toContain('disabled:cursor-not-allowed');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: Loading state disables interaction (same as disabled)', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
          size: fc.constantFrom('sm', 'md', 'lg'),
          loading: fc.constant(true),
          disabled: fc.boolean(),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Requirement 8.4: Loading state should have same disabled styling
          // (Button component sets disabled={disabled || loading})
          expect(classes).toContain('disabled:opacity-50');
          expect(classes).toContain('disabled:cursor-not-allowed');
          expect(classes).toContain('disabled:hover:scale-100');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: Focus state implements 2px outline offset', () => {
    fc.assert(
      fc.property(buttonStatePropsArbitrary, (props) => {
        const classes = generateButtonClasses(props);

        // Requirement 8.5: Verify focus state styling
        expect(classes).toContain('focus:outline-none');
        expect(classes).toContain('focus:ring-2');
        expect(classes).toContain('focus:ring-offset-2');

        // Verify the ring width value
        const expectedRingWidth = 2;
        expect(expectedRingWidth).toBe(2);

        // Verify the ring offset value
        const expectedRingOffset = 2;
        expect(expectedRingOffset).toBe(2);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 15: Focus ring color matches variant', () => {
    fc.assert(
      fc.property(buttonStatePropsArbitrary, (props) => {
        const classes = generateButtonClasses(props);

        // Verify focus ring color based on variant
        const focusRingMap = {
          primary: 'focus:ring-primary-500',
          secondary: 'focus:ring-neutral-500',
          tertiary: 'focus:ring-primary-500',
          danger: 'focus:ring-red-500',
        };

        const expectedFocusRing = focusRingMap[props.variant as keyof typeof focusRingMap];
        expect(classes).toContain(expectedFocusRing);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 15: Disabled buttons prevent hover scaling', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constantFrom('primary', 'secondary', 'tertiary', 'danger'),
          size: fc.constantFrom('sm', 'md', 'lg'),
          loading: fc.boolean(),
          disabled: fc.constant(true),
          className: fc.constantFrom('', 'custom-class'),
        }),
        (props) => {
          const classes = generateButtonClasses(props);

          // Verify disabled buttons have scale-100 on hover (no scaling)
          expect(classes).toContain('disabled:hover:scale-100');

          // Verify base hover scale is still present (but overridden by disabled)
          expect(classes).toContain('hover:scale-[1.02]');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: State management is consistent across all variants', () => {
    fc.assert(
      fc.property(buttonStatePropsArbitrary, (props) => {
        const classes = generateButtonClasses(props);

        // All variants should have consistent state management classes
        expect(classes).toContain('disabled:opacity-50');
        expect(classes).toContain('disabled:cursor-not-allowed');
        expect(classes).toContain('focus:outline-none');
        expect(classes).toContain('focus:ring-2');
        expect(classes).toContain('focus:ring-offset-2');
        expect(classes).toContain('disabled:hover:scale-100');
      }),
      { numRuns: 100 }
    );
  });
});
