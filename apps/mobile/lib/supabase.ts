import { createCleatClient, readPublicSupabaseConfig, type CleatClient } from "@cleat/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

let client: CleatClient | null = null;

export function mobileSupabaseConfig() {
  return readPublicSupabaseConfig({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getMobileSupabase(): CleatClient | null {
  const config = mobileSupabaseConfig();
  if (!config) return null;
  if (!client) {
    client = createCleatClient(config, {
      storage: AsyncStorage,
      detectSessionInUrl: Platform.OS === "web",
    });
  }
  return client;
}
