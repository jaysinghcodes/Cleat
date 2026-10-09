import { screenPreviewFromSearch, type Membership, type ScreenPreview } from "@cleat/domain";
import { useEffect, useState } from "react";

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

export function useScreenPreview(): ScreenPreview | null {
  const [value, setValue] = useState<ScreenPreview | null>(null);
  useEffect(() => {
    setValue(readScreenPreview());
  }, []);
  return value;
}

export const previewClientMembership: Membership = {
  orgId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  orgName: "North Gym",
  role: "client",
  displayName: "Sam Lee",
  timezone: "America/Chicago",
};

export const previewCoach = {
  displayName: "Alex Rivera",
  orgName: "North Gym",
};

export const previewUser = {
  userId: "22222222-2222-4222-8222-222222222222",
  email: "sam@northgym.example",
};
