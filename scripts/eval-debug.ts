/** Prints the retrieval and confidence detail behind each expanded eval row. Usage: tsx scripts/eval-debug.ts [idPrefix] */
import { explainEval, loadExpandedEvalCases } from "../packages/ai/src/eval-batch";

const prefix = process.argv[2] ?? "";
const cases = loadExpandedEvalCases().filter((item) => item.id.startsWith(prefix));
explainEval(cases, { corpus: "extended" }).then((rows) => {
  for (const row of rows) console.log(row);
});
