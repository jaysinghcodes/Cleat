"use client";

import { useParams } from "next/navigation";
import { AuditDetail } from "./audit-detail";

export default function AuditEventPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  return <AuditDetail eventId={eventId} />;
}
