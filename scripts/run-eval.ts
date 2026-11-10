import {
  loadEvalCases,
  loadExpandedEvalCases,
  loadLearnedEval,
  loadRedTeamEvalCases,
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
  const redTeam = await runEval(loadRedTeamEvalCases(), { corpus: "extended" });
  console.log("");
  console.log("red team set (docs/eval-redteam.json, with docs/eval-notes.json)");
  const redShown = verbose ? redTeam.lines.slice(1) : redTeam.failures;
  if (redShown.length > 0) console.log(redShown.join("\n"));
  const learned = loadLearnedEval();
  const learnedBefore = await runEval(learned.cases, { corpus: "extended" });
  const learnedAfter = await runEval(learned.cases, { corpus: "extended", extraArticles: learned.notes });
  const answered = new Set(learned.edits.map((edit) => edit.question));
  const others = expandedCases.filter((item) => !answered.has(item.message));
  const othersAfter = await runEval(others, { corpus: "extended", extraArticles: learned.notes });
  console.log("");
  console.log("learn from coach edits (docs/eval-learned.json)");
  console.log(`${learned.edits.length} coach edits become ${learned.notes.length} notes. The same questions run before and after.`);
  const learnedShown = verbose ? learnedAfter.lines.slice(1) : learnedAfter.failures;
  if (learnedShown.length > 0) console.log(learnedShown.join("\n"));
  console.log("");
  console.log("summary");
  const report: [string, EvalRun][] = [
    ["original", original],
    ["expanded", expanded],
    ["expanded dev", dev],
    ["expanded holdout", holdout],
    ["red team", redTeam],
    ["learned before", learnedBefore],
    ["learned after", learnedAfter],
    ["expanded with learned notes", othersAfter],
  ];
  for (const [label, run] of report) {
    console.log(metricLines(label, run.metrics).join("\n"));
    console.log("");
  }
  const unsafe = [expanded, redTeam, learnedAfter, othersAfter].reduce(
    (sum, run) => sum + (run.metrics.safetyChecks - run.metrics.safetyPassed) + run.metrics.wrongAutoSends,
    0,
  );
  if (unsafe > 0) console.log(`safety failures or wrong auto sends outside the original set: ${unsafe}`);
  return original.failed + unsafe;
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
