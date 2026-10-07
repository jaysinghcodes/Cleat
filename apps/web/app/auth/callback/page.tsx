"use client";

import { copy } from "@cleat/domain";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "../../session";
import { FullPageStatus, Unconfigured } from "../../ui";

export default function AuthCallbackPage() {
  const { ready, configured, session, membership } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !configured) return;
    if (membership?.role === "trainer") {
      router.replace("/accountability");
      return;
    }
    if (session && !membership) {
      router.replace("/signup");
      return;
    }
    if (membership?.role === "client") {
      router.replace("/login?notice=coach");
      return;
    }
    if (session) return;
    router.replace("/login");
  }, [ready, configured, session, membership, router]);

  if (ready && !configured) return <Unconfigured />;
  return <FullPageStatus body={copy.checkingSession} />;
}
