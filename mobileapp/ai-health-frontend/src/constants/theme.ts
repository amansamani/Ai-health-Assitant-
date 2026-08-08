/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#4C2E96';
const tintColorDark = '#fff';

// Fitlip brand palette — anchored on #29195A (the deep purple used in the
// app icon / native splash) so in-app UI actually matches the brand instead
// of the generic template green it shipped with.
export const BRAND = {
  900: "#170F36", // near-black purple, high-emphasis text on light bg
  800: "#29195A", // brand anchor — icon/splash color
  700: "#392376",
  600: "#4C2E96", // primary interactive color (buttons, links)
  500: "#6339B8",
  400: "#8257D6",
  300: "#A78BFA",
  200: "#C9B8F7",
  100: "#EDE9FE", // selected-state tints, chip fills
  50: "#F5F3FF", // subtle tinted backgrounds
};

export const COLORS = {
  // legacy flat keys — kept so already-shipped screens keep working;
  // values now point at the real brand instead of placeholder green/blue.
  primary: BRAND[600],
  secondary: BRAND[400],
  background: "#FAF9FC",
  card: "#FFFFFF",
  textDark: "#1B1730",
  textLight: "#6B667D",
  accent: "#F59E0B",
  border: "#E4E0F0",

  // semantic tokens for new/redesigned screens
  primaryDark: BRAND[800],
  primaryLight: BRAND[300],
  onPrimary: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: BRAND[50],
  textMuted: "#9A94AE",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  errorBorder: "#FECACA",
  success: "#16A34A",
  warning: "#D97706",
};

export const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 3,
};


export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
