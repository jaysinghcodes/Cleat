"use client";

import { reviewBanner, reviewQueue, type InboxQueueItem, type ReviewItem } from "@cleat/domain";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DeskShell } from "../../(desk)/nav";
import { ReviewScreen, type ReviewEdit } from "../../(desk)/review/review-view";
import { PREVIEW_NOW, previewItems, previewMembership } from "../fixtures";

const held = previewItems.find((item) => item.priority === "p1" && item.draft);

const extra: InboxQueueItem[] = held
  ? [
      {
        ...held,
        id: "f2000000-0000-4000-8000-000000000001",
        clientName: "Jordan Lee",
        preview: "do you have showers",
        createdAt: "2026-10-09T15:20:00.000Z",
        confidence: 0.31,
        why: ["Not enough in your notes", "Confidence below your threshold"],
        auditId: null,
        draft: { id: "f2000000-0000-4000-8000-000000000002", text: "I do not have that in your coach's notes yet.", sources: [] },
      },
    ]
  : [];

function PreviewReview() {
  const params = useSearchParams();
  const [items, setItems] = useState<ReviewItem[]>(() => (params.get("empty") === "1" ? [] : reviewQueue([...previewItems, ...extra])));
  const [edit, setEdit] = useState<ReviewEdit | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const done = (item: ReviewItem, action: "approve" | "edit" | "reject") => {
    setItems((current) => current.filter((row) => row.id !== item.id));
    setBanner(reviewBanner({ action, noteAsked: edit?.saveNote === true, noteSaved: edit?.saveNote === true }));
    setEdit(null);
  };
  return (
    <DeskShell membership={previewMembership} activeHref="/review">
      <ReviewScreen
        items={items}
        now={PREVIEW_NOW}
        pendingId={null}
        error={null}
        banner={banner}
        edit={edit}
        onApprove={(item) => done(item, "approve")}
        onReject={(item) => done(item, "reject")}
        onStartEdit={(item) => setEdit({ id: item.id, text: item.draft.text, saveNote: true })}
        onEditText={(value) => setEdit((current) => (current ? { ...current, text: value } : current))}
        onSaveNote={(value) => setEdit((current) => (current ? { ...current, saveNote: value } : current))}
        onCancelEdit={() => setEdit(null)}
        onSendEdit={(item) => done(item, "edit")}
      />
    </DeskShell>
  );
}

export default function PreviewReviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={<p className="meta">Loading held answers</p>}>
      <PreviewReview />
    </Suspense>
  );
}
