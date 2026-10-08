"use client";

import { confidenceBarColor, type AiDecision } from "@cleat/ai";

export function ConfidenceBar({
  value,
  threshold,
  decision,
}: {
  value: number;
  threshold: number;
  decision?: AiDecision | null;
}) {
  const color = confidenceBarColor({ confidence: value, threshold, decision });
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
