import { copy } from "@cleat/domain";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { useSession } from "../../lib/session";
import { useTheme } from "../../theme";

export default function AuthCallback() {
  const { ready, configured, session, membership } = useSession();
  const { tokens } = useTheme();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.page, justifyContent: "center", padding: 24 }}>
        <Text style={{ color: tokens.textSecondary }}>{copy.checkingSession}</Text>
      </View>
    );
  }
  if (!configured) return <Redirect href="/login" />;
  if (membership?.role === "client") return <Redirect href="/today" />;
  if (membership?.role === "trainer") return <Redirect href="/login" />;
  if (!session) return <Redirect href="/login" />;
  return <Redirect href="/login" />;
}
