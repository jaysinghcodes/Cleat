"use client";

import { CleatRequestError, requestEmailCode, verifyEmailCode } from "@cleat/api";
import { copy, emailCodeSchema, emailSchema, validationMessage } from "@cleat/domain";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "../session";
import { AuthFrame, Banner, FullPageStatus, TextField, Unconfigured } from "../ui";

export default function LoginPage() {
  const { ready, configured, session, membership, client, refresh, signOut } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("notice");
    if (value === "coach") setNotice(copy.deskForCoaches);
  }, []);

  useEffect(() => {
    if (!ready || membership?.role !== "trainer") return;
    router.replace("/accountability");
  }, [ready, membership, router]);

  if (!ready) return <FullPageStatus body={copy.checkingSession} />;
  if (!configured || !client) return <Unconfigured />;
  if (membership?.role === "client") {
    return (
      <AuthFrame title="Welcome back" lede="Sign in to your trainer desk">
        <Banner tone="error">{copy.deskForCoaches}</Banner>
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => void signOut()}>
          Log out
        </button>
      </AuthFrame>
    );
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(validationMessage(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await requestEmailCode(client!, parsed.data, {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        missingAccountMessage: copy.noTrainerAccount,
      });
      setEmail(parsed.data);
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

  return (
    <AuthFrame
      title="Welcome back"
      lede="Sign in to your trainer desk"
      foot={
        <>
          New here? <Link href="/signup">Sign up</Link>
        </>
      }
    >
      {notice ? <Banner tone="error">{notice}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {session && !membership ? (
        <p className="help">
          This account has no desk yet. <Link href="/signup">Finish sign-up</Link>
        </p>
      ) : null}
      {step === "email" ? (
        <form onSubmit={(event) => void sendCode(event)}>
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
            Log in
          </button>
          <p className="auth-foot">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setStep("email");
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
