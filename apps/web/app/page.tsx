"use client";

import { copy } from "@cleat/domain";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "./session";
import { FullPageStatus, Unconfigured } from "./ui";

export default function HomePage() {
  const { ready, configured, membership } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !configured) return;
    if (membership?.role === "trainer") router.replace("/accountability");
    else router.replace("/login");
  }, [ready, configured, membership, router]);

  if (ready && !configured) return <Unconfigured />;
  return <FullPageStatus body={copy.checkingSession} />;
}
