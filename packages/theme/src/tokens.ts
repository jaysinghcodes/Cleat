/**
 * Cleat theme tokens, mapped from the locked shared.css custom properties.
 * onAccent is always charcoal. accentText changes with the theme.
 * shared.css does not define a spacing scale or a type scale.
 */

/** Charcoal. Text on apricot is always this. White on apricot fails WCAG AA. */
export const onAccentColor = "#1C1917";

/** Soft apricot. Fill, active nav, and AI marks. Not text on the light theme. */
export const accentFill = "#E8A87C";

/** Apricot family text on light surfaces. Apricot fill on white fails WCAG AA. */
export const lightAccentText = "#9A5B2F";

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif';

const fontMono = '"SF Mono", ui-monospace, Menlo, Consolas, monospace';

const shared = {
  onAccent: onAccentColor,
  accent: accentFill,
  chipCream: "#FFEDD5",
  chipCreamText: onAccentColor,
  radius: 16,
  radiusSm: 10,
  radiusPill: 999,
  fontFamily,
  fontMono,
} as const;

export type ThemeTokens = {
  colorScheme: "dark" | "light";
  sidebar: string;
  page: string;
  card: string;
  raised: string;
  bgSoft: string;
  input: string;
  chrome: string;
  border: string;
  borderSoft: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  /** Page and card only in dark mode. On raised surfaces use textSecondary. */
  textTertiary: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  accentRing: string;
  onAccent: string;
  ai: string;
  aiTint: string;
  success: string;
  successTint: string;
  skip: string;
  skipTint: string;
  warn: string;
  warnTint: string;
  error: string;
  errorTint: string;
  chip: string;
  track: string;
  codeBg: string;
  codeFg: string;
  onUrgent: string;
  phoneStage1: string;
  phoneStage2: string;
  phoneBezel: string;
  chipCream: string;
  chipCreamText: string;
  shadow: string;
  shadowSm: string;
  radius: number;
  radiusSm: number;
  radiusPill: number;
  fontFamily: string;
  fontMono: string;
};

/** Dark theme. Warm mist. */
export const dark = {
  colorScheme: "dark",
  sidebar: "#211F1E",
  page: "#262423",
  card: "#312E2C",
  raised: "#3C3936",
  bgSoft: "#3C3936",
  input: "#2B2827",
  chrome: "#1B1918",
  border: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "#F3F0EC",
  textSecondary: "#B5AFA9",
  textTertiary: "#9D9791",
  accentText: accentFill,
  accentSoft: "rgba(232,168,124,0.12)",
  accentRing: "rgba(232,168,124,0.55)",
  ai: accentFill,
  aiTint: "rgba(232,168,124,0.12)",
  success: "#7CC79F",
  successTint: "rgba(124,199,159,0.14)",
  skip: "#DCBC72",
  skipTint: "rgba(220,188,114,0.14)",
  warn: "#DCBC72",
  warnTint: "rgba(220,188,114,0.14)",
  error: "#F1948A",
  errorTint: "rgba(241,148,138,0.15)",
  chip: "rgba(255,255,255,0.05)",
  track: "rgba(255,255,255,0.08)",
  codeBg: "#211F1E",
  codeFg: "#F3F0EC",
  onUrgent: onAccentColor,
  phoneStage1: "#211F1E",
  phoneStage2: "#262423",
  phoneBezel: "#141312",
  shadow: "0 1px 2px rgba(0,0,0,0.20), 0 8px 24px rgba(0,0,0,0.18)",
  shadowSm: "0 1px 2px rgba(0,0,0,0.18)",
  ...shared,
} satisfies ThemeTokens;

/** Light theme. Grey page, white cards. */
export const light = {
  colorScheme: "light",
  sidebar: "#FAFAFA",
  page: "#F4F4F5",
  card: "#FFFFFF",
  raised: "#F4F4F5",
  bgSoft: "#F4F4F5",
  input: "#FAFAFA",
  chrome: onAccentColor,
  border: "#D4D4D8",
  borderSoft: "#E4E4E7",
  borderStrong: "#C4C4CA",
  text: onAccentColor,
  textSecondary: "#57534E",
  textTertiary: "#6B6B74",
  accentText: lightAccentText,
  accentSoft: "rgba(232,168,124,0.16)",
  accentRing: "rgba(154,91,47,0.45)",
  ai: lightAccentText,
  aiTint: "rgba(232,168,124,0.14)",
  success: "#15763D",
  successTint: "rgba(21,118,61,0.09)",
  skip: "#995707",
  skipTint: "rgba(153,87,7,0.09)",
  warn: "#995707",
  warnTint: "rgba(153,87,7,0.09)",
  error: "#B91C1C",
  errorTint: "rgba(185,28,28,0.07)",
  chip: "rgba(24,24,27,0.05)",
  track: "rgba(24,24,27,0.08)",
  codeBg: onAccentColor,
  codeFg: "#F5F2EE",
  onUrgent: "#FFFFFF",
  phoneStage1: "#E4E4E7",
  phoneStage2: "#F4F4F5",
  phoneBezel: onAccentColor,
  shadow: "0 1px 2px rgba(28,25,23,0.05), 0 10px 28px rgba(28,25,23,0.08)",
  shadowSm: "0 1px 3px rgba(28,25,23,0.06)",
  ...shared,
} satisfies ThemeTokens;

export const themes = {
  dark,
  light,
} as const;

export type ThemeName = keyof typeof themes;
