import { updateProfile } from "@cleat/api";
import { copy, initials, profileUpdateSchema, screenCopy, userFacingError, validationMessage } from "@cleat/domain";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OfflineBanner, ScreenState } from "../../components/states";
import { Banner, Button, Field } from "../../components/ui";
import { useSession } from "../../lib/session";
import { useTheme } from "../../theme";

const preferenceLabel = {
  system: "System",
  dark: "Dark",
  light: "Light",
} as const;

export default function MeScreen() {
  const { session, membership, coach, client, refresh, signOut } = useSession();
  const { tokens, preference, cycle } = useTheme();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(membership?.displayName ?? "");
  const [timezone, setTimezone] = useState(membership?.timezone ?? "UTC");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const name = membership?.displayName ?? "You";
  const org = coach?.orgName ?? membership?.orgName ?? "";
  const coachName = coach?.displayName ?? "Your coach";

  async function onSave() {
    if (!client || !session) return;
    const parsed = profileUpdateSchema.safeParse({ displayName, timezone });
    if (!parsed.success) {
      setSaved(false);
      setError(validationMessage(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(client, session.userId, parsed.data);
      await refresh();
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError(userFacingError(err, copy.profileSaveFailed));
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.page }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text accessibilityRole="header" style={{ color: tokens.text, fontSize: 24, fontWeight: "700", marginBottom: 4 }}>You</Text>
        <Text style={{ color: tokens.textSecondary, fontSize: 13, marginBottom: 18 }}>
          {name}
          {org ? ` · ${org}` : ""}
        </Text>
        <OfflineBanner />
        {!session ? <ScreenState kind="loading" title={screenCopy.loadingMe} /> : null}
        {session && !membership ? (
          <ScreenState kind="empty" title={screenCopy.emptyMeTitle} body={screenCopy.emptyMeBody} />
        ) : null}
        {error ? (
          <ScreenState kind="error" title={screenCopy.couldNotLoad} body={error} onRetry={() => void onSave()} />
        ) : null}
        {saved ? <Banner message="Saved" tone="ok" /> : null}
        <View
          style={{
            backgroundColor: tokens.card,
            borderColor: tokens.border,
            borderWidth: 1,
            borderRadius: tokens.radius,
            padding: 16,
            marginBottom: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.bgSoft,
              borderWidth: 1,
              borderColor: tokens.border,
            }}
          >
            <Text style={{ color: tokens.textSecondary, fontWeight: "700" }}>{initials(name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: tokens.text, fontWeight: "600" }}>{name}</Text>
            {session?.email ? (
              <Text style={{ color: tokens.textSecondary, fontSize: 12, marginTop: 2 }}>{session.email}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => {
              setDisplayName(membership?.displayName ?? "");
              setTimezone(membership?.timezone ?? "UTC");
              setEditing((value) => !value);
              setSaved(false);
            }}
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: 9,
              minHeight: 44,
              minWidth: 44,
              paddingVertical: 10,
              paddingHorizontal: 14,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: tokens.text, fontSize: 12, fontWeight: "600" }}>Edit</Text>
          </Pressable>
        </View>
        {editing ? (
          <View
            style={{
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              borderWidth: 1,
              borderRadius: tokens.radius,
              padding: 16,
              marginBottom: 14,
            }}
          >
            <Field label="Display name" value={displayName} onChangeText={setDisplayName} autoComplete="name" />
            <Field label="Timezone" value={timezone} onChangeText={setTimezone} autoCapitalize="none" />
            <Button label="Save" disabled={pending} onPress={() => void onSave()} />
          </View>
        ) : null}
        <View
          style={{
            backgroundColor: tokens.card,
            borderColor: tokens.border,
            borderWidth: 1,
            borderRadius: tokens.radius,
            marginBottom: 14,
            overflow: "hidden",
          }}
        >
          <InfoRow label="Coach" meta={coachName} />
          <InfoRow label="Program" meta={copy.arrivesLater} />
          <InfoRow label="Streak" meta={copy.arrivesLater} />
        </View>
        <View
          style={{
            backgroundColor: tokens.card,
            borderColor: tokens.border,
            borderWidth: 1,
            borderRadius: tokens.radius,
            marginBottom: 14,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: tokens.borderSoft,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.text, fontWeight: "600", fontSize: 14 }}>Appearance</Text>
              <Text style={{ color: tokens.textSecondary, fontSize: 12, marginTop: 2 }}>
                System, Dark, or Light
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Theme ${preferenceLabel[preference]}`}
              onPress={cycle}
              style={{
                borderWidth: 1,
                borderColor: tokens.borderStrong,
                backgroundColor: tokens.raised,
                borderRadius: 9,
                minHeight: 44,
                minWidth: 44,
                paddingVertical: 10,
                paddingHorizontal: 14,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: tokens.text, fontSize: 12, fontWeight: "600" }}>
                {preferenceLabel[preference]}
              </Text>
            </Pressable>
          </View>
          <InfoRow label="Notifications" meta={copy.arrivesLater} />
          <InfoRow label="Calendar" meta={copy.arrivesLater} last />
        </View>
        <Button label="Log out" tone="ghost" onPress={() => void signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, meta, last = false }: { label: string; meta: string; last?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.borderSoft,
      }}
    >
      <Text style={{ color: tokens.text, fontWeight: "600", fontSize: 14 }}>{label}</Text>
      <Text style={{ color: tokens.textSecondary, fontSize: 12, marginTop: 2 }}>{meta}</Text>
    </View>
  );
}
