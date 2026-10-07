"use client";

import { copy } from "@cleat/domain";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "../session";
import { FullPageStatus, Unconfigured } from "../ui";
import { DeskShell } from "./nav";

export default function DeskLayout({ children }: { children: ReactNode }) {
  const { ready, configured, session, membership } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !configured) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!membership) {
      router.replace("/signup");
      return;
    }
    if (membership.role !== "trainer") {
      router.replace("/login?notice=coach");
    }
  }, [ready, configured, session, membership, router]);

  if (!ready) return <FullPageStatus body={copy.checkingSession} />;
  if (!configured) return <Unconfigured />;
  if (!session || membership?.role !== "trainer") {
    return <FullPageStatus body={copy.checkingSession} />;
  }
  return <DeskShell membership={membership}>{children}</DeskShell>;
}
