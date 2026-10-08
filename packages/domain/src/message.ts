import * as z from "zod";
import { copy, firstName } from "./auth";

/** Newest page size for a thread. Older rows load with the same limit. */
export const MESSAGE_PAGE_SIZE = 30;

export const chatCopy = {
  title: "Chat",
  trainerLede: "One thread with each client.",
  threads: "Threads",
  emptyRoster: "No clients yet. Invite someone from Clients.",
  goToClients: "Go to Clients",
  chooseClient: "Select a client to open the thread.",
  notOnRoster: copy.notOnRoster,
  emptyThread: "No messages yet.",
  clientEmpty: "No messages yet. Say hello when you are ready.",
  loadEarlier: "Load earlier messages",
  loading: "Loading messages",
  send: "Send",
  sendFailed: "Could not send that message.",
  loadFailed: "Could not load messages.",
  signIn: copy.signInSend,
  emptyBody: copy.emptyBody,
  tooLong: copy.tooLong,
  onlyCoach: copy.onlyCoach,
  missingClient: "Choose a client.",
  openChat: "Open chat",
  clientMeta: "Client",
  coachMeta: "Coach",
  writeMessage: "Write a message",
  newMessageTitle: "New message",
} as const;

export function replyPlaceholder(name: string): string {
  return `Reply as ${firstName(name)}`;
}

export function messagePlaceholder(name: string): string {
  const label = firstName(name);
  if (!name.trim() || label === "your") return chatCopy.writeMessage;
  return `Message ${label}`;
}

export const messageBodySchema = z
  .string()
  .trim()
  .refine((value) => value.length >= 1, chatCopy.emptyBody)
  .refine((value) => value.length <= 4000, chatCopy.tooLong);

export const messageSchema = z.object({
  id: z.uuid(),
  threadId: z.uuid(),
  orgId: z.uuid(),
  senderId: z.uuid(),
  body: z.string(),
  createdAt: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

export type ThreadPreview = {
  threadId: string;
  clientId: string;
  lastBody: string | null;
  lastAt: string | null;
};

export type MessageSegment = {
  kind: "text" | "link";
  text: string;
};

const messageRowSchema = z.object({
  id: z.uuid(),
  thread_id: z.uuid(),
  org_id: z.uuid(),
  sender_id: z.uuid(),
  body: z.string(),
  created_at: z.string(),
});

const postedRowSchema = z.object({
  message_id: z.uuid(),
  message_thread_id: z.uuid(),
  message_org_id: z.uuid(),
  message_sender_id: z.uuid(),
  posted_body: z.string(),
  message_created_at: z.string(),
});

const previewRowSchema = z.object({
  thread_id: z.uuid(),
  client_id: z.uuid(),
  last_body: z.string().nullable(),
  last_at: z.string().nullable(),
});

const LINK = /https?:\/\/[^\s<>"']+/gi;
const TRAILING = /[.,;:!?]+$/;

export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

/** Plain text, with http and https addresses split out so the UI can link them. */
export function splitMessageBody(body: string): MessageSegment[] {
  const parts: MessageSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(LINK)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trimmed = raw.replace(TRAILING, "");
    const link = trimmed.length > "https://".length ? trimmed : raw;
    if (start > last) parts.push({ kind: "text", text: body.slice(last, start) });
    parts.push({ kind: "link", text: link });
    const rest = raw.slice(link.length);
    last = start + raw.length;
    if (rest) parts.push({ kind: "text", text: rest });
  }
  if (last < body.length) parts.push({ kind: "text", text: body.slice(last) });
  if (parts.length === 0) parts.push({ kind: "text", text: body });
  return parts;
}

export function messagePreview(body: string, max = 80): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

export function parseMessageRow(data: unknown): Message | null {
  const parsed = messageRowSchema.safeParse(data);
  if (!parsed.success) return null;
  return {
    id: parsed.data.id,
    threadId: parsed.data.thread_id,
    orgId: parsed.data.org_id,
    senderId: parsed.data.sender_id,
    body: parsed.data.body,
    createdAt: parsed.data.created_at,
  };
}

export function parseMessageRows(data: unknown): Message[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = parseMessageRow(row);
    return parsed ? [parsed] : [];
  });
}

export function parsePostedMessage(data: unknown): Message | null {
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const parsed = postedRowSchema.safeParse(rows[0]);
  if (!parsed.success) return null;
  return {
    id: parsed.data.message_id,
    threadId: parsed.data.message_thread_id,
    orgId: parsed.data.message_org_id,
    senderId: parsed.data.message_sender_id,
    body: parsed.data.posted_body,
    createdAt: parsed.data.message_created_at,
  };
}

export function parseThreadPreviews(data: unknown): ThreadPreview[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = previewRowSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      {
        threadId: parsed.data.thread_id,
        clientId: parsed.data.client_id,
        lastBody: parsed.data.last_body,
        lastAt: parsed.data.last_at,
      },
    ];
  });
}

export function parseThreadId(data: unknown): string | null {
  if (typeof data === "string" && isUuid(data)) return data;
  return null;
}

export function upsertMessage(messages: Message[], incoming: Message): Message[] {
  if (messages.some((item) => item.id === incoming.id)) return messages;
  return [...messages, incoming].sort(byTime);
}

export function mergeMessages(older: Message[], newer: Message[]): Message[] {
  const seen = new Set<string>();
  return [...older, ...newer]
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort(byTime);
}

function byTime(a: Message, b: Message): number {
  const delta = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (!Number.isNaN(delta) && delta !== 0) return delta;
  return a.id.localeCompare(b.id);
}
