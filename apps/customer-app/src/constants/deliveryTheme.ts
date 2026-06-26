/**
 * Delivery App Design Tokens — Orange + White Theme
 * Aligned with the customer app's Orders page visual identity.
 */
export const DELIVERY_COLORS = {
  // Backgrounds
  background:    '#FAFAFA',   // Off-white base — matches Orders page
  card:          '#FFFFFF',   // White card surface
  cardElevated:  '#F3F4F6',   // Slightly tinted elevated surface
  border:        '#EAEAEA',   // Subtle border

  // Brand — orange primary (matches Colors.primary)
  primary:       '#FF6A00',   // Orange — primary actions
  primaryDark:   '#E65C00',   // Pressed state
  primaryLight:  '#FF8A33',   // Light orange tint

  // Status
  success:       '#16A34A',   // Green — online / delivered
  successBg:     '#DCFCE7',   // Light green background
  warning:       '#F59E0B',   // Amber — in transit / caution
  warningBg:     '#FEF3C7',   // Light amber background
  danger:        '#EF4444',   // Red — offline / failed
  dangerBg:      '#FEE2E2',   // Light red background
  info:          '#3B82F6',   // Blue — info / navigation

  // Text
  textPrimary:   '#111111',   // Near-black — primary text
  textSecondary: '#666666',   // Medium grey — secondary text
  textMuted:     '#9CA3AF',   // Light grey — muted/hint text
  textMutedBg:   '#F3F4F6',   // Light grey surface (retry lock panel, etc.)

  // Special
  earnings:      '#FF6A00',   // Orange — earnings highlight (brand color)
  highValue:     '#E65C00',   // Dark orange — high value order badge
  white:         '#FFFFFF',
};

export const DELIVERY_TYPOGRAPHY = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
  hero: 38,
};

export const DELIVERY_SPACING = {
  xs:      4,
  sm:      8,
  md:      12,
  lg:      16,
  xl:      20,
  xxl:     24,
  section: 32,
};

export const DELIVERY_RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 999,
};

export const DELIVERY_SHADOW = {
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  4,
    elevation:     2,
  },
  elevated: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  8,
    elevation:     4,
  },
};

export default {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
  DELIVERY_SHADOW,
};
