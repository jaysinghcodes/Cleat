/**
 * The desk calls onClientMessage once after a client message is stored.
 * The default hook does nothing. Ticket 4 passes a server hook that may
 * post an AI message or a fixed safety template.
 */
export type ClientMessageEvent = {
  id: string;
  threadId: string;
  orgId: string;
  clientId: string;
  body: string;
  createdAt: string;
};

export type ClientMessageHook = (event: ClientMessageEvent) => Promise<void>;

let current: ClientMessageHook = async () => undefined;

export function setClientMessageHook(next: ClientMessageHook): void {
  current = next;
}

export async function onClientMessage(event: ClientMessageEvent): Promise<void> {
  await current(event);
}
