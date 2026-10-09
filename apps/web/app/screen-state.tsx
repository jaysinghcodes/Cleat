"use client";

import { screenCopy, userFacingError } from "@cleat/domain";

export function ScreenState({
  kind,
  title,
  body,
  onRetry,
  testId,
}: {
  kind: "loading" | "empty" | "error" | "offline";
  title: string;
  body?: string;
  onRetry?: () => void;
  testId?: string;
}) {
  const detail = kind === "error" ? userFacingError(body ?? "", screenCopy.loadFailed) : body;
  const live = kind === "loading" || kind === "offline" ? "polite" : undefined;
  return (
    <section
      className={`screen-state screen-state-${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={live}
      data-state={kind}
      data-testid={testId}
    >
      <h2>{title}</h2>
      {detail ? <p>{detail}</p> : null}
      {kind === "error" && onRetry ? (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          {screenCopy.retry}
        </button>
      ) : null}
    </section>
  );
}

export function OfflineBanner({ message }: { message: string }) {
  return (
    <div className="banner banner-offline" role="status">
      {message}
    </div>
  );
}
