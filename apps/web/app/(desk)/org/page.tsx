import { OrgDesk } from "./org-desk";
import { serverInboxWindowHours } from "../inbox/inbox-window";

export const dynamic = "force-dynamic";

export default function OrgPage() {
  const defaultWindowHours = serverInboxWindowHours(process.env.INBOX_UNANSWERED_HOURS);
  return <OrgDesk defaultWindowHours={defaultWindowHours} />;
}
