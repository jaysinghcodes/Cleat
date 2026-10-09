"use client";

import {
  accessToken,
  clearAvailabilityOverride,
  listClients,
  loadTrainerCalendar,
  saveAvailabilityOverride,
  saveSlotMinutes,
  saveWeeklyAvailability,
  subscribeLink,
  cancelSession,
} from "@cleat/api";
import {
  WEEKDAY_LABELS,
  addDays,
  blocksForDay,
  bookingCopy,
  civilToKey,
  screenCopy,
  userFacingError,
  copy,
  draftFromBlocks,
  firstName,
  formatCivil,
  formatInstant,
  formatMinuteRange,
  formatWeekLabel,
  keyToCivil,
  minuteFromTimeInput,
  openSlots,
  startOfWeekMonday,
  timeInputFromMinute,
  weekDays,
  zonedParts,
  zonedTimeToUtc,
  type SessionRecord,
  type WeeklyDraft,
} from "@cleat/domain";
import { useCallback, useEffect, useMemo, useState } from "react";
import { haltForPreview, PREVIEW_FAILURE } from "../../preview-mode";
import { useSession } from "../../session";
import { ScreenState } from "../../screen-state";
import { Banner } from "../../ui";

const SLOT_CHOICES = [30, 45, 60, 90];

export default function CalendarPage() {
  const { client, session, membership } = useSession();
  const timezone = membership?.timezone || "UTC";
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date(), timezone));
  const [blocks, setBlocks] = useState<Awaited<ReturnType<typeof loadTrainerCalendar>>["blocks"]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [draft, setDraft] = useState<WeeklyDraft[]>(() => draftFromBlocks([]));
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [subscribeUrl, setSubscribeUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideOff, setOverrideOff] = useState(false);
  const [overrideStart, setOverrideStart] = useState("17:00");
  const [overrideEnd, setOverrideEnd] = useState("20:00");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!client || !membership) return;
    const [calendar, roster] = await Promise.all([
      loadTrainerCalendar(client, membership.orgId),
      listClients(client),
    ]);
    setBlocks(calendar.blocks);
    setSessions(calendar.sessions);
    setSlotMinutes(calendar.slotMinutes);
    setDraft(draftFromBlocks(calendar.blocks));
    setNames(new Map(roster.map((person) => [person.userId, person.displayName])));
    setStatus("ready");
  }, [client, membership]);

  useEffect(() => {
    if (
      haltForPreview({
        error: () => {
          setError(PREVIEW_FAILURE);
          setStatus("error");
        },
        ready: () => {
          setBlocks([]);
          setSessions([]);
          setNames(new Map());
          setError(null);
          setStatus("ready");
        },
      })
    ) {
      return;
    }
    void load().catch((err: unknown) => {
      setError(userFacingError(err, screenCopy.loadFailed));
      setStatus("error");
    });
  }, [load, attempt]);

  const days = weekDays(weekStart);
  const weekStartInstant = zonedTimeToUtc(weekStart, 0, 0, timezone);
  const weekEndInstant = zonedTimeToUtc(addDays(weekStart, 7), 0, 0, timezone);
  const bookedThisWeek = sessions.filter((item) => {
    const start = new Date(item.startsAt).getTime();
    return item.status === "booked" && start >= weekStartInstant.getTime() && start < weekEndInstant.getTime();
  });
  const openCount = days.reduce((total, day) => {
    return (
      total +
      openSlots({
        day,
        timeZone: timezone,
        blocks,
        slotMinutes,
        booked: sessions
          .filter((item) => item.status === "booked")
          .map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt })),
      }).length
    );
  }, 0);
  const recentCancels = sessions
    .filter((item) => {
      if (item.status !== "cancelled" || !item.cancelledAt) return false;
      return Date.now() - new Date(item.cancelledAt).getTime() <= 7 * 86_400_000;
    })
    .sort((a, b) => new Date(b.cancelledAt ?? 0).getTime() - new Date(a.cancelledAt ?? 0).getTime());
  const cancelHint = useMemo(() => {
    const latest = recentCancels[0];
    if (!latest) return "None this week";
    const parts = zonedParts(new Date(latest.startsAt), timezone);
    const name = firstName(names.get(latest.clientId) ?? "Client");
    return `${name} · ${formatCivil({ year: parts.year, month: parts.month, day: parts.day }).split(" ")[0]}`;
  }, [names, recentCancels, timezone]);

  async function onSaveAvailability() {
    if (!client || !session) return;
    if (draft.some((day) => day.available && day.endMinute <= day.startMinute)) {
      setError("End time must be after the start time.");
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await saveSlotMinutes(client, session.userId, slotMinutes);
      await saveWeeklyAvailability(client, membership?.orgId ?? "", session.userId, draft);
      await load();
      setEditing(false);
      setNotice("Saved");
    } catch (err) {
      setError(userFacingError(err, copy.generic));
    } finally {
      setPending(false);
    }
  }

  async function onSaveOverride() {
    if (!client || !session || !membership) return;
    const start = minuteFromTimeInput(overrideStart);
    const end = minuteFromTimeInput(overrideEnd);
    if (!overrideDate || start === null || end === null) {
      setError("Choose a date and a time range.");
      return;
    }
    if (!overrideOff && end <= start) {
      setError("End time must be after the start time.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await saveAvailabilityOverride(client, membership.orgId, session.userId, {
        date: overrideDate,
        available: !overrideOff,
        startMinute: start,
        endMinute: end,
      });
      await load();
      setWeekStart(startOfWeekMonday(zonedTimeToUtc(keyToCivil(overrideDate), 12, 0, timezone), timezone));
      setNotice("Saved");
    } catch (err) {
      setError(userFacingError(err, copy.generic));
    } finally {
      setPending(false);
    }
  }

  async function onClearOverride() {
    if (!client || !session || !overrideDate) return;
    setPending(true);
    setError(null);
    try {
      await clearAvailabilityOverride(client, session.userId, overrideDate);
      await load();
      setNotice("Saved");
    } catch (err) {
      setError(userFacingError(err, copy.generic));
    } finally {
      setPending(false);
    }
  }

  async function onSync(regenerate = false) {
    if (!client) return;
    setPending(true);
    setError(null);
    try {
      const token = await accessToken(client);
      const link = await subscribeLink("", token, regenerate);
      setSubscribeUrl(link.url);
      setSyncing(true);
      setCopied(false);
    } catch (err) {
      setError(userFacingError(err, copy.generic));
    } finally {
      setPending(false);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(subscribeUrl);
      setCopied(true);
    } catch {
      setError(copy.generic);
    }
  }

  async function onCancel(sessionId: string) {
    if (!client) return;
    setPending(true);
    setError(null);
    try {
      const token = await accessToken(client);
      await cancelSession("", token, sessionId);
      setCancelId(null);
      await load();
      setNotice("Session cancelled");
    } catch (err) {
      setError(userFacingError(err, copy.generic));
    } finally {
      setPending(false);
    }
  }

  return (
    <div id="calendar-page">
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p>{bookingCopy.calendarSubtitle}</p>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            {bookingCopy.previousWeek}
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            {bookingCopy.nextWeek}
          </button>
          <button className="btn btn-soft btn-sm" type="button" onClick={() => setEditing((value) => !value)}>
            {bookingCopy.editAvailability}
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => void onSync(false)} disabled={pending}>
            {bookingCopy.syncIcs}
          </button>
        </div>
      </div>
      {status === "ready" && error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      {status === "loading" ? <ScreenState kind="loading" title={screenCopy.loadingCalendar} /> : null}
      {status === "error" ? (
        <ScreenState
          kind="error"
          title={screenCopy.couldNotLoad}
          body={error ?? screenCopy.loadFailed}
          onRetry={() => {
            setStatus("loading");
            setError(null);
            setAttempt((value) => value + 1);
          }}
        />
      ) : null}
      {status === "ready" && blocks.length === 0 && sessions.length === 0 ? (
        <ScreenState kind="empty" title={screenCopy.emptyCalendarTitle} body={screenCopy.emptyCalendarBody} />
      ) : null}
      {status === "ready" ? (
      <>
      <div className="grid-3">
        <div className="card stat-card">
          <div className="label">{bookingCopy.thisWeek}</div>
          <div className="value" id="stat-booked">{bookedThisWeek.length}</div>
          <div className="hint">{bookingCopy.bookedSessions}</div>
        </div>
        <div className="card stat-card">
          <div className="label">{bookingCopy.openSlots}</div>
          <div className="value" id="stat-open">{openCount}</div>
          <div className="hint">{bookingCopy.visibleToClients}</div>
        </div>
        <div className="card stat-card">
          <div className="label">{bookingCopy.cancels}</div>
          <div className="value" id="stat-cancels">{recentCancels.length}</div>
          <div className="hint">{cancelHint}</div>
        </div>
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <div className="name" id="week-label">{formatWeekLabel(weekStart)}</div>
          <div className="spacer" />
          <span className="meta">{timezone} · {bookingCopy.primaryIcs}</span>
        </div>
        <div className="cal-grid">
          {days.map((day) => {
            const key = civilToKey(day);
            const daySessions = bookedThisWeek.filter((item) => {
              const parts = zonedParts(new Date(item.startsAt), timezone);
              return parts.year === day.year && parts.month === day.month && parts.day === day.day;
            });
            const windows = blocksForDay(day, blocks).filter((block) => block.available);
            const open = openSlots({
              day,
              timeZone: timezone,
              blocks,
              slotMinutes,
              booked: sessions
                .filter((item) => item.status === "booked")
                .map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt })),
            });
            return (
              <div className="cal-cell" key={key}>
                <div className="day">{formatCivil(day).split(" ")[0]} {day.day}</div>
                {daySessions.map((item) => (
                  <button
                    key={item.id}
                    className="cal-event"
                    type="button"
                    id={`session-${item.id}`}
                    onClick={() => setCancelId(item.id)}
                  >
                    {formatInstant(item.startsAt, timezone)} {firstName(names.get(item.clientId) ?? "Client")}
                  </button>
                ))}
                {daySessions.length === 0 && windows[0] ? (
                  <div className="meta">Open {formatMinuteRange(windows[0].startMinute, windows[0].endMinute)}</div>
                ) : null}
                {daySessions.length === 0 && windows.length === 0 ? <div className="meta">{bookingCopy.off}</div> : null}
                {open.length > 0 && daySessions.length > 0 ? (
                  <div className="meta">{open.length} open</div>
                ) : null}
              </div>
            );
          })}
        </div>
        {cancelId ? (
          <div id="trainer-cancel" style={{ marginTop: 16 }}>
            <p className="help">{bookingCopy.cancelConfirm}</p>
            <div className="row">
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setCancelId(null)}>
                {bookingCopy.keepSession}
              </button>
              <button className="btn btn-danger btn-sm" type="button" disabled={pending} onClick={() => void onCancel(cancelId)}>
                {bookingCopy.cancelSession}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="card">
        <div className="name" style={{ marginBottom: 12 }}>Availability defaults</div>
        <div className="stack">
          <div className="row">
            <span className="meta" style={{ width: 80 }}>Mon to Fri</span>
            <span className="name" style={{ fontSize: 13 }}>
              {weekdaySummary(draft, [1, 2, 3, 4, 5])}
            </span>
            <div className="spacer" />
            <span className="pill pill-accent" id="slot-pill">{slotMinutes} min slots</span>
          </div>
          <div className="row">
            <span className="meta" style={{ width: 80 }}>Sat to Sun</span>
            <span className="name" style={{ fontSize: 13 }}>{weekdaySummary(draft, [6, 0])}</span>
          </div>
        </div>
      </div>
      {editing ? (
        <div className="card" id="availability-editor">
          <div className="field">
            <label htmlFor="slot-length">{bookingCopy.slotLabel}</label>
            <select
              id="slot-length"
              value={slotMinutes}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                setSlotMinutes(minutes);
                if (!client || !session) return;
                void saveSlotMinutes(client, session.userId, minutes).catch((err: unknown) => {
                  setError(userFacingError(err, copy.generic));
                });
              }}
            >
              {(SLOT_CHOICES.includes(slotMinutes) ? SLOT_CHOICES : [slotMinutes, ...SLOT_CHOICES]).map((minutes) => (
                <option key={minutes} value={minutes}>{minutes} min</option>
              ))}
            </select>
          </div>
          {draft.map((day, index) => (
            <div className="row" key={day.weekday} style={{ marginBottom: 8 }}>
              <span className="meta" style={{ width: 40 }}>{WEEKDAY_LABELS[day.weekday]}</span>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={day.available}
                  onChange={(event) => {
                    const next = draft.slice();
                    next[index] = { ...day, available: event.target.checked };
                    setDraft(next);
                  }}
                />
                Open
              </label>
              <input
                aria-label={`${WEEKDAY_LABELS[day.weekday]} start`}
                type="time"
                value={timeInputFromMinute(day.startMinute)}
                disabled={!day.available}
                onChange={(event) => {
                  const minute = minuteFromTimeInput(event.target.value);
                  if (minute === null) return;
                  const next = draft.slice();
                  next[index] = { ...day, startMinute: minute };
                  setDraft(next);
                }}
              />
              <span className="meta">to</span>
              <input
                aria-label={`${WEEKDAY_LABELS[day.weekday]} end`}
                type="time"
                value={timeInputFromMinute(day.endMinute)}
                disabled={!day.available}
                onChange={(event) => {
                  const minute = minuteFromTimeInput(event.target.value);
                  if (minute === null) return;
                  const next = draft.slice();
                  next[index] = { ...day, endMinute: minute };
                  setDraft(next);
                }}
              />
            </div>
          ))}
          <button className="btn btn-primary btn-sm" type="button" disabled={pending} onClick={() => void onSaveAvailability()}>
            {bookingCopy.saveAvailability}
          </button>
          <div className="name" style={{ margin: "18px 0 8px" }}>Override</div>
          <div className="row">
            <input id="override-date" aria-label="Override date" type="date" value={overrideDate} onChange={(event) => setOverrideDate(event.target.value)} />
            <label className="choice">
              <input type="checkbox" checked={overrideOff} onChange={(event) => setOverrideOff(event.target.checked)} />
              {bookingCopy.unavailable}
            </label>
            <input aria-label="Override start" type="time" value={overrideStart} onChange={(event) => setOverrideStart(event.target.value)} />
            <span className="meta">to</span>
            <input aria-label="Override end" type="time" value={overrideEnd} onChange={(event) => setOverrideEnd(event.target.value)} />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-soft btn-sm" type="button" disabled={pending} onClick={() => void onSaveOverride()}>
              {bookingCopy.saveOverride}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" disabled={pending || !overrideDate} onClick={() => void onClearOverride()}>
              {bookingCopy.clearOverride}
            </button>
          </div>
        </div>
      ) : null}
      {syncing ? (
        <div className="card" id="ics-sync">
          <div className="name" style={{ marginBottom: 8 }}>{bookingCopy.syncIcs}</div>
          <p className="help">Paste this link into Apple Calendar, Outlook, or Google Calendar from URL. It refreshes within 60 seconds.</p>
          <div className="field">
            <label htmlFor="subscribe-url">Subscribe URL</label>
            <input id="subscribe-url" className="mono" readOnly value={subscribeUrl} />
          </div>
          <div className="row">
            <button className="btn btn-primary btn-sm" type="button" onClick={() => void onCopy()}>
              {copied ? bookingCopy.linkCopied : bookingCopy.copyLink}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" disabled={pending} onClick={() => void onSync(true)}>
              {bookingCopy.regenerate}
            </button>
          </div>
          <p className="meta">{bookingCopy.regenerateHint}</p>
        </div>
      ) : null}
      </>
      ) : null}
    </div>
  );
}

function weekdaySummary(draft: WeeklyDraft[], weekdays: number[]): string {
  const rows = draft.filter((day) => weekdays.includes(day.weekday) && day.available);
  if (rows.length === 0) return bookingCopy.unavailable;
  const first = rows[0];
  if (!first) return bookingCopy.unavailable;
  const same = rows.every((day) => day.startMinute === first.startMinute && day.endMinute === first.endMinute);
  if (!same) return "Custom hours";
  return formatMinuteRange(first.startMinute, first.endMinute);
}
