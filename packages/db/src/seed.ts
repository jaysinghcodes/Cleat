import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HASH_EMBEDDING_MODEL,
  chunkArticle,
  hashEmbedder,
  toVectorLiteral,
  type Embedder,
} from "@cleat/ai";
import {
  buildAccountability,
  bundlePrograms,
  calendarDate,
  programSourceText,
  type BoardExerciseLog,
  type BoardSet,
  type BoardWorkout,
  type ProgramDay,
} from "@cleat/domain";
import pg from "pg";
import { DEMO_ARTICLES, DEMO_ORG_ID } from "./demo-copy";

const CASEY_ID = "d1200000-0000-4000-8000-000000000004";
const ZONE = "America/Chicago";

type Row = Record<string, unknown>;

function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function rows(result: pg.QueryResult): Row[] {
  return result.rows as Row[];
}

function databaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;
  return "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
}

async function embedderFromEnv(): Promise<Embedder> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return hashEmbedder;
  return {
    model: "text-embedding-3-small",
    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
      });
      if (!response.ok) throw new Error(`Embedding request failed (${response.status}).`);
      const payload = (await response.json()) as { data?: { index: number; embedding: number[] }[] };
      return [...(payload.data ?? [])]
        .sort((left, right) => left.index - right.index)
        .map((row) => row.embedding);
    },
  };
}

async function replaceChunks(
  client: pg.PoolClient,
  embedder: Embedder,
  snippets: {
    clientId: string | null;
    source: "kb" | "program";
    articleId: string | null;
    programId: string | null;
    snippet: string;
  }[],
): Promise<void> {
  if (snippets.length === 0) return;
  const vectors = await embedder.embed(snippets.map((item) => item.snippet));
  for (let index = 0; index < snippets.length; index += 1) {
    const item = snippets[index];
    const vector = vectors[index];
    if (!item || !vector) continue;
    await client.query(
      `insert into public.chunks (
        org_id, client_id, source, article_id, program_id, position, snippet, embedding, model
      ) values ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)`,
      [
        DEMO_ORG_ID,
        item.clientId,
        item.source,
        item.articleId,
        item.programId,
        index,
        item.snippet,
        toVectorLiteral(vector),
        embedder.model,
      ],
    );
  }
}

async function assertBoard(client: pg.PoolClient): Promise<void> {
  const today = calendarDate(ZONE);
  const members = await client.query(
    `select user_id::text, created_at from public.memberships where org_id = $1 and role = 'client'`,
    [DEMO_ORG_ID],
  );
  const profiles = await client.query(`select id::text, display_name, weight_unit from public.profiles`);
  const programs = await client.query(
    `select id::text, org_id::text, client_id::text, name, start_date::text, status
     from public.programs where org_id = $1 and status = 'active'`,
    [DEMO_ORG_ID],
  );
  const days = await client.query(
    `select id::text, program_id::text, position, name, is_rest
     from public.program_days where org_id = $1`,
    [DEMO_ORG_ID],
  );
  const exercises = await client.query(
    `select id::text, day_id::text, program_id::text, position, name, sets, reps, notes, video_url
     from public.program_exercises where org_id = $1`,
    [DEMO_ORG_ID],
  );
  const workouts = await client.query(
    `select client_id::text, program_id::text, scheduled_on::text, status, flagged, skip_note
     from public.workout_logs where org_id = $1`,
    [DEMO_ORG_ID],
  );
  const exerciseLogs = await client.query(
    `select client_id::text, exercise_id::text, scheduled_on::text, status
     from public.exercise_logs where org_id = $1`,
    [DEMO_ORG_ID],
  );
  const sets = await client.query(
    `select l.client_id::text, l.exercise_id::text, l.scheduled_on::text, s.set_index, s.weight_kg, s.reps
     from public.set_logs s
     join public.exercise_logs l on l.id = s.exercise_log_id
     where s.org_id = $1`,
    [DEMO_ORG_ID],
  );

  const names = new Map(rows(profiles).map((row) => [text(row.id), text(row.display_name)]));
  const units = new Map(rows(profiles).map((row) => [text(row.id), text(row.weight_unit)]));
  const board = buildAccountability({
    today,
    clients: rows(members).map((row) => ({
      userId: text(row.user_id),
      displayName: names.get(text(row.user_id)) ?? "Client",
      weightUnit: units.get(text(row.user_id)) === "kg" ? "kg" : "lb",
      joinedOn: calendarDate(ZONE, new Date(text(row.created_at))),
    })),
    programs: bundlePrograms(rows(programs), rows(days), rows(exercises)),
    workouts: rows(workouts).map(
      (row): BoardWorkout => ({
        clientId: text(row.client_id),
        programId: text(row.program_id),
        scheduledOn: text(row.scheduled_on).slice(0, 10),
        status: text(row.status) as BoardWorkout["status"],
        flagged: row.flagged === true,
        skipNote: row.skip_note ? text(row.skip_note) : null,
      }),
    ),
    exerciseLogs: rows(exerciseLogs).map(
      (row): BoardExerciseLog => ({
        clientId: text(row.client_id),
        exerciseId: text(row.exercise_id),
        scheduledOn: text(row.scheduled_on).slice(0, 10),
        status: text(row.status) as BoardExerciseLog["status"],
      }),
    ),
    sets: rows(sets).map(
      (row): BoardSet => ({
        clientId: text(row.client_id),
        exerciseId: text(row.exercise_id),
        scheduledOn: text(row.scheduled_on).slice(0, 10),
        setIndex: Number(row.set_index),
        weightKg: Number(row.weight_kg),
        reps: Number(row.reps),
      }),
    ),
  });

  const byName = new Map(board.rows.map((row) => [row.displayName, row]));
  const problems: string[] = [];
  if (board.counts.done !== 2) problems.push(`done ${board.counts.done}`);
  if (board.counts.skipped !== 1) problems.push(`skipped ${board.counts.skipped}`);
  if (board.counts.needsNudge !== 2) problems.push(`needs nudge ${board.counts.needsNudge}`);
  const jordan = byName.get("Jordan Kim");
  const riley = byName.get("Riley Wong");
  const casey = byName.get("Casey Torres");
  const sam = byName.get("Sam Lee");
  const morgan = byName.get("Morgan Patel");
  if (sam?.today !== "done" || morgan?.today !== "done") problems.push("done clients drifted");
  if (jordan?.today !== "skipped" || !jordan.needsNudge) problems.push("Jordan is not a skipped nudge");
  if (riley?.today !== "missed" || !riley.needsNudge) problems.push("Riley does not need a nudge");
  if (casey?.today === "done" || casey?.needsNudge) problems.push("Casey should stay off the done and nudge counts");
  if (problems.length > 0) {
    const detail = board.rows
      .map((row) => `${row.displayName} ${row.today} nudge=${row.needsNudge} ${row.reasons.join(",")}`)
      .join("; ");
    throw new Error(`Board check failed: ${problems.join("; ")}. ${detail}`);
  }
}

async function main(): Promise<void> {
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../supabase/seed.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const pool = new pg.Pool({ connectionString: databaseUrl() });
  const client = await pool.connect();
  try {
    await client.query(sql);
    for (const article of DEMO_ARTICLES) {
      const updated = await client.query(
        `update public.kb_articles
         set title = $2, category = $3, body = $4
         where id = $1 and org_id = $5`,
        [article.id, article.title, article.category, article.body, DEMO_ORG_ID],
      );
      if (updated.rowCount !== 1) throw new Error(`Missing demo article ${article.title}`);
    }

    await client.query(`delete from public.chunks where org_id = $1`, [DEMO_ORG_ID]);
    const embedder = await embedderFromEnv();
    const articleSnippets = DEMO_ARTICLES.flatMap((article) =>
      chunkArticle(article.title, article.body).map((snippet) => ({
        clientId: null,
        source: "kb" as const,
        articleId: article.id,
        programId: null,
        snippet,
      })),
    );

    const programRows = rows(
      await client.query(
        `select id::text, client_id::text, name from public.programs
         where org_id = $1 and status = 'active'`,
        [DEMO_ORG_ID],
      ),
    );
    const dayRows = rows(
      await client.query(
        `select id::text, program_id::text, position, name, is_rest
         from public.program_days where org_id = $1`,
        [DEMO_ORG_ID],
      ),
    );
    const exerciseRows = rows(
      await client.query(
        `select id::text, day_id::text, position, name, sets, reps, notes
         from public.program_exercises where org_id = $1`,
        [DEMO_ORG_ID],
      ),
    );
    const programSnippets = programRows.map((program) => {
      const days: ProgramDay[] = dayRows
        .filter((day) => day.program_id === program.id)
        .sort((left, right) => Number(left.position) - Number(right.position))
        .map((day) => ({
          id: text(day.id),
          position: Number(day.position),
          name: text(day.name),
          rest: day.is_rest === true,
          exercises: exerciseRows
            .filter((exercise) => exercise.day_id === day.id)
            .sort((left, right) => Number(left.position) - Number(right.position))
            .map((exercise) => ({
              id: text(exercise.id),
              position: Number(exercise.position),
              name: text(exercise.name),
              sets: Number(exercise.sets),
              reps: text(exercise.reps),
              notes: text(exercise.notes),
              videoUrl: null,
            })),
        }));
      return {
        clientId: text(program.client_id),
        source: "program" as const,
        articleId: null,
        programId: text(program.id),
        snippet: programSourceText({ name: text(program.name), days }),
      };
    });

    await replaceChunks(client, embedder, [...articleSnippets, ...programSnippets]);
    await assertBoard(client);

    const summary = await client.query(
      `select
        (select name from public.orgs where id = $1) as org_name,
        (select display_name from public.profiles where id = 'd1100000-0000-4000-8000-000000000001') as trainer_name,
        (select auto_send from public.ai_settings where org_id = $1) as auto_send,
        (select slot_minutes from public.trainer_settings where user_id = 'd1100000-0000-4000-8000-000000000001') as slot_minutes,
        (select count(*) from public.memberships where org_id = $1 and role = 'client') as clients,
        (select count(*) from public.invites where org_id = $1 and accepted_at is null) as pending_invites,
        (select count(*) from public.programs where org_id = $1 and name = 'Foundation 3-day' and status = 'active') as foundation,
        (select count(*) from public.programs where org_id = $1 and name = 'Hypertrophy 4-day' and status = 'active') as hypertrophy,
        (select count(*) from public.kb_articles where org_id = $1) as articles,
        (select count(*) from public.chunks where org_id = $1) as chunks,
        (select count(*) from public.messages where org_id = $1) as messages,
        (select count(*) from public.sessions where org_id = $1 and status = 'booked') as sessions,
        (select count(*) from public.inbox_items
          where org_id = $1 and client_id = $2 and priority = 'p0' and status = 'open' and template_id = 'medical_safety') as injury_inbox`,
      [DEMO_ORG_ID, CASEY_ID],
    );
    const line = rows(summary)[0];
    if (!line) throw new Error("Seed summary was empty.");
    if (text(line.trainer_name) !== "Alex Rivera" || text(line.org_name) !== "Rivera Strength") {
      throw new Error("Trainer or org name drifted.");
    }
    if (line.auto_send !== true || Number(line.slot_minutes) !== 45) {
      throw new Error("Auto send or slot length drifted.");
    }
    console.log(
      [
        "Cleat demo seed",
        `trainer ${text(line.trainer_name)} · Coach`,
        `org ${text(line.org_name)}`,
        `clients ${text(line.clients)}`,
        `pending invites ${text(line.pending_invites)}`,
        `auto send ${line.auto_send === true ? "on" : "off"}`,
        `slot minutes ${text(line.slot_minutes)}`,
        `Foundation 3-day ${text(line.foundation)}`,
        `Hypertrophy 4-day ${text(line.hypertrophy)}`,
        `articles ${text(line.articles)}`,
        `chunks ${text(line.chunks)}`,
        `messages ${text(line.messages)}`,
        `unanswered Riley Wong`,
        `booked sessions ${text(line.sessions)}`,
        `injury inbox ${text(line.injury_inbox)}`,
        `embedder ${embedder.model === HASH_EMBEDDING_MODEL ? "offline hash" : embedder.model}`,
      ].join("\n"),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Seed failed.";
  console.error(message);
  process.exit(1);
});
