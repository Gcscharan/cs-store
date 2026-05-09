/**
 * Premium Tokens - Verification Tests
 * 
 * Validates that premium token extensions are properly defined and accessible.
 * Task 1: Extend design token system with premium values
 */

import { describe, test, expect } from 'vitest';
import { premiumTokens } from '../../../tokens/premium';
import { designTokens } from '../../../tokens/index';

describe('Premium Token System - Task 1 Verification', () => {
  describe('Premium Shadows (Requirement 3.1)', () => {
    test('should define card shadow matching requirement 3.1', () => {
      expect(premiumTokens.shadows.card).toBe(
        '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      );
    });

    test('should define card hover shadow for requirement 3.3', () => {
      expect(premiumTokens.shadows.cardHover).toBe(
        '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      );
    });

    test('should define all shadow variants', () => {
      expect(premiumTokens.shadows).toHaveProperty('soft');
      expect(premiumTokens.shadows).toHaveProperty('medium');
      expect(premiumTokens.shadows).toHaveProperty('strong');
      expect(premiumTokens.shadows).toHaveProperty('button');
      expect(premiumTokens.shadows).toHaveProperty('buttonHover');
    });
  });

  describe('Premium Spacing (Requirements 1.2, 1.3)', () => {
    test('should define extended spacing values', () => {
      expect(premiumTokens.spacing).toHaveProperty('18'); // 72px - Large section spacing
      expect(premiumTokens.spacing).toHaveProperty('20'); // 80px
      expect(premiumTokens.spacing).toHaveProperty('24'); // 96px
    });

    test('should define section spacing for requirement 1.3', () => {
      expect(premiumTokens.layout.padding.section).toBe('32px');
    });

    test('should define responsive padding for requirement 1.2', () => {
      expect(premiumTokens.layout.padding.mobile).toBe('24px');
      expect(premiumTokens.layout.padding.desktop).toBe('48px');
    });
  });

  describe('Premium Typography (Requirements 2.1, 2.2)', () => {
    test('should define page title typography for requirement 2.1', () => {
      const pageTitle = premiumTokens.typography['3xl'];
      expect(pageTitle.fontSize).toBe('2rem'); // 32px
      expect(pageTitle.fontWeight).toBe('600');
    });

    test('should define section subtitle typography for requirement 2.2', () => {
      const subtitle = premiumTokens.typography.subtitle;
      expect(subtitle.fontSize).toBe('1.25rem'); // 20px
      expect(subtitle.fontWeight).toBe('500');
    });

    test('should define table header typography for requirement 4.5', () => {
      const tableHeader = premiumTokens.typography.tableHeader;
      expect(tableHeader.fontSize).toBe('0.875rem'); // 14px
      expect(tableHeader.fontWeight).toBe('500');
    });

    test('should define extended typography scale', () => {
      expect(premiumTokens.typography).toHaveProperty('3xl');
      expect(premiumTokens.typography).toHaveProperty('4xl');
      expect(premiumTokens.typography).toHaveProperty('5xl');
      expect(premiumTokens.typography).toHaveProperty('6xl');
    });
  });

  describe('Premium Border Radius (Requirement 3.2)', () => {
    test('should define card border radius for requirement 3.2', () => {
      expect(premiumTokens.borderRadius.card).toBe('12px');
    });

    test('should define button border radius for requirement 8.2', () => {
      expect(premiumTokens.borderRadius.button).toBe('12px');
    });

    test('should define input border radius for requirement 9.2', () => {
      expect(premiumTokens.borderRadius.input).toBe('8px');
    });
  });

  describe('Premium Animations (Requirements 6.1, 6.2, 6.3)', () => {
    test('should define button hover animation for requirement 6.1', () => {
      expect(premiumTokens.animations.buttonHover).toBe('transform 150ms ease-out');
    });

    test('should define button press animation for requirement 6.3', () => {
      expect(premiumTokens.animations.buttonPress).toBe('transform 100ms ease-out');
    });

    test('should define input focus animation for requirement 6.2', () => {
      expect(premiumTokens.animations.inputFocus).toContain('200ms ease-out');
    });

    test('should define card hover animation for requirement 3.3', () => {
      expect(premiumTokens.animations.cardHover).toContain('200ms ease-out');
    });
  });

  describe('Premium Layout Constraints (Requirement 1.1)', () => {
    test('should define container max-width for requirement 1.1', () => {
      expect(premiumTokens.layout.maxWidth.container).toBe('1280px');
    });

    test('should define table dimensions for requirements 4.3, 4.4', () => {
      expect(premiumTokens.layout.table.rowHeight).toBe('64px');
      expect(premiumTokens.layout.table.cellPaddingX).toBe('16px');
      expect(premiumTokens.layout.table.cellPaddingY).toBe('20px');
    });

    test('should define form spacing for requirement 5.5', () => {
      expect(premiumTokens.layout.form.sectionSpacing).toBe('20px');
      expect(premiumTokens.layout.form.fieldSpacing).toBe('16px');
    });

    test('should define minimum touch target for requirement 10.4', () => {
      expect(premiumTokens.layout.touchTarget.minimum).toBe('44px');
    });
  });

  describe('Premium Component Variants (Requirement 8.2)', () => {
    test('should define button size variants for requirement 8.2', () => {
      expect(premiumTokens.variants.button.sizes.sm).toEqual({
        paddingX: '12px',
        paddingY: '8px'
      });
      expect(premiumTokens.variants.button.sizes.md).toEqual({
        paddingX: '16px',
        paddingY: '12px'
      });
      expect(premiumTokens.variants.button.sizes.lg).toEqual({
        paddingX: '20px',
        paddingY: '16px'
      });
    });

    test('should define card padding for requirement 3.4', () => {
      expect(premiumTokens.variants.card.padding).toBe('24px');
    });

    test('should define input padding for requirement 9.2', () => {
      expect(premiumTokens.variants.input.paddingX).toBe('12px');
    });
  });

  describe('Token Integration', () => {
    test('should export premium tokens from main index', async () => {
      // This test verifies that premium tokens are accessible from the main export
      const { premiumTokens: exportedPremiumTokens } = await import('../../../tokens/index');
      expect(exportedPremiumTokens).toBeDefined();
      expect(exportedPremiumTokens.shadows).toBeDefined();
      expect(exportedPremiumTokens.spacing).toBeDefined();
      expect(exportedPremiumTokens.typography).toBeDefined();
    });

    test('should maintain backward compatibility with base design tokens', () => {
      // Verify base tokens are still accessible
      expect(designTokens.colors).toBeDefined();
      expect(designTokens.spacing).toBeDefined();
      expect(designTokens.typography).toBeDefined();
    });
  });
});
