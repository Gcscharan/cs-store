export const DELIVERY_COLORS = {
  // Backgrounds
  background:    '#0F172A',   // Deep navy - base
  card:          '#1E293B',   // Slate - card surface
  cardElevated:  '#263548',   // Lighter slate - elevated cards
  border:        '#334155',   // Subtle border

  // Brand
  primary:       '#0B5FFF',   // Electric blue - primary actions
  primaryDark:   '#0847CC',   // Pressed state

  // Status
  success:       '#00C853',   // Online / delivered
  successBg:     '#052E16',
  warning:       '#F59E0B',   // In transit / caution
  warningBg:     '#1C1400',
  danger:        '#FF3B30',   // Offline / failed
  dangerBg:      '#2D0A08',
  info:          '#38BDF8',   // Info / navigation

  // Text
  textPrimary:   '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted:     '#475569',

  // Special
  earnings:      '#FFD700',   // Gold - earnings highlight
  highValue:     '#FF6B00',   // Orange - high value order badge
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
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius:  8,
    elevation:     8,
  },
  elevated: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius:  16,
    elevation:     16,
  },
};
