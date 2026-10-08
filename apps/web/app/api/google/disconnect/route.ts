import { NextResponse } from "next/server";
import { disconnectGoogleAccount, trainerRefreshToken } from "../../../../lib/google";
import { jsonError, userClientFromRequest } from "../../../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await userClientFromRequest(request);
  if (!user) return jsonError("Sign in before syncing a calendar.", 401);
  try {
    const refreshToken = await trainerRefreshToken(user.userId);
    await disconnectGoogleAccount({
      refreshToken,
      deleteCredentials: async () => {
        const { error } = await user.supabase.rpc("disconnect_google");
        if (error) throw new Error(error.message);
      },
    });
  } catch {
    return jsonError("Something went wrong. Try again.", 400);
  }
  return NextResponse.json({ ok: true });
}
