import { copy } from "@cleat/domain";
import { Link } from "expo-router";
import { Text } from "react-native";
import { AuthScreen } from "../../components/ui";
import { useTheme } from "../../theme";

export default function InviteIndex() {
  const { tokens } = useTheme();
  return (
    <AuthScreen title="Join a roster" lede={copy.openInvite}>
      <Text style={{ color: tokens.textSecondary, fontSize: 13, textAlign: "center" }}>
        Already joined? <Link href="/login" style={{ color: tokens.accentText }}>Log in</Link>
      </Text>
    </AuthScreen>
  );
}
