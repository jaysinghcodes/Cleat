"use client";

import {
  CleatRequestError,
  accessToken,
  disconnectGoogle,
  googleStatus,
  loadTrainerCalendar,
  saveOrgCalendarSettings,
  saveUnansweredHours,
  startGoogleConnect,
  updateProfile,
} from "@cleat/api";
import {
  bookingCopy,
  copy,
  inboxCopy,
  parseUnansweredHours,
  profileUpdateSchema,
  resolveUnansweredHours,
  validationMessage,
  type PrimaryCalendar,
} from "@cleat/domain";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "../../session";
import { Banner, TextField } from "../../ui";

export function OrgDesk({ defaultWindowHours }: { defaultWindowHours: number }) {
  const { client, session, membership, refresh } = useSession();
  const [displayName, setDisplayName] = useState(membership?.displayName ?? "");
  const [timezone, setTimezone] = useState(membership?.timezone ?? "UTC");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [cutoff, setCutoff] = useState("12");
  const [windowHours, setWindowHours] = useState(String(defaultWindowHours));
  const [primary, setPrimary] = useState<PrimaryCalendar>("ics");
  const [google, setGoogle] = useState({ configured: false, connected: false, email: null as string | null });
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("google");
    if (flag === "connected") setGoogleNotice("Google Calendar connected.");
    else if (flag === "denied") setGoogleNotice("Google Calendar was not connected.");
    else if (flag === "storage") setGoogleNotice("Google Calendar could not be saved.");
  }, []);

  useEffect(() => {
    if (!client || !session || !membership) return;
    let alive = true;
    void (async () => {
      try {
        const calendar = await loadTrainerCalendar(client, membership.orgId);
        if (!alive) return;
        setCutoff(String(calendar.settings.cancelCutoffHours));
        setPrimary(calendar.settings.primaryCalendar);
        const org = await client.from("orgs").select("unanswered_hours").eq("id", membership.orgId).maybeSingle();
        if (!org.error && org.data) {
          const row = org.data as { unanswered_hours?: unknown };
          setWindowHours(String(resolveUnansweredHours(row.unanswered_hours, defaultWindowHours)));
        }
      } catch (err) {
        if (alive) setError(err instanceof CleatRequestError ? err.message : copy.generic);
      }
      try {
        const token = await accessToken(client);
        const status = await googleStatus("", token);
        if (alive) setGoogle(status);
      } catch {
        if (alive) setGoogle({ configured: false, connected: false, email: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, session, membership, defaultWindowHours]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client || !session) return;
    const parsed = profileUpdateSchema.safeParse({ displayName, timezone });
    if (!parsed.success) {
      setSaved(false);
      setError(validationMessage(parsed.error));
      return;
    }
    const unanswered = parseUnansweredHours(windowHours);
    if (unanswered === null) {
      setSaved(false);
      setError(inboxCopy.windowInvalid);
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    const hours = Number(cutoff);
    if (!Number.isInteger(hours)) {
      setSaved(false);
      setError("Enter a cutoff between 0 and 168 hours.");
      return;
    }
    try {
      await updateProfile(client, session.userId, parsed.data);
      await saveOrgCalendarSettings(client, membership?.orgId ?? "", {
        cancelCutoffHours: hours,
        primaryCalendar: google.connected ? primary : "ics",
      });
      await saveUnansweredHours(client, membership?.orgId ?? "", unanswered);
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof CleatRequestError ? err.message : copy.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Org / Billing</h1>
          <p>{membership ? `Org: ${membership.orgName}` : "Org"}</p>
        </div>
      </div>
      <div className="card">
        {error ? <Banner tone="error">{error}</Banner> : null}
        {saved ? <Banner tone="ok">Saved</Banner> : null}
        <form onSubmit={(event) => void onSubmit(event)}>
          <TextField
            id="display-name"
            label="Display name"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <TextField
            id="timezone"
            label="Timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
          <fieldset id="primary-calendar" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
            <legend className="name" style={{ marginBottom: 8 }}>Primary calendar</legend>
            <label className="choice">
              <input
                type="radio"
                name="primary-calendar"
                checked={primary === "ics" || !google.connected}
                onChange={() => setPrimary("ics")}
              />
              {bookingCopy.primaryIcs}
            </label>
            {google.connected ? (
              <label className="choice">
                <input
                  type="radio"
                  name="primary-calendar"
                  checked={primary === "google"}
                  onChange={() => setPrimary("google")}
                />
                {bookingCopy.primaryGoogle}
              </label>
            ) : null}
          </fieldset>
          <TextField
            id="cancel-cutoff"
            label={bookingCopy.cutoffLabel}
            inputMode="numeric"
            value={cutoff}
            onChange={(event) => setCutoff(event.target.value)}
          />
          <TextField
            id="unanswered-hours"
            label={inboxCopy.windowLabel}
            inputMode="numeric"
            value={windowHours}
            onChange={(event) => setWindowHours(event.target.value)}
          />
          <p className="meta" style={{ marginTop: -6 }}>{inboxCopy.windowHint}</p>
          {googleNotice ? (
            <Banner tone={googleNotice.startsWith("Google Calendar connected") || googleNotice.startsWith("ICS") ? "ok" : "error"}>
              {googleNotice}
            </Banner>
          ) : null}
          {google.configured && !google.connected ? (
            <button
              className="btn btn-soft"
              type="button"
              style={{ marginBottom: 12 }}
              onClick={() => {
                if (!client) return;
                void accessToken(client)
                  .then((token) => startGoogleConnect("", token))
                  .then((url) => {
                    window.location.href = url;
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof CleatRequestError ? err.message : copy.generic);
                  });
              }}
            >
              {bookingCopy.googleConnect}
            </button>
          ) : null}
          {google.connected ? (
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="meta">{bookingCopy.googleConnected}</span>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  if (!client) return;
                  void accessToken(client)
                    .then((token) => disconnectGoogle("", token))
                    .then(() => {
                      setGoogle({ configured: google.configured, connected: false, email: null });
                      setPrimary("ics");
                      setGoogleNotice("ICS feed is ready.");
                    })
                    .catch((err: unknown) => {
                      setError(err instanceof CleatRequestError ? err.message : copy.generic);
                    });
                }}
              >
                {bookingCopy.googleDisconnect}
              </button>
            </div>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            Save
          </button>
        </form>
      </div>
      <div className="card">
        <p className="meta">{copy.billingLater}</p>
      </div>
    </>
  );
}
