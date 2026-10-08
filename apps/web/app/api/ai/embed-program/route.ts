import { aiCopy } from "@cleat/domain";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../../lib/server/admin";
import { aiCors, aiJson, requireTrainer } from "../../../../lib/server/actor";
import { createAiRuntime } from "../../../../lib/server/openai";
import { embedProgramById } from "../../../../lib/server/pipeline";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: aiCors });
}

export async function POST(request: Request) {
  const actor = await requireTrainer(request);
  if (!actor.ok) return actor.response;
  let payload: { programId?: unknown };
  try {
    payload = (await request.json()) as { programId?: unknown };
  } catch {
    return aiJson({ error: aiCopy.loadFailed }, 400);
  }
  const programId = typeof payload.programId === "string" ? payload.programId : "";
  if (!programId) return aiJson({ error: aiCopy.loadFailed }, 400);
  const admin = createServiceRoleClient();
  if (!admin) return aiJson({ error: aiCopy.loadFailed }, 500);
  try {
    await embedProgramById(admin, createAiRuntime().embedder, actor.orgId, programId);
  } catch {
    return aiJson({ error: aiCopy.loadFailed }, 500);
  }
  return aiJson({ ok: true }, 200);
}
