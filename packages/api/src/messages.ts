import {
  chatCopy,
  isUuid,
  MESSAGE_PAGE_SIZE,
  messageBodySchema,
  messagePreview,
  messageSchema,
  parseMessageRows,
  parsePostedMessage,
  parseThreadId,
  parseThreadPreviews,
  productError,
  validationMessage,
  type Message,
  type ThreadPreview,
} from "@cleat/domain";
import { CleatRequestError, fetchMembership } from "./auth";
import { onClientMessage, type ClientMessageHook } from "./message-hook";
import { noopPushNotifier, type PushNotifier } from "./push";
import type { CleatClient } from "./supabase";

function fail(message: string | undefined, fallback: string): never {
  throw new CleatRequestError(productError(message, fallback));
}

export async function listThreadPreviews(supabase: CleatClient): Promise<ThreadPreview[]> {
  const { data, error } = await supabase.rpc("thread_previews");
  if (error) fail(error.message, chatCopy.loadFailed);
  return parseThreadPreviews(data);
}

export async function ensureThread(supabase: CleatClient, clientId: string): Promise<string> {
  if (!isUuid(clientId)) throw new CleatRequestError(chatCopy.notOnRoster);
  const { data, error } = await supabase.rpc("ensure_thread", { target_client: clientId });
  if (error) fail(error.message, chatCopy.loadFailed);
  const id = parseThreadId(data);
  if (!id) throw new CleatRequestError(chatCopy.loadFailed);
  return id;
}

export async function listMessages(
  supabase: CleatClient,
  threadId: string,
  options?: { before?: string },
): Promise<{ messages: Message[]; hasMore: boolean }> {
  let query = supabase
    .from("messages")
    .select("id, thread_id, org_id, sender_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE + 1);
  if (options?.before) query = query.lt("created_at", options.before);
  const { data, error } = await query;
  if (error) fail(error.message, chatCopy.loadFailed);
  const parsed = parseMessageRows(data);
  const hasMore = parsed.length > MESSAGE_PAGE_SIZE;
  return { messages: parsed.slice(0, MESSAGE_PAGE_SIZE).reverse(), hasMore };
}

export type DeliverChatInput = {
  body: string;
  clientId?: string;
};

/**
 * Stores one message as the signed in user, then runs the server side effects.
 * A client message calls the Ticket 4 hook once and does not send a reply.
 * A trainer message calls the push notifier, which is a no-op in this ticket.
 */
export async function deliverChatMessage(
  supabase: CleatClient,
  input: DeliverChatInput,
  deps: { hook?: ClientMessageHook; notifier?: PushNotifier; accessToken?: string } = {},
): Promise<Message> {
  const parsed = messageBodySchema.safeParse(input.body);
  if (!parsed.success) throw new CleatRequestError(validationMessage(parsed.error));

  const membership = await fetchMembership(supabase);
  if (!membership) throw new CleatRequestError(chatCopy.signIn);

  const { data: userData, error: userError } = await supabase.auth.getUser(deps.accessToken);
  if (userError || !userData.user) throw new CleatRequestError(chatCopy.signIn);
  const userId = userData.user.id;

  const clientId = membership.role === "client" ? userId : input.clientId;
  if (!clientId || !isUuid(clientId)) throw new CleatRequestError(chatCopy.missingClient);

  const { data, error } = await supabase.rpc("post_message", {
    target_client: clientId,
    message_body: parsed.data,
  });
  if (error) fail(error.message, chatCopy.sendFailed);
  const message = parsePostedMessage(data);
  if (!message) throw new CleatRequestError(chatCopy.sendFailed);

  const hook = deps.hook ?? onClientMessage;
  const notifier = deps.notifier ?? noopPushNotifier;

  if (membership.role === "client") {
    try {
      await hook({
        id: message.id,
        threadId: message.threadId,
        orgId: message.orgId,
        clientId: userId,
        body: message.body,
        createdAt: message.createdAt,
      });
    } catch {
      // The row is already stored. Ticket 4 records its own failures inside the hook.
    }
    return message;
  }

  try {
    await notifier.notify({
      userId: clientId,
      title: chatCopy.newMessageTitle,
      body: messagePreview(message.body, 140),
      data: { screen: "chat", threadId: message.threadId },
    });
  } catch {
    // Chat delivery does not wait on push.
  }
  return message;
}

/** Posts to the desk so the server hook runs. Do not insert messages from the client. */
export async function sendChatMessage(
  supabase: CleatClient,
  deskOrigin: string,
  input: DeliverChatInput,
): Promise<Message> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new CleatRequestError(chatCopy.signIn);
  const origin = deskOrigin.replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${origin}/api/chat/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: input.body, clientId: input.clientId }),
    });
  } catch {
    throw new CleatRequestError(chatCopy.sendFailed);
  }
  const payload = (await response.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
  if (!response.ok) {
    const message = payload && typeof payload.error === "string" ? payload.error : chatCopy.sendFailed;
    throw new CleatRequestError(productError(message, chatCopy.sendFailed));
  }
  const parsedMessage = messageSchema.safeParse(payload?.message);
  if (!parsedMessage.success) throw new CleatRequestError(chatCopy.sendFailed);
  return parsedMessage.data;
}
