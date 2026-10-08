"use client";

import { CleatRequestError, listTrainerNotices, markNoticeRead } from "@cleat/api";
import { aiCopy, type TrainerNotice } from "@cleat/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "../../session";
import { Banner } from "../../ui";

export function InboxDesk() {
  const { client } = useSession();
  const [notices, setNotices] = useState<TrainerNotice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    void listTrainerNotices(client)
      .then((rows) => {
        if (!cancelled) setNotices(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof CleatRequestError ? err.message : aiCopy.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  async function onOpen(notice: TrainerNotice) {
    if (!client || notice.readAt) return;
    try {
      await markNoticeRead(client, notice.id);
      setNotices((current) =>
        current.map((item) => (item.id === notice.id ? { ...item, readAt: new Date().toISOString() } : item)),
      );
    } catch (err: unknown) {
      setError(err instanceof CleatRequestError ? err.message : aiCopy.loadFailed);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{aiCopy.inboxTitle}</h1>
          <p>{aiCopy.inboxLede}</p>
        </div>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <div className="card" style={{ padding: 0 }}>
        {notices.length === 0 ? (
          <div className="list-row">
            <div className="meta">{aiCopy.noNotices}</div>
          </div>
        ) : (
          notices.map((notice) => (
            <Link
              key={notice.id}
              href={`/chat/${notice.clientId}`}
              className={notice.emergency ? "list-row article-row rail-urgent" : "list-row article-row"}
              onClick={() => void onOpen(notice)}
            >
              <div className="spacer">
                <div className="name">{notice.title}</div>
                <div className="meta">{notice.body}</div>
              </div>
              <span className="meta">{aiCopy.openChat}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
