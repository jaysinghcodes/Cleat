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
  addDays as addProgramDays,
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

export {
  DEFAULT_CANCEL_CUTOFF_HOURS,
  DEFAULT_SLOT_MINUTES,
  EDITOR_WEEKDAYS,
  ICS_CACHE_TTL_SECONDS,
  PRIMARY_CALENDARS,
  WEEKDAY_LABELS,
  addDays,
  blocksForDay,
  bookingCopy,
  buildIcs,
  cancelCutoffMessage,
  cancelCutoffSchema,
  civilToKey,
  clientCanCancel,
  clientOpenSlots,
  confirmationLine,
  defaultWeeklyDraft,
  draftFromBlocks,
  formatCivil,
  formatInstant,
  formatMinute,
  formatMinuteRange,
  formatWeekLabel,
  formatWeekdayShort,
  googleEventBody,
  isGoogleConfigured,
  keyToCivil,
  minuteFromTimeInput,
  openSlots,
  parseAvailability,
  parseSessions,
  primaryCalendarSchema,
  rangesOverlap,
  sessionSummary,
  slotMinutesSchema,
  startOfWeekMonday,
  timeInputFromMinute,
  weekDays,
  weekdayOf,
  zonedParts,
  zonedTimeToUtc,
} from "./calendar";
export type {
  AvailabilityBlock,
  CivilDate,
  IcsEventInput,
  OpenSlot,
  PrimaryCalendar,
  SessionRecord,
  TimeRange,
  WeeklyDraft,
  ZonedParts,
} from "./calendar";

export { deferredPushNotifier } from "./notify";
export type { SessionNotifier } from "./notify";
