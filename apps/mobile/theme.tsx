import { screenCopy } from "@cleat/domain";
import {
  THEME_STORAGE_KEY,
  cycleThemePreference,
  dark,
  isThemePreference,
  resolveTheme,
  themes,
  type ThemePreference,
  type ThemeTokens,
} from "@cleat/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Text, useColorScheme, View } from "react-native";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "dark" | "light";
  tokens: ThemeTokens;
  cycle: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isThemePreference(stored)) setPreference(stored);
      })
      .catch(() => {
        // Keep the OS scheme when storage cannot be read.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cycle = useCallback(() => {
    const next = cycleThemePreference(preference);
    setPreference(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {
      // The choice still applies for this session.
    });
  }, [preference]);

  const resolved = resolveTheme(preference, systemScheme);
  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      tokens: themes[resolved],
      cycle,
      ready,
    }),
    [preference, resolved, cycle, ready],
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: dark.page, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: dark.text, fontSize: 16, fontWeight: "600" }}>{screenCopy.loadingCleat}</Text>
      </View>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
