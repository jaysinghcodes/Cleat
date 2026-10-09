"use client";

import { screenCopy } from "@cleat/domain";
import { ScreenState } from "./screen-state";
import { ThemeCycle } from "./theme";
import { BrandLockup } from "./ui";

export function SessionLoadFallback({ body, onRetry }: { body: string; onRetry: () => void }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <BrandLockup />
        <ScreenState kind="error" title={screenCopy.couldNotLoad} body={body} onRetry={onRetry} />
        <ThemeCycle />
      </div>
    </div>
  );
}
