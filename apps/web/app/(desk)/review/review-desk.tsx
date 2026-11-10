"use client";

import { actOnHeldDraft, loadTrainerInbox } from "@cleat/api";
import {
  aiCopy,
  reviewBanner,
  reviewCopy,
  reviewEditChanged,
  reviewQueue,
  screenCopy,
  userFacingError,
  type ReviewItem,
} from "@cleat/domain";
import { useCallback, useEffect, useState } from "react";
import { haltForPreview, PREVIEW_FAILURE } from "../../preview-mode";
import { ScreenState } from "../../screen-state";
import { useSession } from "../../session";
import { ReviewScreen, type ReviewEdit } from "./review-view";

function Head() {
  return (
    <div className="page-head">
      <div>
        <h1>{reviewCopy.title}</h1>
        <p>{reviewCopy.lede}</p>
      </div>
    </div>
  );
}

export function ReviewDesk({ defaultWindowHours }: { defaultWindowHours: number }) {
  const { client, membership } = useSession();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [now, setNow] = useState(() => new Date().toISOString());
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<ReviewEdit | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    if (!client || !membership) return;
    const snapshot = await loadTrainerInbox(client, {
      orgId: membership.orgId,
      timeZone: membership.timezone,
      defaultWindowHours,
    });
    setItems(reviewQueue(snapshot.items));
    setNow(new Date().toISOString());
    setStatus("ready");
  }, [client, membership, defaultWindowHours]);

  const start = useCallback(() => {
    void load().catch((err: unknown) => {
      setError(userFacingError(err, screenCopy.loadFailed));
      setStatus("error");
    });
  }, [load]);

  useEffect(() => {
    if (
      haltForPreview({
        error: () => {
          setError(PREVIEW_FAILURE);
          setStatus("error");
        },
        ready: () => {
          setItems([]);
          setError(null);
          setStatus("ready");
        },
      })
    ) {
      return;
    }
    start();
  }, [start]);

  async function act(item: ReviewItem, action: "approve" | "edit" | "reject") {
    if (!client) return;
    const text = edit?.id === item.id ? edit.text.trim() : "";
    if (action === "edit" && !text) {
      setError(reviewCopy.emptyEdit);
      return;
    }
    const changed = action === "edit" && reviewEditChanged(item.draft.text, text);
    const noteAsked = changed && edit?.saveNote === true;
    setPendingId(item.id);
    setError(null);
    try {
      const result = await actOnHeldDraft(client, window.location.origin, {
        draftId: item.draft.id,
        action: action === "approve" || (action === "edit" && !changed) ? "send_as_is" : action === "edit" ? "send_edited" : "dismiss",
        editedText: changed ? text : undefined,
        saveAsNote: noteAsked,
      });
      setEdit(null);
      setBanner(reviewBanner({ action: changed ? "edit" : action === "edit" ? "approve" : action, noteAsked, noteSaved: result.noteSaved }));
      await load();
    } catch (err) {
      setError(userFacingError(err, aiCopy.loadFailed));
    } finally {
      setPendingId(null);
    }
  }

  if (status === "loading") {
    return (
      <div data-testid="review-page">
        <Head />
        <ScreenState kind="loading" title={screenCopy.loadingInbox} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div data-testid="review-page">
        <Head />
        <ScreenState
          kind="error"
          title={screenCopy.couldNotLoad}
          body={error ?? screenCopy.loadFailed}
          onRetry={() => {
            setStatus("loading");
            setError(null);
            start();
          }}
        />
      </div>
    );
  }

  return (
    <ReviewScreen
      items={items}
      now={now}
      pendingId={pendingId}
      error={error}
      banner={banner}
      edit={edit}
      onApprove={(item) => void act(item, "approve")}
      onReject={(item) => void act(item, "reject")}
      onStartEdit={(item) => {
        setBanner(null);
        setError(null);
        setEdit({ id: item.id, text: item.draft.text, saveNote: true });
      }}
      onEditText={(value) => setEdit((current) => (current ? { ...current, text: value } : current))}
      onSaveNote={(value) => setEdit((current) => (current ? { ...current, saveNote: value } : current))}
      onCancelEdit={() => setEdit(null)}
      onSendEdit={(item) => void act(item, "edit")}
    />
  );
}
