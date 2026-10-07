export const THEME_STORAGE_KEY = "cleat-theme";

export const themePreferences = ["system", "dark", "light"] as const;

export type ThemePreference = (typeof themePreferences)[number];

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "system" || value === "dark" || value === "light";
}

/** System, then Dark, then Light, then back to System. */
export function cycleThemePreference(current: ThemePreference): ThemePreference {
  const index = themePreferences.indexOf(current);
  const next = themePreferences[(index + 1) % themePreferences.length];
  return next ?? "system";
}

/** Manual Dark or Light wins. System follows the OS, and falls back to dark. */
export function resolveTheme(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): "dark" | "light" {
  if (preference === "dark" || preference === "light") return preference;
  return systemScheme === "light" ? "light" : "dark";
}
