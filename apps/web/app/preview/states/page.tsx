"use client";

import { notFound } from "next/navigation";
import { DeskShell } from "../../(desk)/nav";
import { StateGallery } from "../../state-gallery";
import { previewMembership } from "../fixtures";

export default function PreviewStatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <DeskShell membership={previewMembership} activeHref="/accountability">
      <StateGallery />
    </DeskShell>
  );
}
