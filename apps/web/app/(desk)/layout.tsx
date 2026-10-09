"use client";

import { copy, deskSessionView } from "@cleat/domain";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { SessionLoadFallback } from "../session-fallback";
import { useSession } from "../session";
import { FullPageStatus, Unconfigured } from "../ui";
import { DeskShell } from "./nav";

export default function DeskLayout({ children }: { children: ReactNode }) {
  const { ready, configured, session, membership, loadError, refresh } = useSession();
  const router = useRouter();
  const view = deskSessionView({
    ready,
    configured,
    hasSession: session !== null,
    role: membership?.role ?? null,
    loadError,
  });

  useEffect(() => {
    if (view === "login") router.replace("/login");
    if (view === "signup") router.replace("/signup");
    if (view === "coach") router.replace("/login?notice=coach");
  }, [view, router]);

  if (view === "checking" || view === "login" || view === "signup" || view === "coach") {
    return <FullPageStatus body={copy.checkingSession} />;
  }
  if (view === "unconfigured") return <Unconfigured />;
  if (view === "error") {
    return <SessionLoadFallback body={loadError ?? copy.generic} onRetry={() => void refresh()} />;
  }
  if (!membership) return <FullPageStatus body={copy.checkingSession} />;
  return <DeskShell membership={membership}>{children}</DeskShell>;
}
