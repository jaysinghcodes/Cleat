"use client";

import { inboxAge, initials, reviewCopy, reviewCountLabel, type ReviewItem } from "@cleat/domain";
import Link from "next/link";
import { ConfidenceBar } from "../confidence";

export type ReviewEdit = { id: string; text: string; saveNote: boolean };

export function ReviewScreen({
  items,
  now,
  pendingId,
  error,
  banner,
  edit,
  onApprove,
  onReject,
  onStartEdit,
  onEditText,
  onSaveNote,
  onCancelEdit,
  onSendEdit,
}: {
  items: ReviewItem[];
  now: string;
  pendingId: string | null;
  error: string | null;
  banner: string | null;
  edit: ReviewEdit | null;
  onApprove: (item: ReviewItem) => void;
  onReject: (item: ReviewItem) => void;
  onStartEdit: (item: ReviewItem) => void;
  onEditText: (value: string) => void;
  onSaveNote: (value: boolean) => void;
  onCancelEdit: () => void;
  onSendEdit: (item: ReviewItem) => void;
}) {
  return (
    <div data-testid="review-page">
      <div className="page-head">
        <div>
          <h1>{reviewCopy.title}</h1>
          <p>{reviewCopy.lede}</p>
        </div>
        {items.length > 0 ? (
          <span className="pill" data-testid="review-count">
            {reviewCountLabel(items.length)}
          </span>
        ) : null}
      </div>
      {error ? <div className="banner banner-error">{error}</div> : null}
      {banner ? (
        <div className="banner banner-ok" role="status">
          {banner}
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className="card" data-testid="review-empty">
          <div className="name">{reviewCopy.empty}</div>
        </div>
      ) : (
        <div className="review-list">
          {items.map((item) => {
            const editing = edit?.id === item.id;
            const busy = pendingId !== null;
            return (
              <article key={item.id} className="card review-card" data-testid="review-card" aria-busy={pendingId === item.id}>
                <header className="review-head">
                  <span className="avatar">{initials(item.clientName)}</span>
                  <div className="spacer">
                    <div className="name">{item.clientName}</div>
                    <div className="meta">{inboxAge(item.createdAt, now)}</div>
                  </div>
                  <Link className="meta" href={`/chat/${item.clientId}`}>
                    {reviewCopy.openThread}
                  </Link>
                </header>
                <div className="review-body">
                  <div className="review-main">
                    <div>
                      <div className="meta">{reviewCopy.question}</div>
                      <p className="review-question">{item.preview}</p>
                    </div>
                    {editing ? (
                      <div className="field">
                        <label htmlFor={`review-edit-${item.id}`}>{reviewCopy.yourEdit}</label>
                        <textarea
                          id={`review-edit-${item.id}`}
                          value={edit.text}
                          maxLength={4000}
                          rows={5}
                          autoFocus
                          onChange={(event) => onEditText(event.target.value)}
                        />
                        <label className="review-note">
                          <input type="checkbox" checked={edit.saveNote} onChange={(event) => onSaveNote(event.target.checked)} />
                          <span>
                            <span className="name">{reviewCopy.saveNote}</span>
                            <span className="meta">{reviewCopy.saveNoteHelp}</span>
                          </span>
                        </label>
                      </div>
                    ) : (
                      <div>
                        <div className="meta">{reviewCopy.draft}</div>
                        <p className="review-draft">{item.draft.text}</p>
                      </div>
                    )}
                  </div>
                  <aside className="review-side">
                    {item.confidence !== null && item.threshold !== null ? (
                      <div>
                        <div className="meta">{reviewCopy.score}</div>
                        <ConfidenceBar value={item.confidence} threshold={item.threshold} decision="escalate" />
                        <div className="meta">
                          {reviewCopy.cutoff} {item.threshold.toFixed(2)}
                        </div>
                        <div className="meta">{reviewCopy.scoreHelp}</div>
                      </div>
                    ) : null}
                    {item.why.length > 0 ? (
                      <div>
                        <div className="meta">{reviewCopy.why}</div>
                        {item.why.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    ) : null}
                    <div>
                      <div className="meta">{reviewCopy.sources}</div>
                      {item.draft.sources.length === 0 ? <div>{reviewCopy.noSources}</div> : null}
                      {item.draft.sources.map((source) => (
                        <div key={`${source.title}-${source.articleId ?? "program"}`}>{source.title}</div>
                      ))}
                    </div>
                  </aside>
                </div>
                <footer className="row review-actions">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy || edit.text.trim().length === 0}
                        onClick={() => onSendEdit(item)}
                      >
                        {reviewCopy.sendEdit}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancelEdit}>
                        {reviewCopy.cancelEdit}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onApprove(item)}>
                        {reviewCopy.approve}
                      </button>
                      <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => onStartEdit(item)}>
                        {reviewCopy.edit}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onReject(item)}>
                        {reviewCopy.reject}
                      </button>
                    </>
                  )}
                  {item.auditId ? (
                    <Link className="meta review-audit" href={`/audit/${item.auditId}`}>
                      {reviewCopy.audit}
                    </Link>
                  ) : null}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
