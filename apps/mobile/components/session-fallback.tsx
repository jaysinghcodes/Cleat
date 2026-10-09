import { screenCopy } from "@cleat/domain";
import { Text, View } from "react-native";
import { useTheme } from "../theme";
import { ScreenState } from "./states";

export function SessionLoadFallback({ body, onRetry }: { body: string; onRetry: () => void }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.page, justifyContent: "center", padding: 24 }}>
      <Text accessibilityRole="header" style={{ color: tokens.text, fontSize: 24, fontWeight: "700", marginBottom: 8 }}>
        Cleat
      </Text>
      <ScreenState kind="error" title={screenCopy.couldNotLoad} body={body} onRetry={onRetry} />
    </View>
  );
}
