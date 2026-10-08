"use client";

import { useParams } from "next/navigation";
import { ChatDesk } from "../chat-desk";

export default function ChatThreadPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = typeof params.clientId === "string" ? params.clientId : "";
  return <ChatDesk clientId={clientId} />;
}
