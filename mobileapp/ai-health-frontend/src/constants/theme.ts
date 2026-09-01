import { Platform } from 'react-native';

// FitLip design system: restrained, data-first, and consistent across screens.
// Keep these tokens as the single source of truth for new UI.
export const BRAND = {
  900: '#26142F',
  800: '#49225B',
  700: '#5C2B6E',
  600: '#6E3482',
  500: '#844A9A',
  400: '#975CAE',
  300: '#B887C7',
  200: '#DCC8E3',
  100: '#F0E8F3',
  50: '#F8F5F9',
};

export const COLORS = {
  primary: BRAND[600],
  secondary: BRAND[400],
  primaryDark: BRAND[800],
  primaryLight: BRAND[300],
  onPrimary: '#FFFFFF',

  // Soft warm-neutral canvas; avoids the flat white / saturated AI-template look.
  background: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F3F0',
  card: '#FFFFFF',

  textDark: '#18181B',
  textLight: '#52525B',
  textMuted: '#71717A',
  textFaint: '#A1A1AA',
  border: '#E4E4E1',
  borderSubtle: 'rgba(24, 24, 27, 0.06)',

  accent: '#D97706',
  success: '#15803D',
  successBg: '#F0FDF4',
  warning: '#B45309',
  warningBg: '#FFFBEB',
  error: '#B91C1C',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
};

export const SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  section: 28,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const TYPOGRAPHY = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.8 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.3 },
  metric: { fontSize: 28, lineHeight: 32, fontWeight: '800' as const, letterSpacing: -0.6 },
};

export const SHADOW = {
  shadowColor: '#18181B',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace',
  },
  default: {
    // Android system sans keeps metrics stable without adding a font dependency.
    sans: 'sans-serif', serif: 'serif', rounded: 'sans-serif', mono: 'monospace',
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "Inter, system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  },
});


export const COMPONENTS = {
  screenPadding: SPACING.lg,
  sectionGap: SPACING.section,
  cardRadius: RADIUS.lg,
  controlRadius: RADIUS.md,
  buttonHeight: 48,
  inputHeight: 48,
  borderWidth: 1,
};
