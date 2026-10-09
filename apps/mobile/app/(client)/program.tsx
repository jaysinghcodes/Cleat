import {
  calendarDate,
  dayStatus,
  daysBetween,
  firstName,
  loggedExerciseCount,
  programCopy,
  programDayForDate,
  screenCopy,
  shortDate,
  weekdayLabel,
  weekDates,
} from "@cleat/domain";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OfflineBanner, ScreenState } from "../../components/states";
import { useSession } from "../../lib/session";
import { useTraining } from "../../lib/training";
import { useTheme } from "../../theme";

export default function ProgramScreen() {
  const router = useRouter();
  const { session, membership, coach } = useSession();
  const { ready, training, error, refresh } = useTraining();
  const { tokens } = useTheme();
  const today = calendarDate(membership?.timezone ?? "UTC");
  const program = training?.program ?? null;
  const userId = session?.userId ?? "";
  const coachName = coach ? firstName(coach.displayName) : "your coach";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.page }} edges={["top"]} testID="program-screen">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text accessibilityRole="header" style={{ color: tokens.text, fontSize: 28, fontWeight: "700" }}>Program</Text>
        <View style={{ marginTop: 12 }}>
          <OfflineBanner />
        </View>
        {error ? (
          <ScreenState kind="error" title={screenCopy.couldNotLoad} body={error} onRetry={() => void refresh()} />
        ) : null}
        {!ready && !error ? <ScreenState kind="loading" title={screenCopy.loadingProgram} /> : null}
        {ready && !program && !error ? (
          <View testID="program-empty">
            <ScreenState kind="empty" title="No program yet" body={programCopy.emptyProgram} />
          </View>
        ) : null}
        {ready && program ? (
          <>
            <Text style={{ color: tokens.textSecondary, marginTop: 6, marginBottom: 16 }}>
              {program.name} · week of {shortDate(weekDates(today)[0] ?? today)}
            </Text>
            {weekDates(today).map((date) => {
              const day = programDayForDate(program, date);
              const isToday = date === today;
              const status = dayStatus({
                clientId: userId,
                date,
                program,
                workouts: training?.workouts ?? [],
                exerciseLogs: training?.exerciseLogs ?? [],
                sets: training?.sets ?? [],
              });
              const logged = day
                ? loggedExerciseCount(day, training?.exerciseLogs ?? [], training?.sets ?? [], userId, date)
                : 0;
              const upcoming = daysBetween(today, date) > 0;
              let pill = "Upcoming";
              if (!day) pill = "Before start";
              else if (day.rest || status === "rest") pill = "Rest";
              else if (status === "done") pill = "Done";
              else if (status === "skipped") pill = "Skipped";
              else if (status === "missed" && !upcoming) pill = "Missed";
              else if (status === "partial") pill = "Partial";
              else if (upcoming) pill = "Upcoming";
              const meta = !day
                ? "Before your program starts"
                : isToday
                  ? `Today · ${logged}/${day.exercises.length} logged`
                  : day.rest
                    ? "Rest"
                    : day.exercises.map((exercise) => exercise.name).slice(0, 3).join(" · ");
              return (
                <View
                  key={date}
                  style={{
                    backgroundColor: tokens.card,
                    borderColor: isToday ? tokens.accentRing : tokens.border,
                    borderWidth: 1,
                    borderRadius: tokens.radius,
                    padding: 14,
                    marginBottom: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: tokens.text, fontWeight: "700" }}>
                      {weekdayLabel(date)} · {day?.name ?? "Open"}
                    </Text>
                    <Text style={{ color: tokens.textSecondary, marginTop: 4 }}>{meta}</Text>
                  </View>
                  {isToday && day && !day.rest ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open today"
                      onPress={() => router.push("/today")}
                      style={{
                        borderWidth: 1,
                        borderColor: tokens.border,
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
                      <Text style={{ color: tokens.text, fontWeight: "600", fontSize: 12 }}>Open</Text>
                    </Pressable>
                  ) : (
                    <Text style={{ color: tokens.textTertiary, fontSize: 12, fontWeight: "600" }}>{pill}</Text>
                  )}
                </View>
              );
            })}
            <View
              style={{
                marginTop: 8,
                padding: 14,
                borderRadius: tokens.radius,
                backgroundColor: tokens.page,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            >
              <Text style={{ color: tokens.text, fontWeight: "600", marginBottom: 6 }}>Assigned by {coachName}</Text>
              <Text style={{ color: tokens.textSecondary, lineHeight: 18 }}>
                Started {shortDate(program.startDate)}. A new assign replaces this week.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
