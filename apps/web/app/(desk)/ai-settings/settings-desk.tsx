"use client";

import { CleatRequestError, fetchAiSettings, listAuditEvents, saveAiSettings } from "@cleat/api";
import { aiCopy, auditCounts, DEFAULT_AI_SETTINGS } from "@cleat/domain";
import { useEffect, useState } from "react";
import { useSession } from "../../session";
import { Banner } from "../../ui";

const EMERGENCY = [
  aiCopy.emergencyItems,
  aiCopy.fainting,
  aiCopy.breathing,
  aiCopy.bleeding,
  aiCopy.stroke,
  aiCopy.selfHarm,
];

const MEDICAL = [aiCopy.injury, aiCopy.medical, aiCopy.medication, aiCopy.nutrition];

export function SettingsDesk() {
  const { client, membership } = useSession();
  const [autoSend, setAutoSend] = useState<boolean>(DEFAULT_AI_SETTINGS.autoSend);
  const [threshold, setThreshold] = useState<number>(DEFAULT_AI_SETTINGS.threshold);
  const [signOff, setSignOff] = useState("");
  const [toneNotes, setToneNotes] = useState("");
  const [counts, setCounts] = useState({ autoSent: 0, escalated: 0, hardRefuse: 0, trainerEdited: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!client) return;
    void Promise.all([fetchAiSettings(client), listAuditEvents(client)])
      .then(([settings, events]) => {
        if (settings) {
          setAutoSend(settings.autoSend);
          setThreshold(settings.threshold);
          setSignOff(settings.signOff);
          setToneNotes(settings.toneNotes);
        }
        setCounts(auditCounts(events));
      })
      .catch((err: unknown) => {
        setError(err instanceof CleatRequestError ? err.message : aiCopy.loadFailed);
      });
  }, [client]);

  async function onSave() {
    if (!client || !membership) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await saveAiSettings(client, {
        orgId: membership.orgId,
        autoSend,
        threshold,
        signOff,
        toneNotes,
      });
      setNotice(aiCopy.settingsSaved);
    } catch (err: unknown) {
      setError(err instanceof CleatRequestError ? err.message : aiCopy.settingsFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{aiCopy.settingsTitle}</h1>
          <p>{aiCopy.settingsLede}</p>
        </div>
        <button className="btn btn-primary" type="button" disabled={pending} onClick={() => void onSave()}>
          {aiCopy.saveSettings}
        </button>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      <div className="card">
        <div className="row">
          <div className="spacer">
            <div className="name">{aiCopy.autoSend}</div>
            <p className="meta">{aiCopy.autoSendHelp}</p>
          </div>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={autoSend}
            aria-label={aiCopy.autoSend}
            onClick={() => setAutoSend((current) => !current)}
          >
            <i />
          </button>
          <span className="meta">{autoSend ? aiCopy.autoSendOn : aiCopy.autoSendOff}</span>
        </div>
      </div>
      <div className="card">
        <div className="name">{aiCopy.threshold}</div>
        <p className="meta" style={{ margin: "6px 0 12px" }}>
          {aiCopy.thresholdHelp}
        </p>
        <div className="row">
          <input
            aria-label={aiCopy.threshold}
            type="range"
            min={0.6}
            max={0.95}
            step={0.01}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            style={{ flex: 1 }}
          />
          <span className="confidence-num">{threshold.toFixed(2)}</span>
        </div>
        <p className="meta" style={{ marginTop: 8 }}>
          {aiCopy.floorLocked}
        </p>
      </div>
      <div className="card">
        <div className="name">{aiCopy.hardRefuse}</div>
        <p className="meta" style={{ margin: "6px 0 12px" }}>
          {aiCopy.hardRefuseHelp}
        </p>
        <div className="name">{aiCopy.emergencyGroup}</div>
        <ul className="locked-list">
          {EMERGENCY.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="name">{aiCopy.medicalGroup}</div>
        <ul className="locked-list">
          {MEDICAL.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="name">{aiCopy.alwaysDraft}</div>
        <ul className="locked-list">
          <li>{aiCopy.asksCoach}</li>
          <li>{aiCopy.programSwaps}</li>
        </ul>
      </div>
      <div className="card">
        <div className="name">{aiCopy.voice}</div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="sign-off">{aiCopy.signOff}</label>
          <input id="sign-off" value={signOff} maxLength={120} onChange={(event) => setSignOff(event.target.value)} />
        </div>
        <p className="meta">{aiCopy.signOffHint}</p>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="tone-notes">{aiCopy.toneNotes}</label>
          <textarea
            id="tone-notes"
            value={toneNotes}
            maxLength={500}
            onChange={(event) => setToneNotes(event.target.value)}
          />
        </div>
      </div>
      <div className="card">
        <div className="name" style={{ marginBottom: 12 }}>
          {aiCopy.last7}
        </div>
        <div className="stat-grid">
          <Stat label={aiCopy.statAuto} value={counts.autoSent} dot="done" />
          <Stat label={aiCopy.statEscalated} value={counts.escalated} dot="skip" />
          <Stat label={aiCopy.statRefuse} value={counts.hardRefuse} dot="nudge" />
          <Stat label={aiCopy.statEdited} value={counts.trainerEdited} dot="partial" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="stat-card">
      <div className="label">
        <span className={`status-dot ${dot}`} />
        {label}
      </div>
      <div className="value">{value}</div>
    </div>
  );
}
