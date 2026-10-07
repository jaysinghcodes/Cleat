"use client";

import { CleatRequestError, createTrainerOrg, requestEmailCode, verifyEmailCode } from "@cleat/api";
import {
  PENDING_TRAINER_KEY,
  copy,
  deviceTimezone,
  emailCodeSchema,
  trainerOrgSchema,
  trainerSignupSchema,
  validationMessage,
} from "@cleat/domain";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "../session";
import { AuthFrame, Banner, FullPageStatus, TextField, Unconfigured } from "../ui";

export default function SignupPage() {
  const { ready, configured, session, membership, client, refresh, signOut } = useSession();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (membership?.role === "trainer") router.replace("/accountability");
  }, [membership, router]);

  if (!ready) return <FullPageStatus body={copy.checkingSession} />;
  if (!configured || !client) return <Unconfigured />;
  if (membership?.role === "client") {
    return (
      <AuthFrame title="Create your desk" lede="For coaches · start with up to 10 clients free">
        <Banner tone="error">{copy.deskForCoaches}</Banner>
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => void signOut()}>
          Log out
        </button>
      </AuthFrame>
    );
  }

  function storePending(name: string, org: string, timezone: string) {
    localStorage.setItem(
      PENDING_TRAINER_KEY,
      JSON.stringify({ displayName: name, orgName: org, timezone }),
    );
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    const timezone = deviceTimezone();
    const parsed = trainerSignupSchema.safeParse({ displayName, email, orgName, timezone });
    if (!parsed.success) {
      setError(validationMessage(parsed.error));
      return;
    }
    storePending(parsed.data.displayName, parsed.data.orgName, parsed.data.timezone);
    setPending(true);
    setError(null);
    try {
      await requestEmailCode(client!, parsed.data.email, {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        missingAccountMessage: copy.emailFailed,
      });
      setEmail(parsed.data.email);
      setStep("code");
    } catch (err) {
      setError(err instanceof CleatRequestError ? err.message : copy.generic);
    } finally {
      setPending(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    const parsed = emailCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(validationMessage(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await verifyEmailCode(client!, email, parsed.data);
      await refresh();
    } catch (err) {
      setError(err instanceof CleatRequestError ? err.message : copy.generic);
    } finally {
      setPending(false);
    }
  }

  async function finishOrg(event: FormEvent) {
    event.preventDefault();
    const timezone = deviceTimezone();
    const parsed = trainerOrgSchema.safeParse({ displayName, orgName, timezone });
    if (!parsed.success) {
      setError(validationMessage(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createTrainerOrg(client!, parsed.data);
      localStorage.removeItem(PENDING_TRAINER_KEY);
      await refresh();
    } catch (err) {
      setError(err instanceof CleatRequestError ? err.message : copy.generic);
    } finally {
      setPending(false);
    }
  }

  const lede = "For coaches · start with up to 10 clients free";
  const foot = (
    <>
      Already have an account? <Link href="/login">Log in</Link>
    </>
  );

  if (session && !membership) {
    return (
      <AuthFrame title="Create your desk" lede={lede} foot={foot}>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <form onSubmit={(event) => void finishOrg(event)}>
          <TextField
            id="name"
            label="Full name"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <TextField
            id="org"
            label="Gym / brand name"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
          />
          <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>
            Create account
          </button>
        </form>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Create your desk" lede={lede} foot={step === "form" ? foot : undefined}>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {step === "form" ? (
        <form onSubmit={(event) => void sendCode(event)}>
          <TextField
            id="name"
            label="Full name"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <TextField
            id="email"
            label="Work email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            id="org"
            label="Gym / brand name"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
          />
          <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>
            Email me a code
          </button>
        </form>
      ) : (
        <form onSubmit={(event) => void submitCode(event)}>
          <p className="help">
            Enter the code from your email, or open the sign-in link on this device.
          </p>
          <TextField
            id="code"
            label="Email code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>
            Create account
          </button>
          <p className="auth-foot">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setStep("form");
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
