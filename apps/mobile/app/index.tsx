import { APP_NAME } from "@coachloop/domain";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme";

const PLATFORM_LABEL: Record<string, string> = {
  ios: "iOS",
  android: "Android",
};

const preferenceLabel = {
  system: "System",
  dark: "Dark",
  light: "Light",
} as const;

export default function ShellScreen() {
  const platform = PLATFORM_LABEL[Platform.OS] ?? Platform.OS;
  const { tokens, preference, cycle } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.page }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: tokens.card,
            borderColor: tokens.border,
            borderRadius: tokens.radius,
          },
        ]}
      >
        <Text style={[styles.kicker, { color: tokens.accentText }]}>Client</Text>
        <Text style={[styles.title, { color: tokens.text }]}>{APP_NAME}</Text>
        <Text style={[styles.body, { color: tokens.textSecondary }]}>
          Same app on iOS and Android. This screen is the Ticket 0 shell. Today,
          Log, Chat, Book, and Profile arrive in later tickets.
        </Text>
        <Text style={[styles.platform, { color: tokens.text }]}>Running on {platform}</Text>
        <Pressable
          onPress={cycle}
          style={[
            styles.themeButton,
            {
              backgroundColor: tokens.raised,
              borderColor: tokens.borderStrong,
              borderRadius: tokens.radiusSm,
            },
          ]}
        >
          <Text style={[styles.themeButtonText, { color: tokens.text }]}>
            Theme: {preferenceLabel[preference]}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    padding: 24,
    borderWidth: 1,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  platform: {
    fontSize: 14,
    fontWeight: "600",
  },
  themeButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  themeButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
