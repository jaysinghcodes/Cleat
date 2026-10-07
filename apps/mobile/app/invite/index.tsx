import { copy, inviteIdFromText } from "@cleat/domain";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { AuthScreen, Banner, Button, Field } from "../../components/ui";
import { useTheme } from "../../theme";

export default function InviteIndex() {
  const { tokens } = useTheme();
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openLink() {
    const inviteId = inviteIdFromText(link);
    if (!inviteId) {
      setError(copy.inviteInvalid);
      return;
    }
    router.push(`/invite/${inviteId}`);
  }

  return (
    <AuthScreen title="Join a roster" lede={copy.openInvite}>
      {error ? <Banner message={error} /> : null}
      <Field
        label="Invite link"
        value={link}
        onChangeText={(value) => {
          setLink(value);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button label="Continue" onPress={openLink} />
      <Text style={{ color: tokens.textSecondary, fontSize: 13, textAlign: "center", marginTop: 20 }}>
        Already joined? <Link href="/login" style={{ color: tokens.accentText }}>Log in</Link>
      </Text>
    </AuthScreen>
  );
}
