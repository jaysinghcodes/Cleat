import { clientSessionView, copy, screenCopy } from "@cleat/domain";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { SessionLoadFallback } from "../components/session-fallback";
import { useSession } from "../lib/session";
import { useTheme } from "../theme";

export default function Index() {
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
    return <View style={{ flex: 1, backgroundColor: tokens.page }} />;
  }
  if (view === "error") {
    return <SessionLoadFallback body={loadError ?? screenCopy.loadFailed} onRetry={() => void refresh()} />;
  }
  if (!configured) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.page, justifyContent: "center", padding: 24 }}>
        <Text style={{ color: tokens.text, fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Cleat</Text>
        <Text style={{ color: tokens.textSecondary, fontSize: 15, lineHeight: 22 }}>{copy.unconfigured}</Text>
      </View>
    );
  }
  if (membership?.role === "client") return <Redirect href="/today" />;
  return <Redirect href="/login" />;
}
