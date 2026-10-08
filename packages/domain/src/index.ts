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

export {
  NUDGE_GAP_DAYS,
  adherenceLabel,
  addDays,
  buildAccountability,
  bundlePrograms,
  calendarDate,
  dayDraftSchema,
  dayStatus,
  daysBetween,
  exerciseDraftSchema,
  exerciseIsLogged,
  lastLoggedLabel,
  loggedExerciseCount,
  nudgeBody,
  nudgeReasons,
  prescription,
  programCopy,
  programDayForDate,
  programSourceText,
  programDraftMessage,
  programDraftSchema,
  programSchema,
  progressLabel,
  progressPercent,
  shortDate,
  todayStatusLabel,
  weekDates,
  weekdayLabel,
} from "./program";
export type {
  AssignedProgram,
  BoardAction,
  BoardClient,
  BoardCounts,
  BoardExerciseLog,
  BoardRow,
  BoardSet,
  BoardWorkout,
  DayDraft,
  ExerciseDraft,
  NudgeReason,
  Program,
  ProgramDay,
  ProgramDraft,
  ProgramExercise,
  TodayStatus,
} from "./program";

export {
  KG_PER_LB,
  formatWeight,
  isOfflineError,
  logOperationSchema,
  logSchema,
  parseWeight,
  roundTo,
  weightToKg,
  weightUnitSchema,
} from "./log";
export type { Log, LogOperation, SetEntry, WeightUnit } from "./log";

export { createLogQueue } from "./log-queue";
export type { LogFlushResult, LogQueue } from "./log-queue";

export { deferredPushDelivery } from "./push";
export type { NudgePush, PushDelivery } from "./push";

export {
  MESSAGE_PAGE_SIZE,
  chatCopy,
  isUuid,
  mergeMessages,
  messageBodySchema,
  clientAiPresentation,
  coachJumpIn,
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
export type { Message, MessageSegment, MessageSource, ThreadPreview } from "./message";

export {
  AUDIT_DECISIONS,
  AUDIT_TEMPLATES,
  TRAINER_ACTIONS,
  auditCounts,
  auditEventSchema,
  auditTimeline,
  parseAuditEvent,
  parseAuditEvents,
} from "./audit";
export type { AuditEvent, AuditTimelineItem } from "./audit";

export { inboxItemSchema, parseTrainerNotices, trainerNoticeSchema } from "./inbox";
export type { InboxItem, TrainerNotice } from "./inbox";

export {
  DEFAULT_AI_SETTINGS,
  DEMO_ORG_ID,
  KB_CATEGORIES,
  aiCopy,
  aiSettingsSchema,
  categoryLabel,
  decisionLabel,
  kbArticleSchema,
  kbDraftSchema,
  parseAiSettings,
  parseHeldDraft,
  parseKbArticles,
} from "./ai";
export type { AiSettings, HeldDraftMarker, KbArticle, KbCategory, KbDraft } from "./ai";
