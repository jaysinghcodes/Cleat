"use client";

import { CleatRequestError, listAuditEvents } from "@cleat/api";
import { aiCopy, auditTimeline, decisionLabel, type AuditEvent } from "@cleat/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "../../../session";
import { Banner } from "../../../ui";
import { ConfidenceBar } from "../../confidence";

function actionLabel(action: AuditEvent["trainerAction"]): string {
  if (action === "send_edited") return aiCopy.actionSendEdited;
  if (action === "send_as_is") return aiCopy.actionSendAsIs;
  if (action === "dismiss") return aiCopy.actionDismiss;
  return aiCopy.noneYet;
}

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function AuditDetail({ eventId }: { eventId: string }) {
  const { client } = useSession();
  const [event, setEvent] = useState<AuditEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    void listAuditEvents(client)
      .then((rows) => {
        if (cancelled) return;
        setEvent(rows.find((row) => row.id === eventId) ?? null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof CleatRequestError ? err.message : aiCopy.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [client, eventId]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{aiCopy.auditTitle}</h1>
          <p>
            <Link href="/audit">{aiCopy.backToAudit}</Link>
          </p>
        </div>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {!event && !error ? <p className="meta">{aiCopy.noAudits}</p> : null}
      {event ? (
        <div className="stack">
          <div className="card">
            <div className="name">{aiCopy.confidence}</div>
            <div style={{ marginTop: 12 }}>
              <ConfidenceBar value={event.confidence} threshold={event.threshold} decision={event.decision} />
            </div>
            <div className="row" style={{ marginTop: 16, alignItems: "flex-start" }}>
              <div className="spacer">
                <div className="meta">{aiCopy.thresholdLabel}</div>
                <div className="name">{event.threshold.toFixed(2)}</div>
              </div>
              <div className="spacer">
                <div className="meta">{aiCopy.decision}</div>
                <div className="name">{decisionLabel(event.decision)}</div>
              </div>
              <div className="spacer">
                <div className="meta">{aiCopy.template}</div>
                <div className="name">{event.templateId ?? aiCopy.noneYet}</div>
              </div>
              <div className="spacer">
                <div className="meta">{aiCopy.trainerAction}</div>
                <div className="name">{actionLabel(event.trainerAction)}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="name">{aiCopy.sources}</div>
            {event.chunks.length === 0 ? <p className="meta">{aiCopy.noneYet}</p> : null}
            {event.chunks.map((chunk) => (
              <p key={chunk.id} className="meta">
                {chunk.snippet}
              </p>
            ))}
          </div>
          <div className="card">
            <div className="name">{aiCopy.draft}</div>
            <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{event.draftText || aiCopy.noneYet}</p>
            <div className="name" style={{ marginTop: 16 }}>
              {aiCopy.finalText}
            </div>
            <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{event.finalText || aiCopy.noneYet}</p>
          </div>
          <div className="card">
            <div className="name">{aiCopy.timeline}</div>
            {auditTimeline(event).map((item) => (
              <p key={`${item.at}-${item.label}`} className="meta">
                {when(item.at)} · {item.label}
              </p>
            ))}
            <p className="meta">
              {aiCopy.model}: {event.model}
            </p>
            <p className="meta">
              {aiCopy.promptVersion}: {event.promptVersion}
            </p>
          </div>
          <div className="card">
            <div className="name">{aiCopy.rawJson}</div>
            <pre className="audit-json">{JSON.stringify(event, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
