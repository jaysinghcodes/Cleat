import { APP_NAME } from "@cleat/domain";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import mark from "../assets/cleat-mark-charcoal.png";
import { useTheme } from "../theme";

export function Lockup() {
  const { tokens } = useTheme();
  return (
    <View style={styles.lockup}>
      <Image
        source={mark}
        style={styles.mark}
        accessible={false}
      />
      <Text style={[styles.word, { color: tokens.text }]}>{APP_NAME}</Text>
    </View>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & TextInputProps) {
  const { tokens } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: tokens.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={tokens.textTertiary}
        style={[
          styles.input,
          {
            color: tokens.text,
            backgroundColor: tokens.input,
            borderColor: tokens.border,
            borderRadius: tokens.radiusSm,
          },
        ]}
        {...props}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "ghost";
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const primary = tone === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: primary ? tokens.accent : "transparent",
          borderColor: primary ? tokens.accent : tokens.border,
          borderRadius: 14,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <Text style={{ color: primary ? tokens.onAccent : tokens.text, fontWeight: "600", fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Banner({ message, tone = "error" }: { message: string; tone?: "error" | "ok" }) {
  const { tokens } = useTheme();
  const color = tone === "ok" ? tokens.success : tokens.error;
  const backgroundColor = tone === "ok" ? tokens.successTint : tokens.errorTint;
  return (
    <View style={[styles.banner, { backgroundColor, borderColor: tokens.border, borderRadius: tokens.radiusSm }]}>
      <Text style={{ color, fontSize: 14, lineHeight: 20 }}>{message}</Text>
    </View>
  );
}

export function AuthScreen({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  const { tokens } = useTheme();
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
        <Lockup />
        <Text style={[styles.title, { color: tokens.text }]}>{title}</Text>
        {lede ? <Text style={[styles.lede, { color: tokens.textSecondary }]}>{lede}</Text> : null}
        {children}
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
    borderWidth: 1,
    padding: 24,
  },
  lockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  word: {
    fontSize: 22,
    fontWeight: "700",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  lede: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  field: {
    marginBottom: 14,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  banner: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 14,
  },
});
