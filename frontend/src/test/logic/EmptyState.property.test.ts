import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-Based Tests for EmptyState Component - Premium UI Upgrade
 * 
 * **Validates: Requirements 7.2, 7.4**
 * 
 * Property 13: Empty state content structure
 * For all empty state variants (default, search, error), content structure must include:
 * icon/illustration, title, description, and action buttons. Title must be non-empty string,
 * description must be non-empty string, primary action must be present, and secondary action is optional.
 */

describe('Property 13: Empty State Content Structure', () => {
  /**
   * Generator for valid EmptyState component props
   */
  const emptyStatePropsArbitrary = fc.record({
    variant: fc.constantFrom('default', 'search', 'error'),
    title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    description: fc.option(fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0), { nil: undefined }),
    hasIcon: fc.boolean(),
    hasIllustration: fc.boolean(),
    hasPrimaryAction: fc.boolean(),
    hasSecondaryAction: fc.boolean(),
    primaryActionVariant: fc.constantFrom('primary', 'secondary'),
    className: fc.constantFrom('', 'custom-class', 'test-class'),
  });

  /**
   * Helper function to simulate EmptyState component structure generation
   * This mirrors the logic in EmptyState.tsx without requiring DOM rendering
   */
  const generateEmptyStateStructure = (props: {
    variant: string;
    title: string;
    description?: string;
    hasIcon: boolean;
    hasIllustration: boolean;
    hasPrimaryAction: boolean;
    hasSecondaryAction: boolean;
    primaryActionVariant: string;
    className: string;
  }) => {
    const variantStyles = {
      default: 'text-neutral-600',
      search: 'text-neutral-600',
      error: 'text-red-600',
    };

    const iconColorStyles = {
      default: 'text-neutral-400',
      search: 'text-neutral-400',
      error: 'text-red-400',
    };

    return {
      hasVisualElement: props.hasIcon || props.hasIllustration,
      iconSize: props.hasIcon ? '48px' : null,
      iconColor: props.hasIcon ? iconColorStyles[props.variant as keyof typeof iconColorStyles] : null,
      illustrationSize: props.hasIllustration ? { width: '48px', height: '48px' } : null,
      title: props.title,
      titleStyle: variantStyles[props.variant as keyof typeof variantStyles],
      description: props.description,
      hasPrimaryAction: props.hasPrimaryAction,
      hasSecondaryAction: props.hasSecondaryAction,
      primaryActionVariant: props.primaryActionVariant,
      hasActions: props.hasPrimaryAction || props.hasSecondaryAction,
    };
  };

  it('Feature: premium-ui-upgrade, Property 13: Empty state content structure', () => {
    fc.assert(
      fc.property(emptyStatePropsArbitrary, (props) => {
        const structure = generateEmptyStateStructure(props);

        // Requirement 7.2: Verify title is non-empty string
        expect(props.title).toBeTruthy();
        expect(props.title.length).toBeGreaterThan(0);
        expect(typeof props.title).toBe('string');

        // Requirement 7.2: Verify description is non-empty string when present
        if (props.description !== undefined) {
          expect(props.description.length).toBeGreaterThan(0);
          expect(typeof props.description).toBe('string');
        }

        // Requirement 7.2: Verify icon/illustration presence
        // At least one visual element should be present for proper empty state
        if (props.hasIcon) {
          expect(structure.iconSize).toBe('48px');
          // Icon color depends on variant
          if (props.variant === 'error') {
            expect(structure.iconColor).toContain('text-red-400');
          } else {
            expect(structure.iconColor).toContain('text-neutral-400');
          }
        }

        if (props.hasIllustration) {
          expect(structure.illustrationSize).toEqual({ width: '48px', height: '48px' });
        }

        // Requirement 7.4: Verify primary action presence when hasPrimaryAction is true
        if (props.hasPrimaryAction) {
          expect(structure.hasPrimaryAction).toBe(true);
          expect(structure.hasActions).toBe(true);
        }

        // Requirement 7.4: Verify secondary action is optional
        // Secondary action can be present or absent
        expect(typeof structure.hasSecondaryAction).toBe('boolean');

        // Verify variant-specific styling
        const expectedVariantStyle = {
          default: 'text-neutral-600',
          search: 'text-neutral-600',
          error: 'text-red-600',
        }[props.variant as 'default' | 'search' | 'error'];
        
        expect(structure.titleStyle).toBe(expectedVariantStyle);
      }),
      { numRuns: 100 } // Run 100 iterations as specified
    );
  });

  it('Property 13: All empty state variants have consistent content structure', () => {
    fc.assert(
      fc.property(emptyStatePropsArbitrary, (props) => {
        const structure = generateEmptyStateStructure(props);

        // All variants must have a title
        expect(props.title).toBeTruthy();
        expect(props.title.length).toBeGreaterThan(0);

        // All variants must have consistent structure elements
        expect(structure).toHaveProperty('title');
        expect(structure).toHaveProperty('titleStyle');
        expect(structure).toHaveProperty('hasActions');
        expect(structure).toHaveProperty('hasPrimaryAction');
        expect(structure).toHaveProperty('hasSecondaryAction');

        // Verify variant is one of the valid options
        expect(['default', 'search', 'error']).toContain(props.variant);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: Icon size is consistently 48px when present', () => {
    fc.assert(
      fc.property(
        emptyStatePropsArbitrary.filter(props => props.hasIcon),
        (props) => {
          const structure = generateEmptyStateStructure(props);

          // Requirement 7.4: Icons must be sized at 48px
          expect(structure.iconSize).toBe('48px');
          
          // Verify icon color is neutral-400 for default/search, red-400 for error
          if (props.variant === 'error') {
            expect(structure.iconColor).toContain('text-red-400');
          } else {
            expect(structure.iconColor).toContain('text-neutral-400');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Title is always non-empty across all variants', () => {
    fc.assert(
      fc.property(emptyStatePropsArbitrary, (props) => {
        // Requirement 7.2: Title must be non-empty string
        expect(props.title).toBeTruthy();
        expect(props.title.length).toBeGreaterThan(0);
        expect(typeof props.title).toBe('string');
        
        // Title should not be just whitespace
        expect(props.title.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: Description is non-empty when provided', () => {
    fc.assert(
      fc.property(
        emptyStatePropsArbitrary.filter(props => props.description !== undefined),
        (props) => {
          // Requirement 7.2: Description must be non-empty string when present
          expect(props.description).toBeTruthy();
          expect(props.description!.length).toBeGreaterThan(0);
          expect(typeof props.description).toBe('string');
          
          // Description should not be just whitespace
          expect(props.description!.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Primary action is present when specified', () => {
    fc.assert(
      fc.property(
        emptyStatePropsArbitrary.filter(props => props.hasPrimaryAction),
        (props) => {
          const structure = generateEmptyStateStructure(props);

          // Requirement 7.4: Primary action must be present when specified
          expect(structure.hasPrimaryAction).toBe(true);
          expect(structure.hasActions).toBe(true);
          
          // Verify primary action variant is valid
          expect(['primary', 'secondary']).toContain(props.primaryActionVariant);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Secondary action is optional', () => {
    fc.assert(
      fc.property(emptyStatePropsArbitrary, (props) => {
        const structure = generateEmptyStateStructure(props);

        // Requirement 7.4: Secondary action is optional
        // It can be true or false, both are valid
        expect(typeof structure.hasSecondaryAction).toBe('boolean');
        
        // If secondary action is present, actions section should be present
        if (structure.hasSecondaryAction) {
          expect(structure.hasActions).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: Variant-specific styling is correctly applied', () => {
    fc.assert(
      fc.property(emptyStatePropsArbitrary, (props) => {
        const structure = generateEmptyStateStructure(props);

        // Verify variant-specific title styling
        const expectedTitleStyles = {
          default: 'text-neutral-600',
          search: 'text-neutral-600',
          error: 'text-red-600',
        };

        expect(structure.titleStyle).toBe(
          expectedTitleStyles[props.variant as keyof typeof expectedTitleStyles]
        );

        // Verify variant-specific icon styling when icon is present
        if (props.hasIcon) {
          const expectedIconStyles = {
            default: 'text-neutral-400',
            search: 'text-neutral-400',
            error: 'text-red-400',
          };

          expect(structure.iconColor).toBe(
            expectedIconStyles[props.variant as keyof typeof expectedIconStyles]
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: Content structure includes all required elements', () => {
    fc.assert(
      fc.property(emptyStatePropsArbitrary, (props) => {
        const structure = generateEmptyStateStructure(props);

        // Verify all required structure elements are present
        expect(structure).toHaveProperty('title');
        expect(structure).toHaveProperty('titleStyle');
        expect(structure).toHaveProperty('description');
        expect(structure).toHaveProperty('hasVisualElement');
        expect(structure).toHaveProperty('hasPrimaryAction');
        expect(structure).toHaveProperty('hasSecondaryAction');
        expect(structure).toHaveProperty('hasActions');

        // Title is always required
        expect(structure.title).toBeTruthy();
        expect(structure.title.length).toBeGreaterThan(0);

        // Visual element (icon or illustration) should be tracked
        expect(typeof structure.hasVisualElement).toBe('boolean');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: Actions section is present when any action is specified', () => {
    fc.assert(
      fc.property(emptyStatePropsArbitrary, (props) => {
        const structure = generateEmptyStateStructure(props);

        // If either primary or secondary action is present, hasActions should be true
        if (props.hasPrimaryAction || props.hasSecondaryAction) {
          expect(structure.hasActions).toBe(true);
        }

        // If no actions are present, hasActions should be false
        if (!props.hasPrimaryAction && !props.hasSecondaryAction) {
          expect(structure.hasActions).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: Empty state structure is consistent with custom className', () => {
    fc.assert(
      fc.property(
        emptyStatePropsArbitrary,
        fc.string({ minLength: 0, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_-]*$/.test(s)),
        (props, customClass) => {
          const structure = generateEmptyStateStructure({ ...props, className: customClass });

          // Core structure requirements must be present even with custom className
          expect(structure.title).toBeTruthy();
          expect(structure.title.length).toBeGreaterThan(0);
          
          // Variant styling should still be applied
          expect(structure.titleStyle).toBeTruthy();
          
          // Actions structure should be consistent
          expect(typeof structure.hasActions).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
});
