"use client";

import { inboxCopy, initials } from "@cleat/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeskShell } from "../../(desk)/nav";
import { previewClients, previewMembership } from "../fixtures";

export default function PreviewBoardPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const jordan = previewClients.jordan;
  return (
    <DeskShell membership={previewMembership} activeHref="/accountability">
      <div data-testid="accountability-page">
        <div className="page-head">
          <div>
            <h1>Accountability</h1>
            <p>Who finished today · who skipped · who needs a nudge</p>
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="list-row rail-urgent" data-testid={`board-row-${jordan}`}>
            <div className="avatar nudge">{initials("Jordan Kim")}</div>
            <div className="spacer">
              <div className="name">Jordan Kim</div>
              <div className="meta">Lower A · no log yet</div>
            </div>
            <div className="board-today">
              <span className="pill pill-missed">Missed</span>
            </div>
            <div className="board-adherence">
              <div>1 of 3</div>
              <div className="meta">Yesterday</div>
            </div>
            <div className="board-action inbox-board-action">
              <span className="btn btn-danger btn-sm">Send nudge</span>
              <Link
                className="meta"
                data-testid={`open-inbox-${jordan}`}
                href={`/preview/inbox?client=${jordan}&focus=missed`}
              >
                {inboxCopy.openInbox}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DeskShell>
  );
}
