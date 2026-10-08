import * as z from "zod";

export const ROLES = ["trainer", "client"] as const;

export const INVITE_TTL_DAYS = 7;

export const PENDING_TRAINER_KEY = "cleat-pending-trainer";

export const PENDING_INVITE_KEY = "cleat-pending-invite";

export const roleSchema = z.enum(ROLES);

export type Role = z.infer<typeof roleSchema>;

function requiredText(max: number, message: string) {
  return z.string().trim().refine((value) => value.length >= 1 && value.length <= max, message);
}

export const displayNameSchema = requiredText(80, "Enter your name.");

export const orgNameSchema = requiredText(80, "Enter your gym or brand name.");

export const timezoneSchema = requiredText(64, "Enter a timezone.");

export const emailSchema = z
  .string()
  .trim()
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid email.");

export const emailCodeSchema = z
  .string()
  .trim()
  .refine((value) => /^\d{6,8}$/.test(value), "Enter the code from your email.");

export const trainerSignupSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  orgName: orgNameSchema,
  timezone: timezoneSchema,
});

export type TrainerSignup = z.infer<typeof trainerSignupSchema>;

export const trainerOrgSchema = z.object({
  displayName: displayNameSchema,
  orgName: orgNameSchema,
  timezone: timezoneSchema,
});

export type TrainerOrgInput = z.infer<typeof trainerOrgSchema>;

export const pendingTrainerSchema = trainerOrgSchema;

export const clientAcceptSchema = z.object({
  inviteId: z.uuid(),
  displayName: displayNameSchema,
  email: emailSchema,
  timezone: timezoneSchema,
});

export type ClientAccept = z.infer<typeof clientAcceptSchema>;

export const pendingInviteSchema = z.object({
  inviteId: z.uuid(),
  displayName: displayNameSchema,
  timezone: timezoneSchema,
});

export type PendingInvite = z.infer<typeof pendingInviteSchema>;

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema,
  timezone: timezoneSchema,
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export type Membership = {
  orgId: string;
  orgName: string;
  role: Role;
  displayName: string;
  timezone: string;
};

export type CoachSummary = {
  displayName: string;
  orgName: string;
};

export type InvitePreviewStatus = "active" | "expired" | "accepted" | "missing";

export type InvitePreview = {
  orgName: string | null;
  trainerName: string | null;
  expiresAt: string | null;
  status: InvitePreviewStatus;
};

export type ClientRosterItem = {
  userId: string;
  displayName: string;
};

export type InviteRecord = {
  id: string;
  expiresAt: string;
  acceptedAt: string | null;
};

const membershipRowSchema = z.object({
  org_id: z.uuid(),
  org_name: z.string(),
  role: roleSchema,
  display_name: z.string(),
  timezone: z.string(),
});

const coachRowSchema = z.object({
  display_name: z.string(),
  org_name: z.string(),
});

const invitePreviewRowSchema = z.object({
  org_name: z.string().nullable(),
  trainer_name: z.string().nullable(),
  expires_at: z.string().nullable(),
  status: z.enum(["active", "expired", "accepted", "missing"]),
});

const rosterProfileSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
});

const membershipListSchema = z.object({
  user_id: z.uuid(),
  role: roleSchema,
});

const inviteRecordSchema = z.object({
  id: z.uuid(),
  expires_at: z.string(),
  accepted_at: z.string().nullable(),
});

export const copy = {
  inviteExpires: "Invite expires in 7 days",
  inviteExpired: "This invite has expired. Ask your coach for a new link.",
  inviteUsed: "This invite has already been used.",
  inviteInvalid: "This invite link is not valid.",
  inviteOtherOrg: "This account already belongs to another org.",
  trainerCannotJoin: "Trainer accounts cannot join a roster as a client.",
  signInDesk: "Sign in before creating a desk.",
  signInInvite: "Sign in before accepting an invite.",
  enterName: "Enter your name.",
  enterOrg: "Enter your gym or brand name.",
  enterTimezone: "Enter a timezone.",
  enterEmail: "Enter a valid email.",
  enterCode: "Enter the code from your email.",
  codeFailed: "That code did not work. Request a new one.",
  emailFailed: "We could not send the email. Try again.",
  waitCode: "Wait a moment, then request a new code.",
  noTrainerAccount: "No account for that email. Sign up first.",
  noClientAccount: "No account for that email. Open your invite link.",
  generic: "Something went wrong. Try again.",
  profileSaveFailed: "Could not save your profile.",
  inviteCreateFailed: "Could not create an invite link.",
  deskForCoaches: "This desk is for coaches. Open the Cleat app to train.",
  appForClients: "This app is for clients. Coaches use the web desk.",
  laterTicket: "This arrives in a later ticket.",
  unconfigured: "Add the Supabase URL and anon key to the environment, then reload.",
  checkingSession: "Checking your session",
  linkCopied: "Link copied",
  noClients: "No clients yet. Create a link and send it to them.",
  arrivesLater: "Arrives in a later ticket",
  billingLater: "Billing arrives in a later ticket.",
  openInvite: "Paste the invite link from your coach.",
} as const;

export const knownProductErrors = [
  copy.inviteExpired,
  copy.inviteUsed,
  copy.inviteInvalid,
  copy.inviteOtherOrg,
  copy.trainerCannotJoin,
  copy.signInDesk,
  copy.signInInvite,
  copy.enterName,
  copy.enterOrg,
  copy.enterTimezone,
  "Sign in before assigning a program.",
  "Only a coach can assign a program.",
  "Enter a program name.",
  "Enter a start date.",
  "That client is not on your roster.",
  "Add between 1 and 14 days.",
  "Add an exercise to each training day.",
  "Enter a day name.",
  "Enter an exercise name.",
  "Sets must be between 1 and 20.",
  "Enter the reps.",
  "Keep notes under 280 characters.",
  "Enter a video link that starts with https.",
  "Sign in as a client to log a workout.",
  "That log could not be saved.",
  "Keep the note under 280 characters.",
  "That day is not on your program.",
  "That exercise is not on your program.",
  "Enter reps for at least one set.",
  "Enter a weight between 0 and 999.",
  "That set is not on this exercise.",
  "Sign in before sending a nudge.",
  "Only a coach can send a nudge.",
  "Choose a nudge type.",
  "Enter a nudge message.",
  "That nudge is not on your account.",
] as const;

export function productError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  const known = knownProductErrors.find((item) => message.includes(item));
  return known ?? fallback;
}

const INVITE_ID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function inviteIdFromText(value: string): string | null {
  const match = value.trim().match(INVITE_ID_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

export function deviceTimezone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && zone.length <= 64) return zone;
  } catch {
    // Intl can be missing in a very old runtime. UTC is a safe default.
  }
  return "UTC";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0));
  const value = letters.join("").toUpperCase();
  return value || "?";
}

export function firstName(name: string): string {
  const part = name.trim().split(/\s+/)[0];
  return part || "your coach";
}

export function inviteExpiryLabel(expiresAt: string, now = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms)) return copy.inviteExpires;
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return copy.inviteExpired;
  if (days === 1) return "Expires in 1 day";
  return `Expires in ${days} days`;
}

function rowsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return [data];
  return [];
}

export function parseMembership(data: unknown): Membership | null {
  const parsed = z.array(membershipRowSchema).safeParse(rowsOf(data));
  if (!parsed.success) return null;
  const row = parsed.data[0];
  if (!row) return null;
  return {
    orgId: row.org_id,
    orgName: row.org_name,
    role: row.role,
    displayName: row.display_name,
    timezone: row.timezone,
  };
}

export function parseCoach(data: unknown): CoachSummary | null {
  const parsed = z.array(coachRowSchema).safeParse(rowsOf(data));
  if (!parsed.success) return null;
  const row = parsed.data[0];
  if (!row) return null;
  return { displayName: row.display_name, orgName: row.org_name };
}

export function parseInvitePreview(data: unknown): InvitePreview {
  const parsed = z.array(invitePreviewRowSchema).safeParse(rowsOf(data));
  const row = parsed.success ? parsed.data[0] : undefined;
  if (!row) {
    return { orgName: null, trainerName: null, expiresAt: null, status: "missing" };
  }
  return {
    orgName: row.org_name,
    trainerName: row.trainer_name,
    expiresAt: row.expires_at,
    status: row.status,
  };
}

export function parseRoster(
  members: unknown,
  profiles: unknown,
): ClientRosterItem[] {
  const memberRows = z.array(membershipListSchema).safeParse(members);
  const profileRows = z.array(rosterProfileSchema).safeParse(profiles);
  if (!memberRows.success || !profileRows.success) return [];
  const names = new Map(profileRows.data.map((profile) => [profile.id, profile.display_name]));
  return memberRows.data
    .filter((member) => member.role === "client")
    .map((member) => ({
      userId: member.user_id,
      displayName: names.get(member.user_id) ?? "Client",
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function parseInvites(data: unknown): InviteRecord[] {
  const parsed = z.array(inviteRecordSchema).safeParse(data ?? []);
  if (!parsed.success) return [];
  return parsed.data.map((row) => ({
    id: row.id,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
  }));
}

export function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? copy.generic;
}
