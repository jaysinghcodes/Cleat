"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "../../app/session";

/** Sends a signed-in trainer to the desk after hydration. Logged-out HTML stays static. */
export function TrainerRedirect() {
  const { ready, configured, membership } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !configured) return;
    if (membership?.role === "trainer") router.replace("/accountability");
  }, [ready, configured, membership, router]);

  return null;
}
