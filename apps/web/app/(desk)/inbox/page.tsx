"use client";

import { Suspense } from "react";
import { InboxDesk } from "./inbox-desk";

export default function InboxPage() {
  return (
    <Suspense fallback={<p className="meta">Loading the inbox</p>}>
      <InboxDesk />
    </Suspense>
  );
}
