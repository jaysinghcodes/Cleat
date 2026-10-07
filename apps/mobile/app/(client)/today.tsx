import { PlaceholderScreen } from "../../components/placeholder";
import { useSession } from "../../lib/session";

export default function TodayScreen() {
  const { coach } = useSession();
  const detail = coach ? `with ${firstWord(coach.displayName)}` : undefined;
  return <PlaceholderScreen title="Today" detail={detail} />;
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
