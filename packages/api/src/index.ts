export {
  acceptInvite,
  CleatRequestError,
  createInvite,
  createTrainerOrg,
  fetchCoach,
  fetchInvitePreview,
  fetchMembership,
  listClients,
  listInvites,
  requestEmailCode,
  updateProfile,
  verifyEmailCode,
} from "./auth";
export {
  accessToken,
  bookSession,
  cancelSession,
  clearAvailabilityOverride,
  disconnectGoogle,
  downloadIcs,
  googleStatus,
  loadClientCalendar,
  loadTrainerCalendar,
  saveAvailabilityOverride,
  saveOrgCalendarSettings,
  saveSlotMinutes,
  saveWeeklyAvailability,
  startGoogleConnect,
  subscribeLink,
} from "./calendar";
export type {
  BookResult,
  ClientCalendarData,
  GoogleStatus,
  OrgCalendarSettings,
  SubscribeLink,
  TrainerCalendarData,
} from "./calendar";
export {
  applyClientLog,
  assignProgram,
  dismissNudge,
  fetchAccountability,
  fetchActiveProgram,
  fetchClientTraining,
  fetchMyProgram,
  fetchOrgPrograms,
  sendNudge,
  updateWeightUnit,
} from "./programs";
export type { AccountabilitySnapshot, ClientTraining } from "./programs";
export { createAuthorizedClient, createCleatClient, readPublicSupabaseConfig } from "./supabase";
export type { AuthStorage, CleatClient, PublicSupabaseConfig } from "./supabase";
export { onClientMessage, setClientMessageHook } from "./message-hook";
export type { ClientMessageEvent, ClientMessageHook } from "./message-hook";
export { noopPushNotifier } from "./push";
export type { PushNotice, PushNotifier } from "./push";
export { subscribeToThread } from "./realtime";
export {
  embedAssignedProgram,
  fetchAiSettings,
  fetchOpenDraft,
  actOnHeldDraft,
  listAuditEvents,
  listKbArticles,
  listTrainerNotices,
  loadTrainerInbox,
  markNoticeRead,
  resolveInboxItem,
  saveAiSettings,
  saveKbArticle,
  saveUnansweredHours,
} from "./ai-desk";
export type { TrainerInbox } from "./ai-desk";
export {
  deliverChatMessage,
  ensureThread,
  listMessages,
  listThreadPreviews,
  sendChatMessage,
} from "./messages";
export type { DeliverChatInput } from "./messages";
