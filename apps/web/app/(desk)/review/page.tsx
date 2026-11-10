import { Suspense } from "react";
import { serverInboxWindowHours } from "../inbox/inbox-window";
import { ReviewDesk } from "./review-desk";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const defaultWindowHours = serverInboxWindowHours(process.env.INBOX_UNANSWERED_HOURS);
  return (
    <Suspense fallback={<p className="meta">Loading held answers</p>}>
      <ReviewDesk defaultWindowHours={defaultWindowHours} />
    </Suspense>
  );
}
