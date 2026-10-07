"use client";

import { createCleatClient, readPublicSupabaseConfig, type CleatClient } from "@cleat/api";

let client: CleatClient | null = null;

export function webSupabaseConfig() {
  return readPublicSupabaseConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function clientInviteUrl(inviteId: string): string {
  const configured = process.env.NEXT_PUBLIC_CLIENT_APP_URL?.trim().replace(/\/$/, "");
  const origin = configured || "http://localhost:8081";
  return `${origin}/invite/${inviteId}`;
}

export function getWebSupabase(): CleatClient | null {
  const config = webSupabaseConfig();
  if (!config || typeof window === "undefined") return null;
  if (!client) {
    client = createCleatClient(config, { detectSessionInUrl: true });
  }
  return client;
}
