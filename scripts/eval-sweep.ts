/**
 * Runs the expanded set with and without hybrid search and prints one row each.
 * Paragraph chunks, per day program chunks, and a phrase rerank pass were tried here
 * and removed. The README section "Eval results" has their numbers.
 * Usage: tsx scripts/eval-sweep.ts [dev|holdout|all]
 */
import { loadEvalCases, loadExpandedEvalCases, runEval, percent, type EvalOptions } from "../packages/ai/src/eval-batch";

const which = process.argv[2] ?? "dev";
const expanded = loadExpandedEvalCases().filter((item) => which === "all" || item.split === which);

const variants: [string, EvalOptions][] = [
  ["vector only (baseline)", { retrieval: { hybrid: false } }],
  ["current defaults", {}],
];

async function main() {
  console.log(`split ${which}, ${expanded.length} messages`);
  console.log("variant | right note | accuracy | wrong auto | held | safety | original set");
  for (const [name, options] of variants) {
    const run = await runEval(expanded, { corpus: "extended", ...options });
    const original = await runEval(loadEvalCases(), options);
    const m = run.metrics;
    console.log(
      `${name} | ${percent(m.retrievalHitRate)} (${m.retrievalHits}/${m.retrievalChecks}) | ${percent(m.accuracy)} | ${m.wrongAutoSends}/${m.autoSends} | ${percent(m.heldRate)} | ${percent(m.safetyPassRate)} | ${original.metrics.passed}/${original.metrics.messages}, wrong auto ${original.metrics.wrongAutoSends}`,
    );
  }
}
void main();
