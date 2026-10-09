"use client";

import { screenPreviewFromSearch, type ScreenPreview } from "@cleat/domain";

/** A database sentence the screen must hide. Dev preview only. */
export const PREVIEW_FAILURE = "permission denied for table inbox_items";

type PreviewWindow = Window & { __CLEAT_SCREEN_PREVIEW__?: string };

export function readScreenPreview(): ScreenPreview | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  const search = typeof window.location?.search === "string" ? window.location.search : "";
  const fromQuery = screenPreviewFromSearch(search);
  if (fromQuery) return fromQuery;
  const flag = (window as PreviewWindow).__CLEAT_SCREEN_PREVIEW__;
  if (flag === "loading" || flag === "empty" || flag === "error" || flag === "offline") return flag;
  return null;
}

/** Skip the network load. Loading leaves the screen's initial status in place. */
export function haltForPreview(handlers: { error: () => void; ready: () => void }): boolean {
  const preview = readScreenPreview();
  if (!preview) return false;
  if (preview === "loading") return true;
  if (preview === "error") {
    handlers.error();
    return true;
  }
  handlers.ready();
  return true;
}
