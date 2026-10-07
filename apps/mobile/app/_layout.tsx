import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../lib/session";
import { ThemeProvider, useTheme } from "../theme";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Expo Go can reject this during fast refresh. The screen still renders.
});

function AppShell() {
  const { tokens, resolved, ready } = useTheme();

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {
      // Already hidden.
    });
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.page }}>
      <SafeAreaProvider>
        <StatusBar style={resolved === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.page },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AppShell />
      </SessionProvider>
    </ThemeProvider>
  );
}
