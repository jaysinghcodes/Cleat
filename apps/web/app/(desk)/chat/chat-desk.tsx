"use client";

import {
  CleatRequestError,
  ensureThread,
  fetchOpenDraft,
  listAuditEvents,
  listClients,
  listMessages,
  listThreadPreviews,
  sendChatMessage,
  subscribeToThread,
} from "@cleat/api";
import {
  aiCopy,
  auditTimeline,
  chatCopy,
  clientAiPresentation,
  decisionLabel,
  initials,
  isUuid,
  mergeMessages,
  messagePreview,
  replyPlaceholder,
  splitMessageBody,
  upsertMessage,
  type AuditEvent,
  type HeldDraftMarker,
  type Message,
  type ThreadPreview,
} from "@cleat/domain";
import type { ClientRosterItem } from "@cleat/domain";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "../../session";
import { Banner } from "../../ui";
import { ConfidenceBar } from "../confidence";

function MessageBody({ body }: { body: string }) {
  const parts = splitMessageBody(body);
  return (
    <>
      {parts.map((part, index) =>
        part.kind === "link" ? (
          <a key={index} href={part.text} target="_blank" rel="noreferrer noopener">
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function notePreview(current: ThreadPreview[], clientId: string, threadId: string, message: Message): ThreadPreview[] {
  const rest = current.filter((item) => item.clientId !== clientId);
  return [
    { threadId, clientId, lastBody: message.body, lastAt: message.createdAt },
    ...rest,
  ];
}

export function ChatDesk({ clientId }: { clientId?: string }) {
  const { client, session, membership } = useSession();
  const [roster, setRoster] = useState<ClientRosterItem[]>([]);
  const [rosterReady, setRosterReady] = useState(false);
  const [previews, setPreviews] = useState<ThreadPreview[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [held, setHeld] = useState<HeldDraftMarker | null>(null);
  const [latestAudit, setLatestAudit] = useState<AuditEvent | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const rosterKey = roster.map((person) => person.userId).join(",");

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    void Promise.all([listClients(client), listThreadPreviews(client)])
      .then(([people, rows]) => {
        if (cancelled) return;
        setRoster(people);
        setPreviews(rows);
        setRosterReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRosterReady(true);
        setError(err instanceof CleatRequestError ? err.message : chatCopy.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!client || !clientId) {
      setThreadId(null);
      setMessages([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    if (!isUuid(clientId)) {
      setError(chatCopy.notOnRoster);
      setThreadId(null);
      setMessages([]);
      return;
    }
    if (!rosterReady) return;
    if (!rosterRef.current.some((person) => person.userId === clientId)) {
      setError(chatCopy.notOnRoster);
      setThreadId(null);
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe = () => {};
    setLoading(true);
    stick.current = true;
    void (async () => {
      try {
        const id = await ensureThread(client, clientId);
        if (cancelled) return;
        setThreadId(id);
        const page = await listMessages(client, id);
        if (cancelled) return;
        setMessages(page.messages);
        setHasMore(page.hasMore);
        setError(null);
        unsubscribe = subscribeToThread(client, id, (incoming) => {
          setMessages((current) => upsertMessage(current, incoming));
          setPreviews((current) => notePreview(current, clientId, id, incoming));
        });
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof CleatRequestError ? err.message : chatCopy.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client, clientId, rosterReady, rosterKey]);

  useEffect(() => {
    if (!client || !clientId || !isUuid(clientId)) {
      setHeld(null);
      setLatestAudit(null);
      return;
    }
    let cancelled = false;
    void Promise.all([fetchOpenDraft(client, clientId), listAuditEvents(client, { clientId })])
      .then(([draft, events]) => {
        if (cancelled) return;
        setHeld(draft);
        setLatestAudit(events[0] ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setHeld(null);
        setLatestAudit(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client, clientId, messages]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const selected = roster.find((person) => person.userId === clientId);
  const ordered = [...roster].sort((a, b) => {
    const aAt = previews.find((item) => item.clientId === a.userId)?.lastAt ?? "";
    const bAt = previews.find((item) => item.clientId === b.userId)?.lastAt ?? "";
    if (aAt !== bAt) return bAt.localeCompare(aAt);
    return a.displayName.localeCompare(b.displayName);
  });

  async function onEarlier() {
    if (!client || !threadId || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;
    stick.current = false;
    setLoadingEarlier(true);
    setError(null);
    try {
      const page = await listMessages(client, threadId, { before: oldest.createdAt });
      setHasMore(page.hasMore);
      setMessages((current) => mergeMessages(page.messages, current));
    } catch (err: unknown) {
      setError(err instanceof CleatRequestError ? err.message : chatCopy.loadFailed);
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function onSend() {
    if (!client || !clientId || !session) return;
    stick.current = true;
    setSending(true);
    setError(null);
    try {
      const message = await sendChatMessage(client, window.location.origin, {
        body: draft,
        clientId,
      });
      setDraft("");
      setMessages((current) => upsertMessage(current, message));
      setPreviews((current) => notePreview(current, clientId, message.threadId, message));
      setThreadId(message.threadId);
    } catch (err: unknown) {
      setError(err instanceof CleatRequestError ? err.message : chatCopy.sendFailed);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-page">
      <div className="page-head">
        <div>
          <h1>{chatCopy.title}</h1>
          <p>{chatCopy.trainerLede}</p>
        </div>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <div className={selected ? "chat-wrap has-context" : "chat-wrap"}>
        <div className="chat-list">
          <div className="panel-head">{chatCopy.threads}</div>
          <div className="thread-scroll">
            {rosterReady && ordered.length === 0 ? (
              <div className="list-row">
                <div>
                  <div className="meta">{chatCopy.emptyRoster}</div>
                  <div className="meta" style={{ marginTop: 8 }}>
                    <Link href="/clients">{chatCopy.goToClients}</Link>
                  </div>
                </div>
              </div>
            ) : (
              ordered.map((person) => {
                const preview = previews.find((item) => item.clientId === person.userId);
                const active = person.userId === clientId;
                return (
                  <Link
                    key={person.userId}
                    href={`/chat/${person.userId}`}
                    className={active ? "list-row active" : "list-row"}
                  >
                    <div className="avatar">{initials(person.displayName)}</div>
                    <div className="spacer">
                      <div className="name">{person.displayName}</div>
                      <div className="meta">
                        {preview?.lastBody ? messagePreview(preview.lastBody) : chatCopy.emptyThread}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
        <div className="chat-thread">
          {selected ? (
            <div className="thread-head">
              <div className="avatar">{initials(selected.displayName)}</div>
              <div>
                <div className="name">{selected.displayName}</div>
                <div className="meta">{chatCopy.clientMeta}</div>
              </div>
            </div>
          ) : null}
          {selected && held ? (
            <div className="draft-held">
              <div className="name">{chatCopy.draftHeld}</div>
              <p className="meta">{chatCopy.draftHeldBody}</p>
              <div className="meta" style={{ marginTop: 8 }}>
                <Link href="/inbox">{chatCopy.openInbox}</Link>
              </div>
            </div>
          ) : null}
          <div
            className="thread-body"
            ref={scroller}
            onScroll={(event) => {
              const el = event.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {!clientId ? <div className="chat-empty">{chatCopy.chooseClient}</div> : null}
            {clientId && loading ? <div className="chat-empty">{chatCopy.loading}</div> : null}
            {clientId && !loading && selected && hasMore ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm chat-earlier"
                onClick={() => void onEarlier()}
                disabled={loadingEarlier}
              >
                {chatCopy.loadEarlier}
              </button>
            ) : null}
            {clientId && !loading && selected && messages.length === 0 ? (
              <div className="chat-empty">{chatCopy.emptyThread}</div>
            ) : null}
            {selected
              ? messages.map((message) => {
                  const view = clientAiPresentation(message, membership?.displayName ?? "");
                  if (view) {
                    return (
                      <div key={message.id} className="bubble ai">
                        <div className="bubble-label">
                          <span className="ai-dot" />
                          {view.label}
                        </div>
                        <MessageBody body={message.body} />
                        {view.sources ? <div className="bubble-meta">{view.sources}</div> : null}
                        {view.footer ? <div className="bubble-meta">{view.footer}</div> : null}
                      </div>
                    );
                  }
                  const mine = message.senderId === session?.userId;
                  return (
                    <div key={message.id} className={mine ? "bubble me" : "bubble them"}>
                      <MessageBody body={message.body} />
                    </div>
                  );
                })
              : null}
          </div>
          {selected && membership ? (
            <form
              className="thread-compose"
              onSubmit={(event) => {
                event.preventDefault();
                void onSend();
              }}
            >
              <input
                type="text"
                value={draft}
                maxLength={4000}
                placeholder={replyPlaceholder(membership.displayName)}
                aria-label={chatCopy.writeMessage}
                onChange={(event) => setDraft(event.target.value)}
                disabled={sending || loading}
              />
              <button className="btn btn-primary" type="submit" disabled={sending || loading || draft.trim().length === 0}>
                {chatCopy.send}
              </button>
            </form>
          ) : null}
        </div>
        {selected ? (
          <aside className="chat-context">
            <div className="name">{aiCopy.confidence}</div>
            {latestAudit ? (
              <div className="stack" style={{ marginTop: 12 }}>
                <ConfidenceBar value={latestAudit.confidence} threshold={latestAudit.threshold} />
                <div>
                  <div className="meta">{aiCopy.decision}</div>
                  <div className="name">{decisionLabel(latestAudit.decision)}</div>
                </div>
                <div>
                  <div className="meta">{aiCopy.thresholdLabel}</div>
                  <div className="name">{latestAudit.threshold.toFixed(2)}</div>
                </div>
                {latestAudit.templateId ? (
                  <div>
                    <div className="meta">{aiCopy.template}</div>
                    <div className="name">{latestAudit.templateId}</div>
                  </div>
                ) : null}
                {latestAudit.decision === "hard_refuse" ? <div className="name">{chatCopy.safetySent}</div> : null}
                <div className="meta">
                  <Link href={`/audit/${latestAudit.id}`}>{aiCopy.auditTitle}</Link>
                </div>
                <div className="meta">
                  <Link href="/inbox">{chatCopy.openInbox}</Link>
                </div>
                {latestAudit.chunks.length > 0 ? (
                  <div>
                    <div className="meta">{aiCopy.sources}</div>
                    {latestAudit.chunks.map((chunk) => (
                      <p key={chunk.id} className="meta">
                        {chunk.snippet}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div>
                  <div className="meta">{aiCopy.timeline}</div>
                  {auditTimeline(latestAudit).map((item) => (
                    <p key={`${item.at}-${item.label}`} className="meta">
                      {item.label}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="meta" style={{ marginTop: 8 }}>
                {aiCopy.noneYet}
              </p>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
