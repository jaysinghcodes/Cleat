"use client";

import { createInvite, listClients, listInvites } from "@cleat/api";
import {
  chatCopy,
  copy,
  initials,
  inviteExpiryLabel,
  screenCopy,
  userFacingError,
  type ClientRosterItem,
  type InviteRecord,
} from "@cleat/domain";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { haltForPreview, PREVIEW_FAILURE } from "../../preview-mode";
import { useSession } from "../../session";
import { clientInviteUrl } from "../../supabase";
import { ScreenState } from "../../screen-state";
import { Banner } from "../../ui";

export default function ClientsPage() {
  const { client, session, membership } = useSession();
  const [clients, setClients] = useState<ClientRosterItem[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    if (!client) return;
    const [roster, openInvites] = await Promise.all([listClients(client), listInvites(client)]);
    setClients(roster);
    setInvites(openInvites);
    setStatus("ready");
  }, [client]);

  useEffect(() => {
    if (
      haltForPreview({
        error: () => {
          setError(PREVIEW_FAILURE);
          setStatus("error");
        },
        ready: () => {
          setClients([]);
          setInvites([]);
          setError(null);
          setStatus("ready");
        },
      })
    ) {
      return;
    }
    void load().catch((err: unknown) => {
      setError(userFacingError(err, screenCopy.loadFailed));
      setStatus("error");
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
      setError(userFacingError(err, copy.generic));
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
      {status === "error" ? null : error ? <Banner tone="error">{error}</Banner> : null}
      {status === "loading" ? <ScreenState kind="loading" title={screenCopy.loadingClients} /> : null}
      {status === "error" ? (
        <ScreenState
          kind="error"
          title={screenCopy.couldNotLoad}
          body={error ?? screenCopy.loadFailed}
          onRetry={() => {
            setStatus("loading");
            setError(null);
            void load().catch((err: unknown) => {
              setError(userFacingError(err, screenCopy.loadFailed));
              setStatus("error");
            });
          }}
        />
      ) : null}
      {status === "ready" ? (
      <>
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
      {clients.length === 0 ? (
        <ScreenState kind="empty" title="No clients yet" body={copy.noClients} />
      ) : (
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {clients.map((person) => (
            <div className="list-row" key={person.userId}>
              <div className="avatar">{initials(person.displayName)}</div>
              <div className="spacer" style={{ flex: 1 }}>
                <div className="name">{person.displayName}</div>
              </div>
              <Link href={`/chat/${person.userId}`} className="btn btn-ghost btn-sm">
                {chatCopy.openChat}
              </Link>
            </div>
          ))}
      </div>
      )}
      </>
      ) : null}
    </>
  );
}
