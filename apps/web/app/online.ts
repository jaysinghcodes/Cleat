"use client";

import { useEffect, useState } from "react";
import { readScreenPreview } from "./preview-mode";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (readScreenPreview() === "offline") {
      setOnline(false);
      return;
    }
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}
