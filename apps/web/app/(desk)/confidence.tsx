"use client";

import { bandFor } from "@cleat/ai";

export function ConfidenceBar({ value, threshold }: { value: number; threshold: number }) {
  const band = bandFor(value, threshold);
  const color = band === "high" ? "var(--done)" : band === "medium" ? "var(--accent)" : "var(--nudge)";
  const width = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="confidence">
      <div className="confidence-track">
        <div className="confidence-fill" style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="confidence-num">{value.toFixed(2)}</span>
    </div>
  );
}
