import { NextResponse } from "next/server";
import { readGoogleConfig } from "../../../../lib/google";
import { jsonError, userClientFromRequest } from "../../../../lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = readGoogleConfig();
  if (!config) {
    return NextResponse.json({ configured: false, connected: false, email: null });
  }
  const user = await userClientFromRequest(request);
  if (!user) return jsonError("Sign in before syncing a calendar.", 401);
  const { data, error } = await user.supabase.rpc("google_connection");
  if (error) return NextResponse.json({ configured: true, connected: false, email: null });
  const row = Array.isArray(data) ? data[0] : data;
  const record = row && typeof row === "object" ? (row as { connected?: boolean }) : {};
  return NextResponse.json({
    configured: true,
    connected: Boolean(record.connected),
    email: null,
  });
}
