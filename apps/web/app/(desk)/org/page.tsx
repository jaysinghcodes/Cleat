"use client";

import { CleatRequestError, updateProfile } from "@cleat/api";
import { copy, profileUpdateSchema, validationMessage } from "@cleat/domain";
import { useState, type FormEvent } from "react";
import { useSession } from "../../session";
import { Banner, TextField } from "../../ui";

export default function OrgPage() {
  const { client, session, membership, refresh } = useSession();
  const [displayName, setDisplayName] = useState(membership?.displayName ?? "");
  const [timezone, setTimezone] = useState(membership?.timezone ?? "UTC");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client || !session) return;
    const parsed = profileUpdateSchema.safeParse({ displayName, timezone });
    if (!parsed.success) {
      setSaved(false);
      setError(validationMessage(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(client, session.userId, parsed.data);
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof CleatRequestError ? err.message : copy.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Org / Billing</h1>
          <p>{membership ? `Org: ${membership.orgName}` : "Org"}</p>
        </div>
      </div>
      <div className="card">
        {error ? <Banner tone="error">{error}</Banner> : null}
        {saved ? <Banner tone="ok">Saved</Banner> : null}
        <form onSubmit={(event) => void onSubmit(event)}>
          <TextField
            id="display-name"
            label="Display name"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <TextField
            id="timezone"
            label="Timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            Save
          </button>
        </form>
      </div>
      <div className="card">
        <p className="meta">{copy.billingLater}</p>
      </div>
    </>
  );
}
