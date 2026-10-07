import { copy } from "@cleat/domain";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme";

export function PlaceholderScreen({ title, detail }: { title: string; detail?: string }) {
  const { tokens } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.page }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text style={{ color: tokens.text, fontSize: 24, fontWeight: "700" }}>{title}</Text>
        {detail ? (
          <Text style={{ color: tokens.textSecondary, fontSize: 13, marginTop: 6 }}>{detail}</Text>
        ) : null}
        <View style={{ marginTop: 18 }}>
          <Text style={{ color: tokens.textSecondary, fontSize: 14, lineHeight: 20 }}>{copy.laterTicket}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
