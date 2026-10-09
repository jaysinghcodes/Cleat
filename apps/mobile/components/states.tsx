import { connectionMessage, screenCopy, userFacingError } from "@cleat/domain";
import { Pressable, Text, View } from "react-native";
import { useTraining } from "../lib/training";
import { useTheme } from "../theme";

export const tapTarget = {
  minHeight: 44,
  minWidth: 44,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

export function ScreenState({
  kind,
  title,
  body,
  onRetry,
  testID,
}: {
  kind: "loading" | "empty" | "error";
  title: string;
  body?: string;
  onRetry?: () => void;
  testID?: string;
}) {
  const { tokens } = useTheme();
  const detail = kind === "error" ? userFacingError(body ?? "", screenCopy.loadFailed) : body;
  return (
    <View
      testID={testID}
      accessibilityRole={kind === "loading" ? "progressbar" : "summary"}
      accessibilityLabel={kind === "loading" ? title : undefined}
      accessibilityLiveRegion={kind === "error" ? "assertive" : "polite"}
      style={{
        marginTop: 16,
        backgroundColor: tokens.card,
        borderColor: tokens.border,
        borderWidth: 1,
        borderRadius: tokens.radius,
        padding: 16,
      }}
    >
      <Text style={{ color: tokens.text, fontWeight: "600", fontSize: 16, marginBottom: detail ? 6 : 0 }}>{title}</Text>
      {detail ? <Text style={{ color: tokens.textSecondary, lineHeight: 20 }}>{detail}</Text> : null}
      {kind === "error" && onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={screenCopy.retry}
          onPress={onRetry}
          style={{
            marginTop: 14,
            backgroundColor: tokens.accent,
            borderRadius: 14,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 18,
          }}
        >
          <Text style={{ color: tokens.onAccent, fontWeight: "700" }}>{screenCopy.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function OfflineBanner({ testID }: { testID?: string }) {
  const { online, pendingCount } = useTraining();
  const { tokens } = useTheme();
  const message = connectionMessage(online, pendingCount);
  if (!message) return null;
  const queued = pendingCount > 0;
  return (
    <View
      testID={testID ?? "offline-banner"}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: queued ? tokens.successTint : tokens.raised,
        borderColor: tokens.border,
        borderWidth: 1,
        borderRadius: tokens.radiusSm,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: queued ? tokens.success : tokens.text, fontSize: 14, lineHeight: 20 }}>{message}</Text>
    </View>
  );
}

export function OfflineReason() {
  const { online } = useTraining();
  const { tokens } = useTheme();
  if (online) return null;
  return (
    <Text style={{ color: tokens.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 8 }}>
      {screenCopy.offlineAction}
    </Text>
  );
}
