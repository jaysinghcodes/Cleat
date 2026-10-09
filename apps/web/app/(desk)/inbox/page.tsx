import { Suspense } from "react";
import { InboxDesk } from "./inbox-desk";
import { serverInboxWindowHours } from "./inbox-window";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  const defaultWindowHours = serverInboxWindowHours(process.env.INBOX_UNANSWERED_HOURS);
  return (
    <Suspense fallback={<p className="meta">Loading the inbox</p>}>
      <InboxDesk defaultWindowHours={defaultWindowHours} />
    </Suspense>
  );
}
