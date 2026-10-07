"use client";

import {
  THEME_STORAGE_KEY,
  cycleThemePreference,
  isThemePreference,
  resolveTheme,
  themes,
  type ThemePreference,
  type ThemeTokens,
} from "@cleat/theme";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "dark" | "light";
  tokens: ThemeTokens;
  synced: boolean;
  cycle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyPreference(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [systemScheme, setSystemScheme] = useState<"dark" | "light">("dark");
  const [synced, setSynced] = useState(false);

  useLayoutEffect(() => {
    const stored = readPreference();
    setPreference(stored);
    applyPreference(stored);
    setSynced(true);

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setSystemScheme(media.matches ? "light" : "dark");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const cycle = useCallback(() => {
    const next = cycleThemePreference(preference);
    setPreference(next);
    applyPreference(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode can block storage. The attribute still updates this tab.
    }
  }, [preference]);

  const resolved = resolveTheme(preference, systemScheme);
  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      tokens: themes[resolved],
      synced,
      cycle,
    }),
    [preference, resolved, synced, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}

const preferenceLabel: Record<ThemePreference, string> = {
  system: "System",
  dark: "Dark",
  light: "Light",
};

export function ThemeCycle() {
  const { preference, cycle, synced } = useTheme();
  return (
    <button type="button" className="theme-cycle" onClick={cycle}>
      {synced ? `Theme: ${preferenceLabel[preference]}` : "Theme"}
    </button>
  );
}
