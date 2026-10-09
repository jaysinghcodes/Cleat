import {
  calendarDate,
  dayStatus,
  firstName,
  initials,
  loggedExerciseCount,
  prescription,
  programCopy,
  programDayForDate,
  screenCopy,
  progressLabel,
  progressPercent,
  shortDate,
  weekdayLabel,
} from "@cleat/domain";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OfflineBanner, ScreenState } from "../../components/states";
import { Banner } from "../../components/ui";
import { useSession } from "../../lib/session";
import { useTraining } from "../../lib/training";
import { useTheme } from "../../theme";

export default function TodayScreen() {
  const router = useRouter();
  const { session, membership, coach } = useSession();
  const { ready, training, error, notice, saveOperation, setUnit, dismiss, refresh } = useTraining();
  const { tokens } = useTheme();
  const [skipping, setSkipping] = useState(false);
  const [skipNote, setSkipNote] = useState("");
  const [pending, setPending] = useState(false);

  const today = calendarDate(membership?.timezone ?? "UTC");
  const program = training?.program ?? null;
  const day = program ? programDayForDate(program, today) : null;
  const userId = session?.userId ?? "";
  const status = training
    ? dayStatus({
        clientId: userId,
        date: today,
        program,
        workouts: training.workouts,
        exerciseLogs: training.exerciseLogs,
        sets: training.sets,
      })
    : "none";
  const logged = day && training ? loggedExerciseCount(day, training.exerciseLogs, training.sets, userId, today) : 0;
  const total = day?.exercises.length ?? 0;
  const nextExercise = day?.exercises.find((exercise, index) => {
    if (!training) return index === 0;
    const count = loggedExerciseCount(
      { ...day, exercises: [exercise] },
      training.exerciseLogs,
      training.sets,
      userId,
      today,
    );
    return count === 0;
  }) ?? day?.exercises[0];

  async function confirmSkip() {
    if (!day) return;
    setPending(true);
    const ok = await saveOperation({
      clientKey: crypto.randomUUID(),
      kind: "skip_day",
      dayId: day.id,
      scheduledOn: today,
      note: skipNote.trim(),
    });
    setPending(false);
    if (ok) {
      setSkipping(false);
      setSkipNote("");
    }
  }

  const coachName = coach ? firstName(coach.displayName) : "your coach";
  const unit = training?.weightUnit ?? "lb";
  const skippedWorkout = training?.workouts.find(
    (row) => row.clientId === userId && row.scheduledOn === today && row.status === "skipped",
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.page }} edges={["top"]} testID="today-screen">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: tokens.textSecondary, fontSize: 13 }}>
              {weekdayLabel(today)} · with {coachName}
            </Text>
            <Text style={{ color: tokens.text, fontSize: 28, fontWeight: "700" }}>Today</Text>
          </View>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.raised,
              borderWidth: 1,
              borderColor: tokens.border,
            }}
          >
            <Text style={{ color: tokens.text, fontWeight: "700" }}>{initials(membership?.displayName ?? "You")}</Text>
          </View>
        </View>
        <UnitToggle unit={unit} onChange={(next) => void setUnit(next)} />
        <OfflineBanner testID="today-offline" />
        {notice ? <Banner message={notice} tone="ok" /> : null}
        {error ? (
          <ScreenState
            kind="error"
            title={screenCopy.couldNotLoad}
            body={error}
            onRetry={() => void refresh()}
          />
        ) : null}
        {!ready && !error ? <ScreenState kind="loading" title={screenCopy.loadingToday} /> : null}
        {training?.nudge ? (
          <View
            testID="today-nudge"
            style={{
              backgroundColor: tokens.errorTint,
              borderRadius: tokens.radius,
              padding: 14,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: tokens.border,
            }}
          >
            <Text style={{ color: tokens.error, fontSize: 14, lineHeight: 20 }}>{training.nudge.body}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Got it"
              onPress={() => void dismiss(training.nudge?.id ?? "")}
              style={{ marginTop: 8, minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: tokens.text, fontWeight: "600" }}>Got it</Text>
            </Pressable>
          </View>
        ) : null}
        {ready && !program && !error ? (
          <View testID="today-empty">
            <ScreenState kind="empty" title="No program yet" body={programCopy.emptyToday} />
          </View>
        ) : null}
        {ready && program && !day ? (
          <View style={cardStyle(tokens)}>
            <Text style={{ color: tokens.text, fontWeight: "700", fontSize: 18 }}>{program.name}</Text>
            <Text style={{ color: tokens.textSecondary, marginTop: 6 }}>
              Your program starts {shortDate(program.startDate)}.
            </Text>
          </View>
        ) : null}
        {ready && program && day ? (
          <>
            <Text style={{ color: tokens.textSecondary, marginBottom: 14 }}>
              {day.name} · {program.name}
            </Text>
            {status === "skipped" ? (
              <View
                testID="today-skipped"
                style={{
                  backgroundColor: tokens.skipTint,
                  borderRadius: tokens.radius,
                  padding: 14,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                <Text style={{ color: tokens.skip, fontWeight: "600" }}>
                  {skippedWorkout?.skipNote
                    ? `Skipped today · ${skippedWorkout.skipNote}`
                    : "Skipped today"}
                </Text>
              </View>
            ) : null}
            {day.rest || status === "rest" ? (
              <View style={cardStyle(tokens)}>
                <Text style={{ color: tokens.text, fontWeight: "600" }}>{programCopy.restToday}</Text>
              </View>
            ) : (
              <>
                <View
                  style={[
                    cardStyle(tokens),
                    { borderColor: tokens.accentRing, flexDirection: "row", alignItems: "center" },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: tokens.accentText, fontWeight: "600", fontSize: 13 }}>Progress</Text>
                    <Text style={{ color: tokens.textSecondary, marginTop: 4 }}>{progressLabel(logged, total)}</Text>
                  </View>
                  <Text style={{ color: tokens.accentText, fontWeight: "700" }}>{progressPercent(logged, total)}%</Text>
                </View>
                {day.exercises.map((exercise, index) => {
                  const done = training
                    ? loggedExerciseCount(
                        { ...day, exercises: [exercise] },
                        training.exerciseLogs,
                        training.sets,
                        userId,
                        today,
                      ) > 0
                    : false;
                  const current = nextExercise?.id === exercise.id && !done;
                  return (
                    <Pressable
                      key={exercise.id}
                      accessibilityRole="button"
                      accessibilityLabel={exercise.name}
                      onPress={() => router.push({ pathname: "/log", params: { exerciseId: exercise.id } })}
                      style={[
                        cardStyle(tokens),
                        current ? { borderColor: tokens.accentRing } : null,
                        !done && !current ? { opacity: 0.85 } : null,
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: tokens.text, fontWeight: "700" }}>{exercise.name}</Text>
                          <Text style={{ color: tokens.textSecondary, marginTop: 4 }}>{prescription(exercise)}</Text>
                        </View>
                        <Text style={{ color: done ? tokens.success : tokens.textTertiary, fontWeight: "600", fontSize: 12 }}>
                          {done ? "Logged" : current ? "Active" : `${index + 1}`}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable
                  testID="continue-logging"
                  accessibilityRole="button"
                  accessibilityLabel="Continue logging"
                  onPress={() => {
                    if (nextExercise) router.push({ pathname: "/log", params: { exerciseId: nextExercise.id } });
                  }}
                  style={{
                    backgroundColor: tokens.accent,
                    borderRadius: 14,
                    minHeight: 44,
                    paddingVertical: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 6,
                  }}
                >
                  <Text style={{ color: tokens.onAccent, fontWeight: "700" }}>Continue logging</Text>
                </Pressable>
                {skipping ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: tokens.textSecondary, marginBottom: 6 }}>Optional note</Text>
                    <TextInput
                      testID="skip-note"
                      accessibilityLabel="Optional note"
                      value={skipNote}
                      onChangeText={setSkipNote}
                      placeholder="Travel, rest, or a short reason"
                      placeholderTextColor={tokens.textTertiary}
                      style={{
                        borderWidth: 1,
                        borderColor: tokens.border,
                        borderRadius: tokens.radiusSm,
                        color: tokens.text,
                        backgroundColor: tokens.input,
                        minHeight: 44,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    />
                    <Pressable
                      testID="confirm-skip"
                      accessibilityRole="button"
                      accessibilityLabel="Confirm skip"
                      disabled={pending}
                      onPress={() => void confirmSkip()}
                      style={{
                        borderWidth: 1,
                        borderColor: tokens.border,
                        borderRadius: 14,
                        minHeight: 44,
                        paddingVertical: 14,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: tokens.text, fontWeight: "600" }}>Confirm skip</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    testID="skip-today"
                    accessibilityRole="button"
                    accessibilityLabel="Skip today"
                    onPress={() => setSkipping(true)}
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
                    <Text style={{ color: tokens.text, fontWeight: "600" }}>Skip today</Text>
                  </Pressable>
                )}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function cardStyle(tokens: { card: string; border: string; radius: number }) {
  return {
    backgroundColor: tokens.card,
    borderColor: tokens.border,
    borderWidth: 1,
    borderRadius: tokens.radius,
    padding: 14,
    marginBottom: 12,
  };
}

function UnitToggle({ unit, onChange }: { unit: "lb" | "kg"; onChange: (unit: "lb" | "kg") => void }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
      {(["lb", "kg"] as const).map((option) => {
        const active = unit === option;
        return (
          <Pressable
            key={option}
            testID={`unit-${option}`}
            accessibilityRole="button"
            accessibilityLabel={`Weight unit ${option}`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option)}
            style={{
              minHeight: 44,
              minWidth: 44,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 1,
              alignItems: "center",
              justifyContent: "center",
              borderColor: active ? tokens.borderStrong : tokens.border,
              backgroundColor: active ? tokens.raised : "transparent",
            }}
          >
            <Text style={{ color: tokens.text, fontWeight: "600", fontSize: 12 }}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
