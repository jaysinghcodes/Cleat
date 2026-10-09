"use client";

import {
  actOnHeldDraft,
  deliverChatMessage,
  loadTrainerInbox,
  markNoticeRead,
  resolveInboxItem,
  sendNudge,
} from "@cleat/api";
import {
  aiCopy,
  inboxCopy,
  nudgeBody,
  screenCopy,
  selectInboxItem,
  userFacingError,
  type InboxQueueItem,
  type InboxReason,
  type TrainerNotice,
} from "@cleat/domain";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ScreenState } from "../../screen-state";
import { useSession } from "../../session";
import { InboxScreen } from "./inbox-view";

export function InboxDesk({ defaultWindowHours }: { defaultWindowHours: number }) {
  const params = useSearchParams();
  const { client, membership } = useSession();
  const [items, setItems] = useState<InboxQueueItem[]>([]);
  const [notices, setNotices] = useState<TrainerNotice[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxReason | "all">("all");
  const [now, setNow] = useState(() => new Date().toISOString());
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    if (!client || !membership) return;
    const snapshot = await loadTrainerInbox(client, {
      orgId: membership.orgId,
      timeZone: membership.timezone,
      defaultWindowHours,
    });
    setItems(snapshot.items);
    setNotices(snapshot.notices);
    setNow(new Date().toISOString());
    setStatus("ready");
  }, [client, membership, defaultWindowHours]);

  useEffect(() => {
    let alive = true;
    void load().catch((err: unknown) => {
      if (!alive) return;
      setError(userFacingError(err, screenCopy.loadFailed));
      setStatus("error");
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const linked = selectInboxItem(items, {
    item: params.get("item"),
    client: params.get("client"),
    focus: params.get("focus"),
  });
  const selected = (picked ? items.find((item) => item.id === picked) : null) ?? linked;

  useEffect(() => {
    setDraftText(selected?.draft?.text ?? "");
    setReplyText("");
  }, [selected?.id, selected?.draft?.text]);

  useEffect(() => {
    if (!client || !selected) return;
    const unread = notices.filter((notice) => notice.inboxItemId === selected.id && !notice.readAt);
    if (unread.length === 0) return;
    for (const notice of unread) {
      void markNoticeRead(client, notice.id)
        .then(() => {
          setNotices((current) =>
            current.map((item) => (item.id === notice.id ? { ...item, readAt: new Date().toISOString() } : item)),
          );
        })
        .catch(() => undefined);
    }
  }, [client, selected, notices]);

  async function refreshAfter(message: string) {
    setBanner(message);
    setError(null);
    await load();
  }

  async function onSendEdited() {
    if (!client || !selected?.draft) return;
    setPending(true);
    try {
      await actOnHeldDraft(client, window.location.origin, {
        draftId: selected.draft.id,
        action: "send_edited",
        editedText: draftText,
      });
      setPicked(null);
      await refreshAfter(inboxCopy.draftSent);
    } catch (err) {
      setError(userFacingError(err, aiCopy.loadFailed));
    } finally {
      setPending(false);
    }
  }

  async function onSendAsIs() {
    if (!client || !selected?.draft) return;
    setPending(true);
    try {
      await actOnHeldDraft(client, window.location.origin, {
        draftId: selected.draft.id,
        action: "send_as_is",
      });
      setPicked(null);
      await refreshAfter(inboxCopy.draftSent);
    } catch (err) {
      setError(userFacingError(err, aiCopy.loadFailed));
    } finally {
      setPending(false);
    }
  }

  async function onDismissDraft() {
    if (!client || !selected?.draft) return;
    setPending(true);
    try {
      await actOnHeldDraft(client, window.location.origin, {
        draftId: selected.draft.id,
        action: "dismiss",
      });
      setPicked(null);
      await refreshAfter(inboxCopy.dismissed);
    } catch (err) {
      setError(userFacingError(err, aiCopy.loadFailed));
    } finally {
      setPending(false);
    }
  }

  async function onReply() {
    if (!client || !selected) return;
    const body = replyText.trim();
    if (!body) {
      setError(inboxCopy.emptyReply);
      return;
    }
    setPending(true);
    try {
      if (selected.derived) {
        await deliverChatMessage(client, { body, clientId: selected.clientId });
      } else {
        await resolveInboxItem(client, { itemId: selected.id, action: "reply", body });
      }
      setPicked(null);
      await refreshAfter(inboxCopy.replySent);
    } catch (err) {
      setError(userFacingError(err, aiCopy.loadFailed));
    } finally {
      setPending(false);
    }
  }

  async function onDismiss() {
    if (!client || !selected || selected.derived) return;
    setPending(true);
    try {
      await resolveInboxItem(client, { itemId: selected.id, action: "dismiss" });
      setPicked(null);
      await refreshAfter(inboxCopy.dismissed);
    } catch (err) {
      setError(userFacingError(err, aiCopy.loadFailed));
    } finally {
      setPending(false);
    }
  }

  async function onNudge(item: InboxQueueItem) {
    if (!client || !membership) return;
    const kind = item.nudgeKind === "soft" ? "soft" : "nudge";
    setPending(true);
    setPicked(item.id);
    try {
      await sendNudge(client, item.clientId, kind, nudgeBody(kind, membership.displayName));
      await refreshAfter(`${inboxCopy.nudgeSent}`);
    } catch (err) {
      setError(userFacingError(err, aiCopy.loadFailed));
    } finally {
      setPending(false);
    }
  }

  if (status === "loading") {
    return (
      <div data-testid="inbox-page">
        <div className="page-head">
          <div>
            <h1>{inboxCopy.title}</h1>
            <p>{inboxCopy.lede}</p>
          </div>
        </div>
        <ScreenState kind="loading" title={screenCopy.loadingInbox} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div data-testid="inbox-page">
        <div className="page-head">
          <div>
            <h1>{inboxCopy.title}</h1>
            <p>{inboxCopy.lede}</p>
          </div>
        </div>
        <ScreenState
          kind="error"
          title={screenCopy.couldNotLoad}
          body={error ?? screenCopy.loadFailed}
          onRetry={() => {
            setStatus("loading");
            setError(null);
            void load().catch((err: unknown) => {
              setError(userFacingError(err, screenCopy.loadFailed));
              setStatus("error");
            });
          }}
        />
      </div>
    );
  }

  return (
    <InboxScreen
      items={items}
      notices={notices}
      selectedId={selected?.id ?? null}
      filter={filter}
      now={now}
      pending={pending}
      error={error}
      banner={banner}
      draftText={draftText}
      replyText={replyText}
      onFilter={setFilter}
      onSelect={setPicked}
      onDraftText={setDraftText}
      onReplyText={setReplyText}
      onSendEdited={() => void onSendEdited()}
      onSendAsIs={() => void onSendAsIs()}
      onDismissDraft={() => void onDismissDraft()}
      onReply={() => void onReply()}
      onDismiss={() => void onDismiss()}
      onNudge={(item) => void onNudge(item)}
    />
  );
}
