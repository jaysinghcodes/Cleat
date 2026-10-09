"use client";

import { fetchAccountability, sendNudge } from "@cleat/api";
import {
  copy,
  deferredPushDelivery,
  firstName,
  inboxCopy,
  inboxHref,
  initials,
  nudgeBody,
  programCopy,
  screenCopy,
  userFacingError,
  type BoardAction,
  type BoardRow,
  type TodayStatus,
} from "@cleat/domain";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { haltForPreview, PREVIEW_FAILURE } from "../../preview-mode";
import { useSession } from "../../session";
import { ScreenState } from "../../screen-state";
import { Banner } from "../../ui";

function pillClass(status: TodayStatus): string {
  if (status === "done") return "pill pill-done";
  if (status === "partial") return "pill pill-partial";
  if (status === "skipped") return "pill pill-skip";
  if (status === "missed") return "pill pill-missed";
  return "pill pill-muted";
}

function actionLabel(action: BoardAction): string {
  if (action === "send") return "Send nudge";
  if (action === "soft") return "Soft nudge";
  return "Message";
}

export default function AccountabilityPage() {
  const { client, membership } = useSession();
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [counts, setCounts] = useState({ done: 0, skipped: 0, needsNudge: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    if (!client || !membership) return;
    const snapshot = await fetchAccountability(client, membership.timezone);
    setRows(snapshot.rows);
    setCounts(snapshot.counts);
    setLoadFailed(false);
    setReady(true);
  }, [client, membership]);

  useEffect(() => {
    if (
      haltForPreview({
        error: () => {
          setError(PREVIEW_FAILURE);
          setLoadFailed(true);
          setReady(true);
        },
        ready: () => {
          setRows([]);
          setLoadFailed(false);
          setError(null);
          setReady(true);
        },
      })
    ) {
      return;
    }
    let alive = true;
    void load().catch((err: unknown) => {
      if (!alive) return;
      setError(userFacingError(err, screenCopy.loadFailed));
      setLoadFailed(true);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  async function onNudge(row: BoardRow) {
    if (!client || !membership || row.action === "message") return;
    const kind = row.action === "soft" ? "soft" : "nudge";
    const body = nudgeBody(kind, membership.displayName);
    setPendingId(row.userId);
    setError(null);
    setNotice(null);
    try {
      await sendNudge(client, row.userId, kind, body);
      await deferredPushDelivery.sendNudge({
        clientId: row.userId,
        title: "Cleat",
        body,
      });
      setNotice(`Nudge sent to ${row.displayName}.`);
      await load();
    } catch (err) {
      setError(userFacingError(err, copy.generic));
    } finally {
      setPendingId(null);
    }
  }

  const primary = rows.find((row) => row.action === "send") ?? rows.find((row) => row.action === "soft");

  return (
    <div data-testid="accountability-page">
      <div className="page-head">
        <div>
          <h1>Accountability</h1>
          <p>Who finished today · who skipped · who needs a nudge</p>
        </div>
        <div className="row">
          <span className="btn btn-ghost btn-sm">Today</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="send-nudge-header"
            disabled={!primary || pendingId !== null}
            onClick={() => {
              if (primary) void onNudge(primary);
            }}
          >
            {primary ? actionLabel(primary.action) : "Send nudge"}
          </button>
        </div>
      </div>
      {error && !loadFailed ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      {!ready ? <ScreenState kind="loading" title={screenCopy.loadingBoard} /> : null}
      {ready && loadFailed ? (
        <ScreenState
          kind="error"
          title={screenCopy.couldNotLoad}
          body={error ?? screenCopy.loadFailed}
          onRetry={() => {
            setReady(false);
            setLoadFailed(false);
            setError(null);
            void load().catch((err: unknown) => {
              setError(userFacingError(err, screenCopy.loadFailed));
              setLoadFailed(true);
              setReady(true);
            });
          }}
        />
      ) : null}
      {ready && !loadFailed && rows.length === 0 ? (
        <div className="card" data-testid="accountability-empty">
          <div className="name">No clients yet</div>
          <p className="meta">{programCopy.emptyBoard}</p>
        </div>
      ) : null}
      {ready && !loadFailed && rows.length > 0 ? (
        <>
          <div className="grid-3" style={{ marginBottom: 20 }}>
            <div className="card stat-card">
              <div className="label">
                <span className="status-dot done" />
                Done
              </div>
              <div className="value">{counts.done}</div>
              <div className="hint">{programCopy.doneHint}</div>
            </div>
            <div className="card stat-card">
              <div className="label">
                <span className="status-dot skip" />
                Skipped
              </div>
              <div className="value">{counts.skipped}</div>
              <div className="hint">{programCopy.skippedHint}</div>
            </div>
            <div className="card stat-card">
              <div className="label">
                <span className="status-dot nudge" />
                Needs nudge
              </div>
              <div className="value">{counts.needsNudge}</div>
              <div className="hint">{programCopy.nudgeRule}</div>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="list-row" style={{ background: "var(--bg-soft)" }}>
              <div style={{ width: 36 }} />
              <div className="spacer">
                <strong style={{ fontSize: 12, color: "var(--sub)", letterSpacing: "0.04em" }}>CLIENT</strong>
              </div>
              <div className="board-today" style={{ fontSize: 12, color: "var(--sub)", fontWeight: 600 }}>
                TODAY
              </div>
              <div className="board-adherence" style={{ fontSize: 12, color: "var(--sub)", fontWeight: 600 }}>
                ADHERENCE
              </div>
              <div className="board-action" style={{ fontSize: 12, color: "var(--sub)", fontWeight: 600 }}>
                ACTION
              </div>
            </div>
            {rows.map((row) => (
              <div
                className={row.needsNudge ? "list-row rail-urgent" : "list-row"}
                key={row.userId}
                data-testid={`board-row-${row.userId}`}
              >
                <div className={row.needsNudge ? "avatar nudge" : "avatar"}>{initials(row.displayName)}</div>
                <div className="spacer">
                  <div className="name">{row.displayName}</div>
                  <div className="meta">{row.summary}</div>
                </div>
                <div className="board-today">
                  <span className={pillClass(row.today)}>{row.todayLabel}</span>
                </div>
                <div className="board-adherence">
                  <div>{row.adherence}</div>
                  <div className="meta">{row.lastLogged}</div>
                </div>
                <div className="board-action inbox-board-action">
                  {row.action === "message" ? (
                    <Link className="btn btn-ghost btn-sm" href="/chat">
                      Message
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={row.action === "send" ? "btn btn-danger btn-sm" : "btn btn-soft btn-sm"}
                      data-testid={`nudge-${row.userId}`}
                      disabled={pendingId !== null}
                      onClick={() => void onNudge(row)}
                    >
                      {pendingId === row.userId ? "Sending" : actionLabel(row.action)}
                    </button>
                  )}
                  <Link
                    className="meta"
                    data-testid={`open-inbox-${row.userId}`}
                    href={inboxHref({
                      clientId: row.userId,
                      focus: row.needsNudge ? "missed" : undefined,
                    })}
                  >
                    {inboxCopy.openInbox}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="meta" style={{ marginTop: 12 }}>
            {programCopy.nudgeRule} {primary ? `${firstName(primary.displayName)} is first.` : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
