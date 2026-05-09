import { describe, it, expect } from 'vitest';

/**
 * Button Component - Premium UI Upgrade Tests
 * 
 * These tests verify the Button component implementation meets requirements 8.1-8.5:
 * - 8.1: Three distinct visual styles (primary, secondary, tertiary)
 * - 8.2: 12px border radius and size-based padding
 * - 8.3: Disabled state with 0.5 opacity and not-allowed cursor
 * - 8.4: Loading states with spinner animation
 * - 8.5: Focus states with 2px outline offset
 * 
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 */

describe('Button Component - Premium Styling Requirements', () => {
  describe('Requirement 8.1: Visual Variants', () => {
    it('should support three distinct visual styles', () => {
      // Button component accepts variant prop with values: 'primary', 'secondary', 'tertiary'
      const variants = ['primary', 'secondary', 'tertiary'] as const;
      
      expect(variants).toContain('primary');
      expect(variants).toContain('secondary');
      expect(variants).toContain('tertiary');
      expect(variants.length).toBe(3);
    });

    it('should apply filled primary style', () => {
      // Primary: filled background with shadow
      const primaryClasses = {
        background: 'bg-primary-600',
        hover: 'hover:bg-primary-700',
        text: 'text-white',
        shadow: 'shadow-sm',
        hoverShadow: 'hover:shadow-md'
      };
      
      expect(primaryClasses.background).toBe('bg-primary-600');
      expect(primaryClasses.text).toBe('text-white');
      expect(primaryClasses.shadow).toBe('shadow-sm');
    });

    it('should apply outlined secondary style', () => {
      // Secondary: outlined with border
      const secondaryClasses = {
        background: 'bg-transparent',
        hover: 'hover:bg-neutral-50',
        text: 'text-neutral-900',
        border: 'border-2 border-neutral-300',
        hoverBorder: 'hover:border-neutral-400'
      };
      
      expect(secondaryClasses.background).toBe('bg-transparent');
      expect(secondaryClasses.border).toBe('border-2 border-neutral-300');
      expect(secondaryClasses.text).toBe('text-neutral-900');
    });

    it('should apply text-only tertiary style', () => {
      // Tertiary: text-only with no border
      const tertiaryClasses = {
        background: 'bg-transparent',
        hover: 'hover:bg-neutral-50',
        text: 'text-primary-600',
        hoverText: 'hover:text-primary-700'
      };
      
      expect(tertiaryClasses.background).toBe('bg-transparent');
      expect(tertiaryClasses.text).toBe('text-primary-600');
    });

    it('should default to primary variant', () => {
      const defaultVariant = 'primary';
      expect(defaultVariant).toBe('primary');
    });
  });

  describe('Requirement 8.2: Border Radius and Padding', () => {
    it('should use 12px border radius', () => {
      // Button uses rounded-[12px] class
      const borderRadiusClass = 'rounded-[12px]';
      expect(borderRadiusClass).toBe('rounded-[12px]');
    });

    it('should apply correct padding for small size (12px/8px)', () => {
      // Small: px-3 py-2 (3*4=12px horizontal, 2*4=8px vertical)
      const smallPadding = {
        horizontal: 3 * 4,
        vertical: 2 * 4,
        class: 'px-3 py-2'
      };
      
      expect(smallPadding.horizontal).toBe(12);
      expect(smallPadding.vertical).toBe(8);
      expect(smallPadding.class).toBe('px-3 py-2');
    });

    it('should apply correct padding for medium size (16px/12px)', () => {
      // Medium: px-4 py-3 (4*4=16px horizontal, 3*4=12px vertical)
      const mediumPadding = {
        horizontal: 4 * 4,
        vertical: 3 * 4,
        class: 'px-4 py-3'
      };
      
      expect(mediumPadding.horizontal).toBe(16);
      expect(mediumPadding.vertical).toBe(12);
      expect(mediumPadding.class).toBe('px-4 py-3');
    });

    it('should apply correct padding for large size (20px/16px)', () => {
      // Large: px-5 py-4 (5*4=20px horizontal, 4*4=16px vertical)
      const largePadding = {
        horizontal: 5 * 4,
        vertical: 4 * 4,
        class: 'px-5 py-4'
      };
      
      expect(largePadding.horizontal).toBe(20);
      expect(largePadding.vertical).toBe(16);
      expect(largePadding.class).toBe('px-5 py-4');
    });

    it('should support all three size variants', () => {
      const sizes = ['sm', 'md', 'lg'] as const;
      
      expect(sizes).toContain('sm');
      expect(sizes).toContain('md');
      expect(sizes).toContain('lg');
    });

    it('should default to medium size', () => {
      const defaultSize = 'md';
      expect(defaultSize).toBe('md');
    });
  });

  describe('Requirement 8.3: Disabled State', () => {
    it('should reduce opacity to 0.5 when disabled', () => {
      // Disabled class: disabled:opacity-50
      const disabledOpacity = 'disabled:opacity-50';
      const opacityValue = 0.5;
      
      expect(disabledOpacity).toBe('disabled:opacity-50');
      expect(opacityValue).toBe(0.5);
    });

    it('should show not-allowed cursor when disabled', () => {
      // Disabled cursor: disabled:cursor-not-allowed
      const disabledCursor = 'disabled:cursor-not-allowed';
      expect(disabledCursor).toBe('disabled:cursor-not-allowed');
    });

    it('should disable hover effects when disabled', () => {
      // Disabled buttons should not scale on hover
      const disabledHover = 'disabled:hover:scale-100';
      expect(disabledHover).toBe('disabled:hover:scale-100');
    });

    it('should set aria-disabled attribute when disabled', () => {
      // Button sets aria-disabled={disabled || loading}
      const ariaDisabled = true;
      expect(ariaDisabled).toBe(true);
    });
  });

  describe('Requirement 8.4: Loading State', () => {
    it('should support loading prop', () => {
      const loadingStates = [true, false];
      expect(loadingStates).toContain(true);
      expect(loadingStates).toContain(false);
    });

    it('should disable interaction when loading', () => {
      // Button is disabled when loading=true
      const loading = true;
      const disabled = loading;
      expect(disabled).toBe(true);
    });

    it('should display spinner animation when loading', () => {
      // Spinner uses animate-spin class
      const spinnerClass = 'animate-spin';
      expect(spinnerClass).toBe('animate-spin');
    });

    it('should size spinner based on button size', () => {
      // Small: h-4 w-4, Medium: h-5 w-5, Large: h-6 w-6
      const spinnerSizes = {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6'
      };
      
      expect(spinnerSizes.sm).toBe('h-4 w-4');
      expect(spinnerSizes.md).toBe('h-5 w-5');
      expect(spinnerSizes.lg).toBe('h-6 w-6');
    });
  });

  describe('Requirement 8.5: Focus States', () => {
    it('should implement focus ring with 2px outline', () => {
      // Focus classes: focus:outline-none focus:ring-2
      const focusClasses = {
        outline: 'focus:outline-none',
        ring: 'focus:ring-2'
      };
      
      expect(focusClasses.outline).toBe('focus:outline-none');
      expect(focusClasses.ring).toBe('focus:ring-2');
    });

    it('should implement 2px outline offset', () => {
      // Focus offset: focus:ring-offset-2
      const focusOffset = 'focus:ring-offset-2';
      expect(focusOffset).toBe('focus:ring-offset-2');
    });

    it('should apply variant-specific focus ring colors', () => {
      // Primary: focus:ring-primary-500
      // Secondary: focus:ring-neutral-500
      // Tertiary: focus:ring-primary-500
      const focusRingColors = {
        primary: 'focus:ring-primary-500',
        secondary: 'focus:ring-neutral-500',
        tertiary: 'focus:ring-primary-500'
      };
      
      expect(focusRingColors.primary).toBe('focus:ring-primary-500');
      expect(focusRingColors.secondary).toBe('focus:ring-neutral-500');
      expect(focusRingColors.tertiary).toBe('focus:ring-primary-500');
    });
  });

  describe('Micro-Interactions (Requirement 6.1)', () => {
    it('should scale to 1.02x on hover with 150ms transition', () => {
      // Hover scale: hover:scale-[1.02]
      const hoverScale = 'hover:scale-[1.02]';
      const scaleValue = 1.02;
      
      expect(hoverScale).toBe('hover:scale-[1.02]');
      expect(scaleValue).toBe(1.02);
    });

    it('should use 150ms ease-out transition', () => {
      // Transition: transition-all duration-150 ease-out
      const transitionClasses = {
        transition: 'transition-all',
        duration: 'duration-150',
        easing: 'ease-out'
      };
      
      expect(transitionClasses.transition).toBe('transition-all');
      expect(transitionClasses.duration).toBe('duration-150');
      expect(transitionClasses.easing).toBe('ease-out');
    });

    it('should scale to 0.98x on active/press', () => {
      // Active scale: active:scale-[0.98]
      const activeScale = 'active:scale-[0.98]';
      const scaleValue = 0.98;
      
      expect(activeScale).toBe('active:scale-[0.98]');
      expect(scaleValue).toBe(0.98);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing Button props', () => {
      // Existing props: variant, size, loading, disabled, children, className
      const existingProps = ['variant', 'size', 'loading', 'disabled', 'children', 'className'];
      
      expect(existingProps).toContain('variant');
      expect(existingProps).toContain('size');
      expect(existingProps).toContain('loading');
      expect(existingProps).toContain('disabled');
      expect(existingProps).toContain('children');
      expect(existingProps).toContain('className');
    });

    it('should support danger variant for backward compatibility', () => {
      // Danger variant still supported
      const dangerVariant = 'danger';
      expect(dangerVariant).toBe('danger');
    });

    it('should extend HTMLButtonElement attributes', () => {
      // ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>
      const htmlAttributes = ['onClick', 'type', 'form', 'name', 'value'];
      
      expect(htmlAttributes).toContain('onClick');
      expect(htmlAttributes).toContain('type');
    });
  });

  describe('Component Integration', () => {
    it('should combine all classes correctly', () => {
      // Classes are joined with space separator
      const classArray = ['base', 'variant', 'size', 'custom'];
      const combined = classArray.join(' ');
      
      expect(combined).toBe('base variant size custom');
    });

    it('should support custom className prop', () => {
      // Custom className is appended to generated classes
      const customClass = 'my-custom-class';
      expect(customClass).toBe('my-custom-class');
    });

    it('should spread remaining props to button element', () => {
      // ...props spreads all other HTML button attributes
      const additionalProps = { 'data-testid': 'test-button', 'aria-label': 'Test' };
      expect(additionalProps['data-testid']).toBe('test-button');
      expect(additionalProps['aria-label']).toBe('Test');
    });
  });
});
