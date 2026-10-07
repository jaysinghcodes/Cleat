import { copy } from "@cleat/domain";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { useSession } from "../lib/session";
import { useTheme } from "../theme";

export default function Index() {
  const { ready, configured, membership } = useSession();
  const { tokens } = useTheme();

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: tokens.page }} />;
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
