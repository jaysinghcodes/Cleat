import {
  calendarDate,
  formatWeight,
  parseWeight,
  prescription,
  programDayForDate,
  screenCopy,
  weightToKg,
} from "@cleat/domain";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OfflineBanner, ScreenState } from "../../components/states";
import { Banner } from "../../components/ui";
import { useSession } from "../../lib/session";
import { useTraining } from "../../lib/training";
import { useTheme } from "../../theme";

type SetDraft = {
  index: number;
  weightKg: number | null;
  weightText: string;
  repsText: string;
};

export default function LogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exerciseId?: string }>();
  const exerciseId = typeof params.exerciseId === "string" ? params.exerciseId : "";
  const { session, membership } = useSession();
  const { ready, training, error, notice, saveOperation, setUnit, refresh } = useTraining();
  const { tokens } = useTheme();
  const [sets, setSets] = useState<SetDraft[]>([]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const today = calendarDate(membership?.timezone ?? "UTC");
  const program = training?.program ?? null;
  const day = program ? programDayForDate(program, today) : null;
  const exercise = day?.exercises.find((item) => item.id === exerciseId) ?? null;
  const unit = training?.weightUnit ?? "lb";

  useEffect(() => {
    if (!exercise || !training || !session) return;
    const existing = training.sets.filter(
      (row) => row.exerciseId === exercise.id && row.scheduledOn === today && row.clientId === session.userId,
    );
    const next: SetDraft[] = [];
    for (let index = 1; index <= exercise.sets; index += 1) {
      const saved = existing.find((row) => row.setIndex === index);
      next.push({
        index,
        weightKg: saved ? saved.weightKg : null,
        weightText: saved ? formatWeight(saved.weightKg, unit) : "",
        repsText: saved ? String(saved.reps) : "",
      });
    }
    setSets(next);
    setNote("");
  }, [exercise, training, session, today, unit]);

  function updateWeight(index: number, text: string) {
    const parsed = parseWeight(text);
    setSets((current) =>
      current.map((row) =>
        row.index === index
          ? { ...row, weightText: text, weightKg: parsed === null ? null : weightToKg(parsed, unit) }
          : row,
      ),
    );
  }

  async function save(markDone: boolean) {
    if (!exercise) return;
    const clean: { index: number; weightKg: number; reps: number }[] = [];
    for (const row of sets) {
      const reps = Number(row.repsText);
      const hasReps = row.repsText.trim() !== "" && Number.isFinite(reps) && reps >= 1;
      if (!hasReps) continue;
      if (row.weightKg === null) {
        setLocalError("Enter a weight between 0 and 999.");
        return;
      }
      clean.push({ index: row.index, weightKg: row.weightKg, reps });
    }
    if (clean.length === 0 && !markDone) {
      setLocalError("Enter reps for at least one set.");
      return;
    }
    setLocalError(null);
    setPending(true);
    const ok = await saveOperation({
      clientKey: crypto.randomUUID(),
      kind: "save_sets",
      exerciseId: exercise.id,
      scheduledOn: today,
      sets: clean,
      note: note.trim(),
      markDone,
    });
    setPending(false);
    if (ok) router.push("/today");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.page }} edges={["top"]} testID="log-screen">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Today"
          onPress={() => router.push("/today")}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: tokens.textSecondary, marginBottom: 8 }}>Today</Text>
        </Pressable>
        <OfflineBanner />
        {error ? (
          <ScreenState kind="error" title={screenCopy.couldNotLoad} body={error} onRetry={() => void refresh()} />
        ) : null}
        {!ready ? <ScreenState kind="loading" title={screenCopy.loadingLog} /> : null}
        {ready && !exercise ? (
          <ScreenState kind="empty" title={screenCopy.emptyLogTitle} body={screenCopy.emptyLogBody} />
        ) : null}
        {ready && exercise ? (
          <>
            <Text style={{ color: tokens.text, fontSize: 24, fontWeight: "700" }}>{exercise.name}</Text>
            <Text style={{ color: tokens.textSecondary, marginTop: 4, marginBottom: 12 }}>{prescription(exercise)}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {(["lb", "kg"] as const).map((option) => (
                <Pressable
                  key={option}
                  testID={`log-unit-${option}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Weight unit ${option}`}
                  accessibilityState={{ selected: unit === option }}
                  onPress={() => void setUnit(option)}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    borderColor: unit === option ? tokens.borderStrong : tokens.border,
                    backgroundColor: unit === option ? tokens.raised : "transparent",
                  }}
                >
                  <Text style={{ color: tokens.text, fontWeight: "600", fontSize: 12 }}>{option}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <Banner message={error} /> : null}
            {localError ? <Banner message={localError} /> : null}
            {notice ? <Banner message={notice} tone="ok" /> : null}
            {exercise.notes.trim() ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: tokens.accentRing,
                  borderRadius: tokens.radius,
                  padding: 14,
                  marginBottom: 14,
                  backgroundColor: tokens.card,
                }}
              >
                <Text style={{ color: tokens.accentText, lineHeight: 20 }}>Coach note: {exercise.notes}</Text>
              </View>
            ) : null}
            {exercise.videoUrl ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Watch the demo"
                onPress={() => void Linking.openURL(exercise.videoUrl ?? "")}
                style={{ marginBottom: 12, minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ color: tokens.accentText, fontWeight: "600" }}>Watch the demo</Text>
              </Pressable>
            ) : null}
            <View
              style={{
                backgroundColor: tokens.card,
                borderRadius: tokens.radius,
                borderWidth: 1,
                borderColor: tokens.border,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                <Text style={{ width: 36, color: tokens.textTertiary, fontSize: 11, fontWeight: "700" }}>SET</Text>
                <Text style={{ flex: 1, textAlign: "center", color: tokens.textTertiary, fontSize: 11, fontWeight: "700" }}>
                  {unit.toUpperCase()}
                </Text>
                <Text style={{ flex: 1, textAlign: "center", color: tokens.textTertiary, fontSize: 11, fontWeight: "700" }}>
                  REPS
                </Text>
              </View>
              {sets.map((row) => {
                const filled = row.weightText.trim() !== "" && row.repsText.trim() !== "";
                return (
                  <View key={row.index} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Text style={{ width: 36, textAlign: "center", color: tokens.textSecondary, fontWeight: "700" }}>
                      {row.index}
                    </Text>
                    <TextInput
                      testID={`weight-${row.index}`}
                      accessibilityLabel={`Set ${row.index} weight`}
                      value={row.weightText}
                      onChangeText={(text) => updateWeight(row.index, text)}
                      keyboardType="decimal-pad"
                      style={inputStyle(tokens)}
                    />
                    <TextInput
                      testID={`reps-${row.index}`}
                      accessibilityLabel={`Set ${row.index} reps`}
                      value={row.repsText}
                      onChangeText={(text) =>
                        setSets((current) =>
                          current.map((item) => (item.index === row.index ? { ...item, repsText: text } : item)),
                        )
                      }
                      keyboardType="number-pad"
                      style={inputStyle(tokens)}
                    />
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: filled ? tokens.success : tokens.border,
                        backgroundColor: filled ? tokens.success : "transparent",
                      }}
                    />
                  </View>
                );
              })}
            </View>
            <Text style={{ color: tokens.textSecondary, marginBottom: 6 }}>Optional note</Text>
            <TextInput
              testID="log-note"
              accessibilityLabel="Optional note"
              value={note}
              onChangeText={setNote}
              placeholder="Felt strong, or a form cue"
              placeholderTextColor={tokens.textTertiary}
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: tokens.radiusSm,
                color: tokens.text,
                backgroundColor: tokens.input,
                minHeight: 44,
                padding: 12,
                marginBottom: 14,
              }}
            />
            <Pressable
              testID="save-sets"
              accessibilityRole="button"
              accessibilityLabel="Save sets"
              disabled={pending}
              onPress={() => void save(false)}
              style={{
                backgroundColor: tokens.accent,
                borderRadius: 14,
                minHeight: 44,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: tokens.onAccent, fontWeight: "700" }}>Save sets</Text>
            </Pressable>
            <Pressable
              testID="mark-done"
              accessibilityRole="button"
              accessibilityLabel="Mark exercise done"
              disabled={pending}
              onPress={() => void save(true)}
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 14,
                minHeight: 44,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              <Text style={{ color: tokens.text, fontWeight: "600" }}>Mark exercise done</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function inputStyle(tokens: { input: string; text: string; border: string; radiusSm: number }) {
  return {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.input,
    color: tokens.text,
    textAlign: "center" as const,
    minHeight: 44,
    paddingVertical: 10,
    fontWeight: "600" as const,
  };
}
