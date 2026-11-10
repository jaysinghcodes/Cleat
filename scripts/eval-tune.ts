/**
 * Grid over the confidence weights and the auto send cutoff.
 * Usage: tsx scripts/eval-tune.ts [dev|holdout|all]
 * Tune on dev. Read holdout once, after the choice is made.
 */
import { loadEvalCases, loadExpandedEvalCases, runEval } from "../packages/ai/src/eval-batch";

const which = process.argv[2] ?? "dev";
const expanded = loadExpandedEvalCases().filter((item) => which === "all" || item.split === which);
const original = loadEvalCases();

async function main() {
  const answerable = expanded.filter((item) => item.expected === "answer").length;
  console.log(`split ${which}: ${expanded.length} messages, ${answerable} answerable`);
  console.log("strength coverage cutoff | right answers | wrong auto | held | original set fails");
  for (const strength of [0, 0.1, 0.15, 0.2, 0.3, 0.45]) {
    const weights = { strength, coverage: Math.round((1 - strength) * 100) / 100 };
    for (const threshold of [0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
      const run = await runEval(expanded, { corpus: "extended", weights, threshold });
      const base = await runEval(original, { weights, threshold });
      const m = run.metrics;
      console.log(
        `${weights.strength.toFixed(2)} ${weights.coverage.toFixed(2)} ${threshold.toFixed(2)} | ${m.autoSends - m.wrongAutoSends}/${answerable} | ${m.wrongAutoSends} | ${(m.heldRate * 100).toFixed(1)}% | ${base.failed}`,
      );
    }
  }
}
void main();
