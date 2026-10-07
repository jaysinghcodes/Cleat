import { CleatRequestError, requestEmailCode, verifyEmailCode } from "@cleat/api";
import { copy, emailCodeSchema, emailSchema, validationMessage } from "@cleat/domain";
import { Link, Redirect } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { AuthScreen, Banner, Button, Field } from "../components/ui";
import { emailRedirectTarget } from "../lib/auth-link";
import { useSession } from "../lib/session";
import { useTheme } from "../theme";

export default function LoginScreen() {
  const { ready, configured, membership, client, refresh, signOut } = useSession();
  const { tokens } = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!ready) return null;
  if (!configured || !client) {
    return (
      <AuthScreen title="Log in" lede="Continue with your coach's Cleat">
        <Banner message={copy.unconfigured} />
      </AuthScreen>
    );
  }
  if (membership?.role === "client") return <Redirect href="/today" />;
  if (membership?.role === "trainer") {
    return (
      <AuthScreen title="Log in" lede="Continue with your coach's Cleat">
        <Banner message={copy.appForClients} />
        <Button label="Log out" tone="ghost" onPress={() => void signOut()} />
      </AuthScreen>
    );
  }

  async function sendCode() {
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
        emailRedirectTo: emailRedirectTarget(),
        missingAccountMessage: copy.noClientAccount,
      });
      setEmail(parsed.data);
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
    <AuthScreen title="Log in" lede="Continue with your coach's Cleat">
      {error ? <Banner message={error} /> : null}
      {step === "email" ? (
        <>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Button label="Email me a code" disabled={pending} onPress={() => void sendCode()} />
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
          <Button label="Continue" disabled={pending} onPress={() => void submitCode()} />
        </>
      )}
      <Text style={{ color: tokens.textSecondary, fontSize: 13, textAlign: "center", marginTop: 20 }}>
        Have an invite link? <Link href="/invite" style={{ color: tokens.accentText }}>Join instead</Link>
      </Text>
    </AuthScreen>
  );
}
