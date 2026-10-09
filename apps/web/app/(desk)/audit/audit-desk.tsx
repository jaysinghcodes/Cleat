"use client";

import { listAuditEvents, listClients } from "@cleat/api";
import {
  aiCopy,
  decisionLabel,
  screenCopy,
  userFacingError,
  type AuditEvent,
  type ClientRosterItem,
} from "@cleat/domain";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ScreenState } from "../../screen-state";
import { useSession } from "../../session";
import { ConfidenceBar } from "../confidence";

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function AuditDesk() {
  const { client } = useSession();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [roster, setRoster] = useState<ClientRosterItem[]>([]);
  const [clientId, setClientId] = useState("");
  const [decision, setDecision] = useState<"" | AuditEvent["decision"]>("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    void Promise.all([
      listAuditEvents(client, {
        clientId: clientId || undefined,
        decision: decision || undefined,
      }),
      listClients(client),
    ])
      .then(([rows, people]) => {
        if (cancelled) return;
        setEvents(rows);
        setRoster(people);
        setError(null);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(userFacingError(err, screenCopy.loadFailed));
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, clientId, decision, attempt]);

  const names = useMemo(() => new Map(roster.map((person) => [person.userId, person.displayName])), [roster]);

  function onExport() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cleat-audit.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{aiCopy.auditTitle}</h1>
          <p>{aiCopy.auditLede}</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={onExport}>
          {aiCopy.exportJson}
        </button>
      </div>
      {status === "loading" ? <ScreenState kind="loading" title={screenCopy.loadingAudit} /> : null}
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
      {status === "ready" ? (
      <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="audit-client">{aiCopy.allClients}</label>
            <select id="audit-client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">{aiCopy.allClients}</option>
              {roster.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="audit-decision">{aiCopy.decision}</label>
            <select
              id="audit-decision"
              value={decision}
              onChange={(event) => setDecision(event.target.value as "" | AuditEvent["decision"])}
            >
              <option value="">{aiCopy.allDecisions}</option>
              <option value="auto_send">{aiCopy.decisionAuto}</option>
              <option value="escalate">{aiCopy.decisionEscalate}</option>
              <option value="hard_refuse">{aiCopy.decisionRefuse}</option>
            </select>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {events.length === 0 ? (
          <ScreenState kind="empty" title="No AI actions yet" body={aiCopy.noAudits} />
        ) : (
          events.map((event) => (
            <Link key={event.id} href={`/audit/${event.id}`} className="list-row article-row">
              <div className="spacer">
                <div className="name">{names.get(event.clientId) ?? event.clientId}</div>
                <div className="meta">
                  {decisionLabel(event.decision)} · {when(event.createdAt)}
                </div>
              </div>
              <ConfidenceBar value={event.confidence} threshold={event.threshold} decision={event.decision} />
            </Link>
          ))
        )}
      </div>
      </>
      ) : null}
    </div>
  );
}
