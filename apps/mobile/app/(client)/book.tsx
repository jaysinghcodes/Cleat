import {
  accessToken,
  bookSession,
  cancelSession,
  downloadIcs,
  loadClientCalendar,
  subscribeLink,
} from "@cleat/api";
import {
  addDays,
  bookingCopy,
  cancelCutoffMessage,
  civilToKey,
  clientCanCancel,
  clientOpenSlots,
  copy,
  firstName,
  screenCopy,
  userFacingError,
  formatCivil,
  formatInstant,
  formatWeekLabel,
  keyToCivil,
  startOfWeekMonday,
  weekDays,
  zonedParts,
  type OpenSlot,
  type SessionRecord,
} from "@cleat/domain";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OfflineBanner, OfflineReason, ScreenState } from "../../components/states";
import { Banner } from "../../components/ui";
import { useSession } from "../../lib/session";
import { useTraining } from "../../lib/training";
import { useTheme } from "../../theme";

function webOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  return (configured || "http://localhost:3000").replace(/\/$/, "");
}

export default function BookScreen() {
  const { client, membership, coach } = useSession();
  const { online } = useTraining();
  const { tokens } = useTheme();
  const timezone = membership?.timezone || "UTC";
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date(), timezone));
  const [selectedKey, setSelectedKey] = useState(() => civilToKey(zonedPartsToCivil(new Date(), timezone)));
  const [blocks, setBlocks] = useState<Awaited<ReturnType<typeof loadClientCalendar>>["blocks"]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [taken, setTaken] = useState<{ startsAt: string; endsAt: string }[]>([]);
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [trainerName, setTrainerName] = useState(coach?.displayName ?? "your coach");
  const [trainerTimezone, setTrainerTimezone] = useState(timezone);
  const [cutoff, setCutoff] = useState(12);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [subscribeUrl, setSubscribeUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    if (!client || !membership) return;
    const data = await loadClientCalendar(client, membership.orgId);
    setBlocks(data.blocks);
    setSessions(data.sessions);
    setTaken(data.taken);
    setSlotMinutes(data.slotMinutes);
    setTrainerName(data.trainerName);
    setTrainerTimezone(data.trainerTimezone || timezone);
    setCutoff(data.cancelCutoffHours);
    setStatus("ready");
  }, [client, membership, timezone]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(userFacingError(err, screenCopy.loadFailed));
      setStatus("error");
    });
  }, [load]);

  const days = weekDays(weekStart);
  const ownBooked = sessions.filter((item) => item.status === "booked");
  const slots = useMemo(() => {
    const ownRanges = ownBooked.map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt }));
    const origin = addDays(weekStart, -1);
    const span = Array.from({ length: 9 }, (_, index) => addDays(origin, index));
    return span.flatMap((day) =>
      clientOpenSlots({
        day,
        timeZone: trainerTimezone,
        blocks,
        slotMinutes,
        taken,
        ownBooked: ownRanges,
      }),
    );
  }, [blocks, ownBooked, slotMinutes, taken, trainerTimezone, weekStart]);

  const daySlots = slots.filter((slot) => civilToKey(zonedPartsToCivil(new Date(slot.startsAt), timezone)) === selectedKey);
  const dayOwn = ownBooked.filter(
    (item) => civilToKey(zonedPartsToCivil(new Date(item.startsAt), timezone)) === selectedKey,
  );
  const upcoming = ownBooked
    .filter((item) => new Date(item.startsAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  const canCancel = upcoming ? clientCanCancel(upcoming.startsAt, cutoff) : false;
  const selected = daySlots.find((slot) => slot.startsAt === selectedSlot) ?? null;
  const showIcs = Boolean(confirmation || upcoming);

  async function loadSubscribeLink(token: string) {
    try {
      const link = await subscribeLink(webOrigin(), token, false);
      setSubscribeUrl(link.url);
      setLinkError(null);
    } catch (err) {
      setLinkError(userFacingError(err, copy.generic));
    }
  }

  async function onBook(slot: OpenSlot) {
    if (!client || !online) return;
    setPending(true);
    setError(null);
    setLinkError(null);
    setConfirmation(null);
    try {
      const token = await accessToken(client);
      const result = await bookSession(webOrigin(), token, slot.startsAt);
      setConfirmation(result.confirmation);
      try {
        await load();
      } catch (err) {
        setError(userFacingError(err, copy.generic));
      }
      void loadSubscribeLink(token);
    } catch (err) {
      setError(userFacingError(err, copy.generic));
    } finally {
      setPending(false);
    }
  }

  async function onCancel() {
    if (!client || !upcoming) return;
    setPending(true);
    setError(null);
    try {
      const token = await accessToken(client);
      await cancelSession(webOrigin(), token, upcoming.id);
      setConfirming(false);
      setConfirmation(null);
      await load();
    } catch (err) {
      setError(userFacingError(err, copy.generic));
    } finally {
      setPending(false);
    }
  }

  async function onDownload() {
    if (!client || !upcoming) return;
    setError(null);
    try {
      const token = await accessToken(client);
      const ics = await downloadIcs(webOrigin(), token, upcoming.id);
      if (Platform.OS === "web") {
        const blob = new Blob([ics], { type: "text/calendar" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "session.ics";
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: ics });
      }
    } catch (err) {
      setError(userFacingError(err, copy.generic));
    }
  }

  async function onSubscribe() {
    if (!client) return;
    setLinkError(null);
    try {
      const token = await accessToken(client);
      const link = subscribeUrl || (await subscribeLink(webOrigin(), token, false)).url;
      setSubscribeUrl(link);
      if (Platform.OS === "web" && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
      } else {
        await Share.share({ message: link });
      }
    } catch (err) {
      setLinkError(userFacingError(err, copy.generic));
    }
  }

  const coachLabel = firstName(trainerName);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.page }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text accessibilityRole="header" style={{ color: tokens.text, fontSize: 28, fontWeight: "700" }}>Book</Text>
        <Text style={{ color: tokens.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 16 }} testID="book-sub">
          {`1:1 with ${coachLabel} · ICS calendar sync`}
        </Text>
        <OfflineBanner />
        <OfflineReason />
        {status === "loading" ? <ScreenState kind="loading" title={screenCopy.loadingBook} /> : null}
        {status === "error" ? (
          <ScreenState
            kind="error"
            title={screenCopy.couldNotLoad}
            body={error ?? screenCopy.loadFailed}
            onRetry={() => {
              setStatus("loading");
              setError(null);
              void load().catch((err: unknown) => {
                setError(userFacingError(err, screenCopy.loadFailed));
                setStatus("error");
              });
            }}
          />
        ) : null}
        {status === "ready" && error ? <Banner message={error} /> : null}
        {status === "ready" && confirmation ? <Banner message={confirmation} tone="ok" /> : null}
        {status === "ready" ? (
        <>
        <View
          testID="upcoming-card"
          style={{
            backgroundColor: tokens.card,
            borderColor: tokens.border,
            borderWidth: 1,
            borderRadius: tokens.radius,
            padding: 14,
            marginBottom: 14,
          }}
        >
          {upcoming ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tokens.text, fontWeight: "600" }}>Upcoming</Text>
                <Text style={{ color: tokens.textSecondary, marginTop: 4 }}>
                  {`${formatWhen(upcoming.startsAt, timezone)} · ${slotMinutes} min`}
                </Text>
              </View>
              {canCancel && !confirming ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  disabled={!online}
                  onPress={() => setConfirming(true)}
                  style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: tokens.error, fontWeight: "600" }}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text style={{ color: tokens.textSecondary }}>{bookingCopy.noUpcoming}</Text>
          )}
          {upcoming && !canCancel ? (
            <Text testID="cutoff-message" style={{ color: tokens.textSecondary, marginTop: 8 }}>
              {cancelCutoffMessage(cutoff)}
            </Text>
          ) : null}
          {confirming && upcoming ? (
            <View testID="cancel-confirm" style={{ marginTop: 12 }}>
              <Text style={{ color: tokens.text, marginBottom: 8 }}>{bookingCopy.cancelConfirm}</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={bookingCopy.keepSession}
                  onPress={() => setConfirming(false)}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={{ color: tokens.textSecondary, fontWeight: "600" }}>{bookingCopy.keepSession}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={online ? bookingCopy.cancelSession : screenCopy.offlineAction}
                  disabled={pending || !online}
                  onPress={() => void onCancel()}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={{ color: tokens.error, fontWeight: "600" }}>{bookingCopy.cancelSession}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: tokens.card,
            borderColor: tokens.border,
            borderWidth: 1,
            borderRadius: tokens.radius,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={bookingCopy.previousWeek}
              onPress={() => setWeekStart(addDays(weekStart, -7))}
              style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}
            >
              <Text style={{ color: tokens.textSecondary }}>{bookingCopy.previousWeek}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={bookingCopy.nextWeek}
              onPress={() => setWeekStart(addDays(weekStart, 7))}
              style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}
            >
              <Text style={{ color: tokens.textSecondary }}>{bookingCopy.nextWeek}</Text>
            </Pressable>
          </View>
          <Text style={{ color: tokens.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 10 }}>
            {formatWeekLabel(weekStart).toUpperCase()}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {days.map((day) => {
              const key = civilToKey(day);
              const selectedDay = key === selectedKey;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedKey(key);
                    setSelectedSlot(null);
                  }}
                  accessibilityLabel={formatCivil(day)}
                  style={{
                    width: 44,
                    minHeight: 44,
                    paddingVertical: 8,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selectedDay ? tokens.accent : "transparent",
                  }}
                >
                  <Text style={{ color: selectedDay ? tokens.onAccent : tokens.textTertiary, fontSize: 11 }}>
                    {formatCivil(day).slice(0, 1)}
                  </Text>
                  <Text style={{ color: selectedDay ? tokens.onAccent : tokens.text, fontWeight: "700" }}>{day.day}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Text style={{ color: tokens.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>
          {`${formatCivil(keyToCivil(selectedKey)).toUpperCase()} · OPEN SLOTS`}
        </Text>
        <View testID="slot-list" style={{ gap: 8, marginBottom: 16 }}>
          {dayOwn.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: tokens.card,
                borderColor: tokens.accent,
                borderWidth: 1,
                borderRadius: tokens.radius,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: tokens.accentText, fontWeight: "600", flex: 1 }}>
                  {formatInstant(item.startsAt, timezone)}
                </Text>
                <Text style={{ color: tokens.accentText, fontWeight: "600" }}>{bookingCopy.booked}</Text>
              </View>
            </View>
          ))}
          {daySlots.map((slot) => {
            const active = slot.startsAt === selectedSlot;
            return (
              <Pressable
                key={slot.startsAt}
                accessibilityRole="button"
                accessibilityLabel={formatInstant(slot.startsAt, timezone)}
                testID={`slot-${slot.startsAt}`}
                disabled={!online}
                onPress={() => setSelectedSlot(slot.startsAt)}
                style={{
                  backgroundColor: tokens.card,
                  borderColor: active ? tokens.accent : tokens.border,
                  borderWidth: 1,
                  borderRadius: tokens.radius,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ color: active ? tokens.accentText : tokens.text, fontWeight: "600", flex: 1 }}>
                    {formatInstant(slot.startsAt, timezone)}
                  </Text>
                  <Text style={{ color: tokens.textTertiary }}>{`${slotMinutes} min`}</Text>
                </View>
              </Pressable>
            );
          })}
          {daySlots.length === 0 && dayOwn.length === 0 ? (
            <ScreenState kind="empty" title="No open slots" body={bookingCopy.noSlots} />
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: tokens.bgSoft,
            borderRadius: tokens.radius,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: tokens.text, fontWeight: "600", marginBottom: 6 }}>{bookingCopy.afterBookTitle}</Text>
          <Text style={{ color: tokens.textSecondary, lineHeight: 20 }}>{bookingCopy.afterBookBody}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={online ? "Book" : screenCopy.offlineAction}
          testID="book-button"
          disabled={!selected || pending || !online}
          onPress={() => {
            if (selected) void onBook(selected);
          }}
          style={{
            backgroundColor: tokens.accent,
            borderRadius: 14,
            minHeight: 44,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            opacity: !selected || pending || !online ? 0.6 : 1,
          }}
        >
          <Text style={{ color: tokens.onAccent, fontWeight: "700" }}>
            {selected
              ? `${upcoming ? "Book another at" : "Book"} ${formatInstant(selected.startsAt, timezone)}`
              : "Book"}
          </Text>
        </Pressable>
        {showIcs ? (
          <View testID="ics-actions" style={{ marginTop: 14, gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={bookingCopy.addToCalendar}
              disabled={!online}
              onPress={() => void onDownload()}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: tokens.accentText, fontWeight: "600", textAlign: "center" }}>
                {bookingCopy.addToCalendar}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={bookingCopy.subscribe}
              disabled={!online}
              onPress={() => void onSubscribe()}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: tokens.accentText, fontWeight: "600", textAlign: "center" }}>
                {bookingCopy.subscribe}
              </Text>
            </Pressable>
            {subscribeUrl ? (
              <Text testID="subscribe-url" style={{ color: tokens.textTertiary, fontSize: 12, textAlign: "center" }}>
                {subscribeUrl}
              </Text>
            ) : null}
            {linkError ? (
              <Text testID="link-error" style={{ color: tokens.error, fontSize: 13, textAlign: "center" }}>
                {linkError}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text testID="timezone-label" style={{ color: tokens.textTertiary, textAlign: "center", marginTop: 12 }}>
          {`Timezone: ${timezone}`}
        </Text>
        </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function zonedPartsToCivil(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function formatWhen(iso: string, timeZone: string): string {
  const parts = zonedParts(new Date(iso), timeZone);
  return `${formatCivil(parts)} · ${formatInstant(iso, timeZone)}`;
}
