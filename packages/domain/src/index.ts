export const APP_NAME = "Cleat" as const;

export {
  INVITE_TTL_DAYS,
  PENDING_INVITE_KEY,
  PENDING_TRAINER_KEY,
  ROLES,
  clientAcceptSchema,
  copy,
  deviceTimezone,
  displayNameSchema,
  emailCodeSchema,
  emailSchema,
  firstName,
  initials,
  inviteExpiryLabel,
  inviteIdFromText,
  knownProductErrors,
  orgNameSchema,
  parseCoach,
  parseInvitePreview,
  parseInvites,
  parseMembership,
  parseRoster,
  pendingInviteSchema,
  pendingTrainerSchema,
  productError,
  profileUpdateSchema,
  roleSchema,
  timezoneSchema,
  trainerOrgSchema,
  trainerSignupSchema,
  validationMessage,
} from "./auth";
export type {
  ClientAccept,
  ClientRosterItem,
  CoachSummary,
  InvitePreview,
  InvitePreviewStatus,
  InviteRecord,
  Membership,
  PendingInvite,
  ProfileUpdate,
  Role,
  TrainerOrgInput,
  TrainerSignup,
} from "./auth";

export { programSchema } from "./program";
export type { Program } from "./program";

export { logSchema } from "./log";
export type { Log } from "./log";

export {
  MESSAGE_PAGE_SIZE,
  chatCopy,
  isUuid,
  mergeMessages,
  messageBodySchema,
  messagePlaceholder,
  messagePreview,
  messageSchema,
  parseMessageRow,
  parseMessageRows,
  parsePostedMessage,
  parseThreadId,
  parseThreadPreviews,
  replyPlaceholder,
  splitMessageBody,
  upsertMessage,
} from "./message";
export type { Message, MessageSegment, ThreadPreview } from "./message";

export { auditEventSchema } from "./audit";
export type { AuditEvent } from "./audit";

export { inboxItemSchema } from "./inbox";
export type { InboxItem } from "./inbox";
