import type { CleatClient } from "@cleat/api";
import Constants from "expo-constants";
import * as Linking from "expo-linking";

const CALLBACK_PATH = "auth/callback";

/**
 * Where Supabase should send the email link.
 * Expo Go cannot open the `cleat` scheme. It opens `exp://<metro>/--/auth/callback`.
 * A dev build or store build uses the `cleat` scheme from app.config.ts.
 */
export function emailRedirectTarget(): string {
  const host = Constants.expoConfig?.hostUri;
  if (Constants.expoGoConfig && host) {
    return `exp://${host}/--/${CALLBACK_PATH}`;
  }
  return Linking.createURL(CALLBACK_PATH);
}

const EMAIL_LINK_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;

type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

function queryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isEmailLinkType(value: string | undefined): value is EmailLinkType {
  return EMAIL_LINK_TYPES.some((item) => item === value);
}

export function urlHasAuthParams(url: string): boolean {
  const { queryParams } = Linking.parse(url);
  return Boolean(queryParams?.code || queryParams?.token_hash || queryParams?.access_token);
}

/**
 * Finish a magic link opened in Expo Go or a build.
 * The email code path does not need this. PKCE links carry `code`.
 * Older links carry `token_hash` or the access token pair.
 */
export async function completeAuthFromUrl(supabase: CleatClient, url: string): Promise<boolean> {
  const { queryParams } = Linking.parse(url);
  const code = queryValue(queryParams?.code);
  const tokenHash = queryValue(queryParams?.token_hash);
  const type = queryValue(queryParams?.type);
  const accessToken = queryValue(queryParams?.access_token);
  const refreshToken = queryValue(queryParams?.refresh_token);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }
  if (tokenHash && isEmailLinkType(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return !error;
  }
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return !error;
  }
  return false;
}
