import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { InboxReason } from "@cleat/domain";
import { inboxRowChrome } from "./inbox-chrome";

const here = dirname(fileURLToPath(import.meta.url));

test("emergency rows use the solid urgent fill with an alert icon and injury rows use the urgent outline", () => {
  const emergency = inboxRowChrome("emergency");
  const injury = inboxRowChrome("injury");
  assert.equal(emergency.urgency, "solid");
  assert.equal(emergency.alert, true);
  assert.match(emergency.rowClass, /inbox-row-emergency/);
  assert.match(emergency.chipClass, /pill-emergency/);
  assert.equal(injury.urgency, "outline");
  assert.equal(injury.alert, false);
  assert.equal(injury.chipClass, "pill pill-injury");
  assert.match(injury.rowClass, /inbox-row-injury/);
  assert.doesNotMatch(injury.chipClass, /pill-urgent|pill-nudge|pill-missed|pill-emergency/);
  assert.equal(emergency.rowClass === injury.rowClass, false);
  assert.equal(emergency.chipClass === injury.chipClass, false);
  const quiet: InboxReason[] = ["injury", "ai_escalate", "unanswered", "missed"];
  for (const reason of quiet) assert.equal(inboxRowChrome(reason).alert, false, reason);

  const css = readFileSync(join(here, "../../globals.css"), "utf8");
  const emergencyRule = css.match(/\.list-row\.inbox-row-emergency[\s\S]*?\{[^}]+\}/)?.[0] ?? "";
  const injuryRule = css.match(/\.list-row\.inbox-row-injury\s*\{[^}]+\}/)?.[0] ?? "";
  const emergencyChip = css.match(/\.pill-emergency\s*\{[^}]+\}/)?.[0] ?? "";
  const injuryChip = css.match(/\.pill-injury\s*\{[^}]+\}/)?.[0] ?? "";
  assert.match(emergencyRule, /background:\s*var\(--nudge\)/);
  assert.match(emergencyRule, /color:\s*var\(--on-urgent\)/);
  assert.match(css, /\.list-row\.inbox-row-emergency \.avatar\s*\{[^}]*background:\s*var\(--on-urgent\)/);
  assert.match(css, /\.list-row\.inbox-row-emergency \.avatar\s*\{[^}]*color:\s*var\(--nudge\)/);
  assert.match(injuryRule, /background:\s*var\(--nudge-bg\)/);
  assert.match(injuryRule, /border:\s*1px solid var\(--nudge\)/);
  assert.match(emergencyChip, /background:\s*var\(--nudge\)/);
  assert.match(emergencyChip, /color:\s*var\(--on-urgent\)/);
  assert.match(injuryChip, /background:\s*var\(--nudge-bg\)/);
  assert.match(injuryChip, /color:\s*var\(--text\)/);
  assert.match(injuryChip, /border-color:\s*var\(--nudge\)/);
  for (const rule of [emergencyRule, injuryRule, emergencyChip, injuryChip]) {
    assert.doesNotMatch(rule, /#[0-9A-Fa-f]{3,8}/);
  }
  assert.equal(css.includes(".pill-injury::before"), false);

  const view = readFileSync(join(here, "inbox-view.tsx"), "utf8");
  assert.match(view, /data-testid="inbox-alert-icon"/);
  assert.match(view, /\{chrome\.alert \? <AlertIcon \/> : null\}/);
  assert.equal(view.split("<AlertIcon />").length, 2);
  assert.match(view, /data-urgency=\{chrome\.urgency\}/);
});
