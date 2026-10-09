import { dark, light, type ThemeTokens } from "./tokens";

/** CSS custom property names from shared.css, plus --on-accent for the contrast rule. */
const cssVar = {
  sidebar: "--sidebar-bg",
  page: "--bg",
  card: "--card",
  raised: "--raised",
  bgSoft: "--bg-soft",
  input: "--input-bg",
  chrome: "--chrome-bg",
  border: "--border",
  borderSoft: "--border-soft",
  borderStrong: "--border-strong",
  text: "--text",
  textSecondary: "--sub",
  textTertiary: "--faint",
  accent: "--accent",
  accentText: "--accent-text",
  accentSoft: "--accent-soft",
  accentRing: "--accent-ring",
  onAccent: "--on-accent",
  ai: "--ai",
  aiTint: "--ai-bg",
  success: "--done",
  successTint: "--done-bg",
  skip: "--skip",
  skipTint: "--skip-bg",
  warn: "--warn",
  warnTint: "--warn-bg",
  error: "--nudge",
  errorTint: "--nudge-bg",
  chip: "--chip-bg",
  track: "--track",
  codeBg: "--code-bg",
  codeFg: "--code-fg",
  onUrgent: "--on-urgent",
  phoneStage1: "--phone-stage-1",
  phoneStage2: "--phone-stage-2",
  phoneBezel: "--phone-bezel",
  chipCream: "--chip-cream",
  chipCreamText: "--chip-cream-text",
  shadow: "--shadow",
  shadowSm: "--shadow-sm",
  radius: "--radius",
  radiusSm: "--radius-sm",
  radiusPill: "--radius-pill",
  fontFamily: "--font",
  fontMono: "--mono",
} as const satisfies Record<Exclude<keyof ThemeTokens, "colorScheme">, string>;

function cssValue(value: string | number): string {
  return typeof value === "number" ? `${value}px` : value;
}

function declarations(tokens: ThemeTokens): string {
  const lines = [`color-scheme: ${tokens.colorScheme};`];
  for (const key of Object.keys(cssVar) as (keyof typeof cssVar)[]) {
    lines.push(`${cssVar[key]}: ${cssValue(tokens[key])};`);
  }
  lines.push(`--cta-text: ${tokens.onAccent};`);
  return lines.map((line) => `  ${line}`).join("\n");
}

function block(selector: string, tokens: ThemeTokens): string {
  return `${selector} {\n${declarations(tokens)}\n}`;
}

/**
 * Dark tokens are the fallback when the OS reports no scheme.
 * prefers-color-scheme selects the theme when data-theme is absent.
 * data-theme="dark" or data-theme="light" overrides the OS.
 */
export const themeStylesheet = [
  block(":root", dark),
  `@media (prefers-color-scheme: dark) {\n${block(":root:not([data-theme])", dark)}\n}`,
  `@media (prefers-color-scheme: light) {\n${block(":root:not([data-theme])", light)}\n}`,
  block(':root[data-theme="dark"]', dark),
  block(':root[data-theme="light"]', light),
].join("\n\n");
