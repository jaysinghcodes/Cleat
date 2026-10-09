"use client";

import { TEMPLATE_TEXT, type TemplateId } from "@cleat/ai";
import {
  aiCopy,
  filterInbox,
  inboxAge,
  inboxCopy,
  inboxReasonCounts,
  inboxReasonLabel,
  initials,
  templateLabel,
  type InboxQueueItem,
  type InboxReason,
  type TrainerNotice,
} from "@cleat/domain";
import Link from "next/link";
import { ConfidenceBar } from "../confidence";
import { inboxRowChrome } from "./inbox-chrome";

const FILTERS: (InboxReason | "all")[] = ["all", ...(["emergency", "injury", "ai_escalate", "unanswered", "missed"] as const)];

function AlertIcon() {
  return (
    <svg
      className="inbox-alert"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      data-testid="inbox-alert-icon"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M8.87 1.8a1 1 0 0 0-1.74 0L1.2 13.1A1 1 0 0 0 2.06 14.6h11.88a1 1 0 0 0 .87-1.5L8.87 1.8zM8 6.1c.36 0 .65.29.65.65v3.1a.65.65 0 0 1-1.3 0v-3.1c0-.36.29-.65.65-.65zm0 6.55a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z"
      />
    </svg>
  );
}

function rowClass(item: InboxQueueItem, selected: boolean): string {
  const chrome = inboxRowChrome(item.reason);
  return [chrome.rowClass, selected ? "is-current" : ""].filter(Boolean).join(" ");
}

function templateBody(templateId: InboxQueueItem["templateId"]): string | null {
  if (!templateId) return null;
  return TEMPLATE_TEXT[templateId as TemplateId];
}

export function InboxScreen({
  items,
  notices,
  selectedId,
  filter,
  now,
  pending,
  error,
  banner,
  draftText,
  replyText,
  onFilter,
  onSelect,
  onDraftText,
  onReplyText,
  onSendEdited,
  onSendAsIs,
  onDismissDraft,
  onReply,
  onDismiss,
  onNudge,
}: {
  items: InboxQueueItem[];
  notices: TrainerNotice[];
  selectedId: string | null;
  filter: InboxReason | "all";
  now: string;
  pending: boolean;
  error: string | null;
  banner: string | null;
  draftText: string;
  replyText: string;
  onFilter: (filter: InboxReason | "all") => void;
  onSelect: (id: string) => void;
  onDraftText: (value: string) => void;
  onReplyText: (value: string) => void;
  onSendEdited: () => void;
  onSendAsIs: () => void;
  onDismissDraft: () => void;
  onReply: () => void;
  onDismiss: () => void;
  onNudge: (item: InboxQueueItem) => void;
}) {
  const counts = inboxReasonCounts(items);
  const visible = filterInbox(items, filter);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const stray = notices.filter(
    (notice) => !notice.readAt && (!notice.inboxItemId || !items.some((item) => item.id === notice.inboxItemId)),
  );

  return (
    <div data-testid="inbox-page">
      <div className="page-head">
        <div>
          <h1>{inboxCopy.title}</h1>
          <p>{inboxCopy.lede}</p>
        </div>
      </div>
      {error ? <div className="banner banner-error">{error}</div> : null}
      {banner ? <div className="banner banner-ok">{banner}</div> : null}
      <div className="inbox-filters" role="tablist" aria-label={inboxCopy.title}>
        {FILTERS.map((reason) => {
          const count = reason === "all" ? items.length : counts[reason];
          const label = reason === "all" ? inboxCopy.all : inboxReasonLabel(reason);
          return (
            <button
              key={reason}
              type="button"
              role="tab"
              aria-selected={filter === reason}
              className={filter === reason ? "pill is-current" : "pill"}
              data-testid={`inbox-filter-${reason}`}
              onClick={() => onFilter(reason)}
            >
              {label}
              <span className="meta">{count}</span>
            </button>
          );
        })}
      </div>
      {items.length === 0 ? (
        <div className="card" data-testid="inbox-empty">
          <div className="name">{inboxCopy.empty}</div>
        </div>
      ) : (
        <div className={selected ? "inbox-layout" : ""}>
          <div className="card" style={{ padding: 0 }}>
            {visible.length === 0 ? (
              <div className="list-row">
                <div className="meta">{inboxCopy.filterEmpty}</div>
              </div>
            ) : (
              visible.map((item) => {
                const chrome = inboxRowChrome(item.reason);
                return (
                  <div
                    key={item.id}
                    className={rowClass(item, item.id === selected?.id)}
                    data-testid={`inbox-row-${item.reason}`}
                    data-urgency={chrome.urgency}
                  >
                    <button type="button" className="inbox-open" onClick={() => onSelect(item.id)}>
                      <span className={item.reason === "emergency" || item.reason === "injury" || item.reason === "missed" ? "avatar nudge" : "avatar"}>
                        {initials(item.clientName)}
                      </span>
                      <span className="spacer">
                        <span className="name">{item.clientName}</span>
                        <span className="meta inbox-preview">{item.preview}</span>
                      </span>
                    </button>
                    <span className={chrome.chipClass}>
                      {chrome.alert ? <AlertIcon /> : null}
                      {inboxReasonLabel(item.reason)}
                    </span>
                    <span className="meta inbox-age">{inboxAge(item.createdAt, now)}</span>
                    {item.priority === "p3" ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={pending}
                        onClick={() => onNudge(item)}
                      >
                        {inboxCopy.nudge}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => onSelect(item.id)}>
                        {item.priority === "p1" ? inboxCopy.editDraft : inboxCopy.review}
                        {item.priority === "p1" && item.confidence !== null ? (
                          <span className="meta">{item.confidence.toFixed(2)}</span>
                        ) : null}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {selected ? (
            <InboxPanel
              item={selected}
              pending={pending}
              draftText={draftText}
              replyText={replyText}
              onDraftText={onDraftText}
              onReplyText={onReplyText}
              onSendEdited={onSendEdited}
              onSendAsIs={onSendAsIs}
              onDismissDraft={onDismissDraft}
              onReply={onReply}
              onDismiss={onDismiss}
              onNudge={() => onNudge(selected)}
            />
          ) : null}
        </div>
      )}
      {stray.length > 0 ? (
        <div className="card" style={{ marginTop: 16, padding: 0 }} data-testid="inbox-notices">
          <div className="list-row">
            <div className="name">{inboxCopy.notices}</div>
          </div>
          {stray.map((notice) => (
            <Link
              key={notice.id}
              href={`/chat/${notice.clientId}`}
              className={notice.emergency ? "list-row rail-urgent row-urgent" : "list-row"}
            >
              <div className="spacer">
                <div className="name">{notice.title}</div>
                <div className="meta">{notice.body}</div>
              </div>
              <span className="meta">{aiCopy.openChat}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InboxPanel({
  item,
  pending,
  draftText,
  replyText,
  onDraftText,
  onReplyText,
  onSendEdited,
  onSendAsIs,
  onDismissDraft,
  onReply,
  onDismiss,
  onNudge,
}: {
  item: InboxQueueItem;
  pending: boolean;
  draftText: string;
  replyText: string;
  onDraftText: (value: string) => void;
  onReplyText: (value: string) => void;
  onSendEdited: () => void;
  onSendAsIs: () => void;
  onDismissDraft: () => void;
  onReply: () => void;
  onDismiss: () => void;
  onNudge: () => void;
}) {
  const sent = templateBody(item.templateId);
  const label = templateLabel(item.templateId);
  return (
    <aside className="card inbox-panel" data-testid={`inbox-panel-${item.reason}`}>
      <div className="name">{item.clientName}</div>
      <p className="meta">{inboxReasonLabel(item.reason)}</p>
      <div className="stack" style={{ marginTop: 12 }}>
        <div>
          <div className="meta">{inboxCopy.clientMessage}</div>
          <p>{item.preview}</p>
        </div>
        {sent && label ? (
          <div data-testid="inbox-template">
            <div className="meta">{inboxCopy.templateSent}</div>
            <div className="name">{label}</div>
            <p className="inbox-template">{sent}</p>
            <p className="meta">{inboxCopy.noDraft}</p>
          </div>
        ) : null}
        {item.priority === "p1" && item.draft ? (
          <>
            {item.why.length > 0 ? (
              <div>
                <div className="meta">{inboxCopy.why}</div>
                {item.why.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}
            {item.confidence !== null && item.threshold !== null ? (
              <div>
                <div className="meta">{inboxCopy.confidence}</div>
                <ConfidenceBar value={item.confidence} threshold={item.threshold} decision="escalate" />
                <div className="meta">
                  {inboxCopy.threshold} {item.threshold.toFixed(2)}
                </div>
              </div>
            ) : null}
            <div>
              <div className="meta">{inboxCopy.sources}</div>
              {item.draft.sources.length === 0 ? <p className="meta">{aiCopy.noneYet}</p> : null}
              {item.draft.sources.map((source) => (
                <p key={`${source.title}-${source.articleId ?? "program"}`} className="meta">
                  {source.title}
                </p>
              ))}
            </div>
            <div className="field">
              <label htmlFor="held-draft">{inboxCopy.draft}</label>
              <textarea
                id="held-draft"
                value={draftText}
                maxLength={4000}
                onChange={(event) => onDraftText(event.target.value)}
              />
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={onSendEdited}>
                {aiCopy.actionSendEdited}
              </button>
              <button type="button" className="btn btn-soft btn-sm" disabled={pending} onClick={onSendAsIs}>
                {aiCopy.actionSendAsIs}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={onDismissDraft}>
                {aiCopy.actionDismiss}
              </button>
            </div>
          </>
        ) : null}
        {item.priority === "p0" || item.priority === "p2" ? (
          <>
            <div className="field">
              <label htmlFor="inbox-reply">{inboxCopy.replyLabel}</label>
              <textarea
                id="inbox-reply"
                value={replyText}
                maxLength={4000}
                placeholder={inboxCopy.reply}
                onChange={(event) => onReplyText(event.target.value)}
              />
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary btn-sm" disabled={pending || replyText.trim().length === 0} onClick={onReply}>
                {inboxCopy.sendReply}
              </button>
              {item.derived ? null : (
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={onDismiss}>
                  {inboxCopy.dismiss}
                </button>
              )}
            </div>
          </>
        ) : null}
        {item.priority === "p3" ? (
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={onNudge}>
            {inboxCopy.nudge}
          </button>
        ) : null}
        {item.auditId ? (
          <div className="meta">
            <Link href={`/audit/${item.auditId}`}>{inboxCopy.audit}</Link>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
