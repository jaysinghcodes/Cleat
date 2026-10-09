import { clientSessionView, screenCopy } from "@cleat/domain";
import type { ThemeTokens } from "@cleat/theme";
import { Redirect, Tabs } from "expo-router";
import { Text, View } from "react-native";
import { SessionLoadFallback } from "../../components/session-fallback";
import { useSession } from "../../lib/session";
import { TrainingProvider } from "../../lib/training";
import { useTheme } from "../../theme";

const TABS = [
  { name: "today", title: "Today", glyph: "●" },
  { name: "program", title: "Program", glyph: "▦" },
  { name: "chat", title: "Chat", glyph: "◎" },
  { name: "book", title: "Book", glyph: "◌" },
  { name: "me", title: "Me", glyph: "○" },
] as const;

function TabGlyph({
  glyph,
  focused,
  tokens,
}: {
  glyph: string;
  focused: boolean;
  tokens: ThemeTokens;
}) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? tokens.accentSoft : tokens.bgSoft,
        borderWidth: 1,
        borderColor: focused ? tokens.accentRing : tokens.borderSoft,
      }}
    >
      <Text style={{ color: focused ? tokens.accentText : tokens.textTertiary, fontSize: 12 }}>{glyph}</Text>
    </View>
  );
}

export default function ClientLayout() {
  const { ready, configured, session, membership, loadError, refresh } = useSession();
  const { tokens } = useTheme();
  const view = clientSessionView({
    ready,
    configured,
    hasSession: session !== null,
    role: membership?.role ?? null,
    loadError,
  });

  if (view === "checking") {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.page, alignItems: "center", justifyContent: "center" }}>
        <Text accessibilityRole="header" style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>
          {screenCopy.loadingCleat}
        </Text>
      </View>
    );
  }
  if (view === "error") {
    return <SessionLoadFallback body={loadError ?? screenCopy.loadFailed} onRetry={() => void refresh()} />;
  }
  if (view !== "app" || !membership) return <Redirect href="/login" />;

  return (
    <TrainingProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: tokens.page },
        tabBarActiveTintColor: tokens.accentText,
        tabBarInactiveTintColor: tokens.textTertiary,
        tabBarStyle: {
          backgroundColor: tokens.card,
          borderTopColor: tokens.border,
          minHeight: 56,
        },
        tabBarItemStyle: {
          minHeight: 44,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => <TabGlyph glyph={tab.glyph} focused={focused} tokens={tokens} />,
          }}
        />
      ))}
      <Tabs.Screen name="log" options={{ href: null, title: "Log" }} />
    </Tabs>
    </TrainingProvider>
  );
}
