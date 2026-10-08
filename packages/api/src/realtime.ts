import { parseMessageRow, type Message } from "@cleat/domain";
import type { CleatClient } from "./supabase";

/**
 * One realtime channel for the open thread.
 * Returns a function that removes that channel.
 */
export function subscribeToThread(
  supabase: CleatClient,
  threadId: string,
  onMessage: (message: Message) => void,
): () => void {
  const channel = supabase
    .channel(`thread:${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const parsed = parseMessageRow(payload.new);
        if (parsed) onMessage(parsed);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
