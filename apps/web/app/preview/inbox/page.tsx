"use client";

import { selectInboxItem, type InboxReason } from "@cleat/domain";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DeskShell } from "../../(desk)/nav";
import { InboxScreen } from "../../(desk)/inbox/inbox-view";
import { PREVIEW_NOW, previewItems, previewMembership } from "../fixtures";

function PreviewInbox() {
  const params = useSearchParams();
  const empty = params.get("empty") === "1";
  const items = empty ? [] : previewItems;
  const linked = selectInboxItem(items, {
    item: params.get("item"),
    client: params.get("client"),
    focus: params.get("focus"),
  });
  const [picked, setPicked] = useState<string | null>(linked?.id ?? null);
  const [filter, setFilter] = useState<InboxReason | "all">("all");
  const selected = items.find((item) => item.id === picked) ?? null;
  return (
    <DeskShell membership={previewMembership} activeHref="/inbox">
      <InboxScreen
        items={items}
        notices={[]}
        selectedId={selected?.id ?? null}
        filter={filter}
        now={PREVIEW_NOW}
        pending={false}
        error={null}
        banner={null}
        draftText={selected?.draft?.text ?? ""}
        replyText=""
        onFilter={setFilter}
        onSelect={setPicked}
        onDraftText={() => undefined}
        onReplyText={() => undefined}
        onSendEdited={() => undefined}
        onSendAsIs={() => undefined}
        onDismissDraft={() => undefined}
        onReply={() => undefined}
        onDismiss={() => undefined}
        onNudge={() => undefined}
      />
    </DeskShell>
  );
}

export default function PreviewInboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={<p className="meta">Loading the inbox</p>}>
      <PreviewInbox />
    </Suspense>
  );
}
