import {
  loadEvalCases,
  loadExpandedEvalCases,
  metricLines,
  runEval,
  type EvalCase,
  type EvalRun,
} from "../packages/ai/src/eval-batch";

function splitOf(cases: EvalCase[], split: "dev" | "holdout"): EvalCase[] {
  return cases.filter((item) => item.split === split);
}

async function main(): Promise<number> {
  const verbose = process.argv.includes("--verbose");
  const original = await runEval(loadEvalCases());
  console.log(original.lines.join("\n"));

  const expandedCases = loadExpandedEvalCases();
  const expanded = await runEval(expandedCases, { corpus: "extended" });
  const dev = await runEval(splitOf(expandedCases, "dev"), { corpus: "extended" });
  const holdout = await runEval(splitOf(expandedCases, "holdout"), { corpus: "extended" });

  console.log("");
  console.log("expanded set (docs/eval-messages-v2.json, with docs/eval-notes.json)");
  const shown = verbose ? expanded.lines.slice(1) : expanded.failures;
  if (shown.length > 0) console.log(shown.join("\n"));
  console.log("");
  console.log("summary");
  const report: [string, EvalRun][] = [
    ["original", original],
    ["expanded", expanded],
    ["expanded dev", dev],
    ["expanded holdout", holdout],
  ];
  for (const [label, run] of report) {
    console.log(metricLines(label, run.metrics).join("\n"));
    console.log("");
  }
  return original.failed;
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("run-eval.ts") || entry.endsWith("run-eval.js")) {
  main()
    .then((failed) => {
      if (failed > 0) process.exit(1);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Eval failed.");
      process.exit(1);
    });
}
