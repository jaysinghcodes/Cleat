import { CleatRequestError, fetchInvitePreview, requestEmailCode, verifyEmailCode } from "@cleat/api";
import {
  PENDING_INVITE_KEY,
  clientAcceptSchema,
  copy,
  deviceTimezone,
  emailCodeSchema,
  firstName,
  initials,
  validationMessage,
} from "@cleat/domain";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { Link, Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { AuthScreen, Banner, Button, Field } from "../../components/ui";
import { useSession } from "../../lib/session";
import { useTheme } from "../../theme";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const { ready, configured, session, membership, client, refresh, error: sessionError } = useSession();
  const { tokens } = useTheme();
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "active" | "expired" | "accepted" | "missing">("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!ready || !client) return;
    if (!isUuid(token)) {
      setStatus("missing");
      return;
    }
    let cancelled = false;
    void fetchInvitePreview(client, token)
      .then((preview) => {
        if (cancelled) return;
        setTrainerName(preview.trainerName);
        setOrgName(preview.orgName);
        setStatus(preview.status);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("missing");
        setError(err instanceof CleatRequestError ? err.message : copy.inviteInvalid);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, client, token]);

  if (!ready) return null;
  if (membership?.role === "client") return <Redirect href="/today" />;
  if (!configured || !client) {
    return (
      <AuthScreen title="Join a roster">
        <Banner message={copy.unconfigured} />
      </AuthScreen>
    );
  }

  const coach = trainerName ?? "your coach";
  const title = trainerName ? `Join ${firstName(trainerName)}'s roster` : "Join your coach's roster";
  const lede = orgName
    ? `You've been invited to Cleat by ${coach} · ${orgName}`
    : "You've been invited to Cleat";

  async function sendCode() {
    const timezone = deviceTimezone();
    const parsed = clientAcceptSchema.safeParse({
      inviteId: token,
      displayName: name,
      email,
      timezone,
    });
    if (!parsed.success) {
      setError(validationMessage(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await AsyncStorage.setItem(
        PENDING_INVITE_KEY,
        JSON.stringify({
          inviteId: parsed.data.inviteId,
          displayName: parsed.data.displayName,
          timezone: parsed.data.timezone,
        }),
      );
      if (session) {
        await refresh();
        return;
      }
      await requestEmailCode(client!, parsed.data.email, {
        shouldCreateUser: true,
        emailRedirectTo: Linking.createURL("/auth/callback"),
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

  async function submitCode() {
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
    <AuthScreen title={title} lede={lede}>
      {error ? <Banner message={error} /> : null}
      {sessionError ? <Banner message={sessionError} /> : null}
      {status === "loading" ? <Text style={{ color: tokens.textSecondary }}>Checking your session</Text> : null}
      {status === "missing" ? <Banner message={copy.inviteInvalid} /> : null}
      {status === "expired" ? <Banner message={copy.inviteExpired} /> : null}
      {status === "accepted" ? <Banner message={copy.inviteUsed} /> : null}
      {status === "active" ? (
        <>
          <View
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.card,
              borderRadius: tokens.radius,
              padding: 14,
              marginBottom: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tokens.bgSoft,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            >
              <Text style={{ color: tokens.textSecondary, fontWeight: "700" }}>
                {initials(trainerName ?? "")}
              </Text>
            </View>
            <View>
              <Text style={{ color: tokens.text, fontWeight: "600" }}>{trainerName ?? "Your coach"}</Text>
              <Text style={{ color: tokens.textSecondary, fontSize: 12, marginTop: 2 }}>{copy.inviteExpires}</Text>
            </View>
          </View>
          {step === "form" ? (
            <>
              <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" />
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
              <Button label="Accept and open app" disabled={pending} onPress={() => void sendCode()} />
            </>
          ) : (
            <>
              <Text style={{ color: tokens.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 14 }}>
                Enter the code from your email, or open the sign-in link on this device.
              </Text>
              <Field
                label="Email code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
              />
              <Button label="Accept and open app" disabled={pending} onPress={() => void submitCode()} />
            </>
          )}
        </>
      ) : null}
      <Text style={{ color: tokens.textSecondary, fontSize: 13, textAlign: "center", marginTop: 20 }}>
        Already joined? <Link href="/login" style={{ color: tokens.accentText }}>Log in</Link>
      </Text>
    </AuthScreen>
  );
}
