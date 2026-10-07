import {
  copy,
  parseCoach,
  parseInvitePreview,
  parseInvites,
  parseMembership,
  parseRoster,
  productError,
  profileUpdateSchema,
  trainerOrgSchema,
  type ClientRosterItem,
  type CoachSummary,
  type InvitePreview,
  type InviteRecord,
  type Membership,
  type ProfileUpdate,
  type TrainerOrgInput,
} from "@cleat/domain";
import type { CleatClient } from "./supabase";

export class CleatRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CleatRequestError";
  }
}

function fail(message: string | undefined, fallback: string): never {
  throw new CleatRequestError(productError(message, fallback));
}

export async function requestEmailCode(
  supabase: CleatClient,
  email: string,
  options: {
    shouldCreateUser: boolean;
    emailRedirectTo?: string;
    missingAccountMessage: string;
  },
): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: options.shouldCreateUser,
      emailRedirectTo: options.emailRedirectTo,
    },
  });
  if (!error) return;
  const message = error.message.toLowerCase();
  if (
    message.includes("rate") ||
    message.includes("security purposes") ||
    message.includes("only request this")
  ) {
    throw new CleatRequestError(copy.waitCode);
  }
  if (
    message.includes("not found") ||
    message.includes("signups not allowed") ||
    message.includes("user not allowed")
  ) {
    throw new CleatRequestError(options.missingAccountMessage);
  }
  throw new CleatRequestError(copy.emailFailed);
}

export async function verifyEmailCode(
  supabase: CleatClient,
  email: string,
  token: string,
): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw new CleatRequestError(copy.codeFailed);
}

export async function fetchMembership(supabase: CleatClient): Promise<Membership | null> {
  const { data, error } = await supabase.rpc("current_membership");
  if (error) fail(error.message, copy.generic);
  return parseMembership(data);
}

export async function fetchCoach(supabase: CleatClient): Promise<CoachSummary | null> {
  const { data, error } = await supabase.rpc("my_coach");
  if (error) fail(error.message, copy.generic);
  return parseCoach(data);
}

export async function createTrainerOrg(
  supabase: CleatClient,
  input: TrainerOrgInput,
): Promise<void> {
  const parsed = trainerOrgSchema.parse(input);
  const { error } = await supabase.rpc("create_trainer_org", {
    display_name: parsed.displayName,
    org_name: parsed.orgName,
    timezone: parsed.timezone,
  });
  if (error) fail(error.message, copy.generic);
}

export async function acceptInvite(
  supabase: CleatClient,
  inviteId: string,
  displayName: string,
  timezone: string,
): Promise<void> {
  const { error } = await supabase.rpc("accept_invite", {
    invite_id: inviteId,
    display_name: displayName,
    timezone,
  });
  if (error) fail(error.message, copy.generic);
}

export async function fetchInvitePreview(
  supabase: CleatClient,
  inviteId: string,
): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc("invite_preview", { invite_id: inviteId });
  if (error) fail(error.message, copy.inviteInvalid);
  return parseInvitePreview(data);
}

export async function updateProfile(
  supabase: CleatClient,
  userId: string,
  input: ProfileUpdate,
): Promise<ProfileUpdate> {
  const parsed = profileUpdateSchema.parse(input);
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.displayName,
      timezone: parsed.timezone,
    })
    .eq("id", userId)
    .select("display_name, timezone")
    .maybeSingle();
  if (error) fail(error.message, copy.profileSaveFailed);
  if (!data) throw new CleatRequestError(copy.profileSaveFailed);
  return {
    displayName: String(data.display_name),
    timezone: String(data.timezone),
  };
}

export async function listClients(supabase: CleatClient): Promise<ClientRosterItem[]> {
  const members = await supabase.from("memberships").select("user_id, role").eq("role", "client");
  if (members.error) fail(members.error.message, copy.generic);
  const rows = Array.isArray(members.data) ? members.data : [];
  const ids = rows
    .map((row) => (row && typeof row === "object" ? String((row as { user_id?: string }).user_id ?? "") : ""))
    .filter((id) => id.length > 0);
  if (ids.length === 0) return [];
  const profiles = await supabase.from("profiles").select("id, display_name").in("id", ids);
  if (profiles.error) fail(profiles.error.message, copy.generic);
  return parseRoster(members.data, profiles.data);
}

export async function listInvites(supabase: CleatClient): Promise<InviteRecord[]> {
  const { data, error } = await supabase
    .from("invites")
    .select("id, expires_at, accepted_at")
    .order("created_at", { ascending: false });
  if (error) fail(error.message, copy.generic);
  return parseInvites(data);
}

export async function createInvite(
  supabase: CleatClient,
  orgId: string,
  userId: string,
): Promise<InviteRecord> {
  const { data, error } = await supabase
    .from("invites")
    .insert({ org_id: orgId, created_by: userId })
    .select("id, expires_at, accepted_at")
    .single();
  if (error) fail(error.message, copy.inviteCreateFailed);
  const [invite] = parseInvites([data]);
  if (!invite) throw new CleatRequestError(copy.inviteCreateFailed);
  return invite;
}
