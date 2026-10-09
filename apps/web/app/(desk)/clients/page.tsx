"use client";

import { CleatRequestError, createInvite, listClients, listInvites } from "@cleat/api";
import { chatCopy, copy, initials, inviteExpiryLabel, type ClientRosterItem, type InviteRecord } from "@cleat/domain";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../session";
import { clientInviteUrl } from "../../supabase";
import { Banner } from "../../ui";

export default function ClientsPage() {
  const { client, session, membership } = useSession();
  const [clients, setClients] = useState<ClientRosterItem[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    const [roster, openInvites] = await Promise.all([listClients(client), listInvites(client)]);
    setClients(roster);
    setInvites(openInvites);
  }, [client]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof CleatRequestError ? err.message : copy.generic);
    });
  }, [load]);

  async function onCreate() {
    if (!client || !session || !membership) return;
    setPending(true);
    setError(null);
    try {
      await createInvite(client, membership.orgId, session.userId);
      await load();
    } catch (err) {
      setError(err instanceof CleatRequestError ? err.message : copy.generic);
    } finally {
      setPending(false);
    }
  }

  async function onCopy(id: string) {
    const url = clientInviteUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
    } catch {
      setError(copy.generic);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <p>Invite a client with a link. It expires in 7 days.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void onCreate()}
          disabled={pending}
        >
          Create invite link
        </button>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        {invites.length === 0 ? (
          <div className="list-row">
            <div className="meta">No invite links yet.</div>
          </div>
        ) : (
          invites.map((invite) => {
            const url = clientInviteUrl(invite.id);
            return (
              <div className="list-row" key={invite.id}>
                <div className="spacer" style={{ flex: 1 }}>
                  <div className="name">{invite.acceptedAt ? "Used invite" : "Pending invite"}</div>
                  <div className="meta invite-link">{url}</div>
                  <div className="meta">
                    {invite.acceptedAt ? "Used" : inviteExpiryLabel(invite.expiresAt)}
                  </div>
                </div>
                {invite.acceptedAt ? null : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onCopy(invite.id)}>
                    {copiedId === invite.id ? copy.linkCopied : "Copy"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {clients.length === 0 ? (
          <div className="list-row">
            <div className="meta">{copy.noClients}</div>
          </div>
        ) : (
          clients.map((person) => (
            <div className="list-row" key={person.userId}>
              <div className="avatar">{initials(person.displayName)}</div>
              <div className="spacer" style={{ flex: 1 }}>
                <div className="name">{person.displayName}</div>
              </div>
              <Link href={`/chat/${person.userId}`} className="btn btn-ghost btn-sm">
                {chatCopy.openChat}
              </Link>
            </div>
          ))
        )}
      </div>
    </>
  );
}
