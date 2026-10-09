import { runEval } from "../packages/ai/src/eval-batch";

const entry = process.argv[1] ?? "";
if (entry.endsWith("run-eval.ts") || entry.endsWith("run-eval.js")) {
  runEval()
    .then(({ failed, lines }) => {
      console.log(lines.join("\n"));
      if (failed > 0) process.exit(1);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Eval failed.");
      process.exit(1);
    });
}
