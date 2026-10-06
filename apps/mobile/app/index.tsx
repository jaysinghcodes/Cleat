import { APP_NAME } from "@coachloop/domain";
import { Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PLATFORM_LABEL: Record<string, string> = {
  ios: "iOS",
  android: "Android",
};

export default function ShellScreen() {
  const platform = PLATFORM_LABEL[Platform.OS] ?? Platform.OS;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Client</Text>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.body}>
          Same app on iOS and Android. This screen is the Ticket 0 shell. Today,
          Log, Chat, Book, and Profile arrive in later tickets.
        </Text>
        <Text style={styles.platform}>Running on {platform}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B1220",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#111A2E",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  kicker: {
    color: "#2DD4BF",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 12,
  },
  body: {
    color: "#CBD5E1",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  platform: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
});
