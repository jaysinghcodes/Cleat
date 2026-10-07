export const APP_NAME = "Cleat" as const;

export { programSchema } from "./program";
export type { Program } from "./program";

export { logSchema } from "./log";
export type { Log } from "./log";

export { messageSchema } from "./message";
export type { Message } from "./message";

export { auditEventSchema } from "./audit";
export type { AuditEvent } from "./audit";

export { inboxItemSchema } from "./inbox";
export type { InboxItem } from "./inbox";
