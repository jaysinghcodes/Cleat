import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  GOOGLE_CALENDAR_SCOPE,
  calendarEventId,
  deleteGoogleBooking,
  disconnectGoogleAccount,
  exchangeGoogleCode,
  googleAuthUrl,
  readGoogleConfig,
  readOAuthState,
  signOAuthState,
  syncGoogleBooking,
  type GoogleHttp,
} from "./google";

const config = { clientId: "client-id", clientSecret: "client-secret" };
const sessionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const eventId = calendarEventId(sessionId, null);
const eventsUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const tokenUrl = "https://oauth2.googleapis.com/token";

type Call = { url: string; method: string; body: string };
type Reply = { ok: boolean; status: number; json?: unknown };

function recorder(handler: (url: string, init: RequestInit | undefined, calls: Call[]) => Reply): {
  http: GoogleHttp;
  calls: Call[];
} {
  const calls: Call[] = [];
  const http: GoogleHttp = async (url, init) => {
    const raw = init?.body;
    const body = typeof raw === "string" ? raw : raw instanceof URLSearchParams ? raw.toString() : "";
    calls.push({ url, method: init?.method ?? "GET", body });
    const reply = handler(url, init, calls);
    return {
      ok: reply.ok,
      status: reply.status,
      json: async () => reply.json ?? {},
    };
  };
  return { http, calls };
}

function tokenThen(next: (url: string, method: string) => Reply): (url: string, init: RequestInit | undefined) => Reply {
  return (url, init) => {
    if (url.includes("userinfo") || url.includes("openid")) {
      throw new Error(`unexpected Google call ${url}`);
    }
    if (url === tokenUrl) return { ok: true, status: 200, json: { access_token: "access-1" } };
    return next(url, init?.method ?? "GET");
  };
}

function booking(googleEventId: string | null, attach: (eventId: string) => Promise<void>) {
  return {
    trainerId: "trainer-1",
    sessionId,
    startsAt: "2026-11-01T23:00:00.000Z",
    endsAt: "2026-11-02T00:00:00.000Z",
    personName: "Sam",
    googleEventId,
    attach,
  };
}

function posts(calls: Call[]): Call[] {
  return calls.filter((call) => call.method === "POST" && call.url === eventsUrl);
}

describe("google calendar client", { concurrency: 1 }, () => {
  it("requests only the calendar.events scope", () => {
    const url = new URL(
      googleAuthUrl({
        clientId: "client-id",
        redirectUri: "http://localhost:3000/api/google/oauth/callback",
        state: "signed-state",
      }),
    );
    assert.equal(url.searchParams.get("scope"), GOOGLE_CALENDAR_SCOPE);
    assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/calendar.events");
    assert.equal(url.searchParams.has("include_granted_scopes"), false);
  });

  it("binds OAuth state to the signed-in user with an HMAC and a 10 minute expiry", () => {
    const before = Date.now();
    const state = signOAuthState("user-1", "secret");
    const userId = readOAuthState(state, "secret");
    assert.equal(userId, "user-1");

    const [payload, mac] = state.split(".");
    assert.ok(payload && mac);
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId: string;
      exp: number;
    };
    assert.equal(parsed.userId, "user-1");
    assert.ok(parsed.exp >= before + 10 * 60 * 1000);
    assert.ok(parsed.exp <= Date.now() + 10 * 60 * 1000);

    assert.equal(readOAuthState(state, "other-secret"), null);
    assert.equal(readOAuthState(`${payload}.not-the-mac`, "secret"), null);

    const swapped = Buffer.from(JSON.stringify({ userId: "user-2", exp: parsed.exp })).toString("base64url");
    assert.equal(readOAuthState(`${swapped}.${mac}`, "secret"), null);

    const expiredPayload = Buffer.from(
      JSON.stringify({ userId: "user-1", exp: Date.now() - 1_000 }),
    ).toString("base64url");
    const expiredMac = createHmac("sha256", "secret").update(expiredPayload).digest("base64url");
    assert.equal(readOAuthState(`${expiredPayload}.${expiredMac}`, "secret"), null);
  });

  it("exchanges the auth code without calling userinfo", async () => {
    const { http, calls } = recorder((url) => {
      if (url.includes("userinfo")) throw new Error(url);
      if (url === tokenUrl) return { ok: true, status: 200, json: { refresh_token: "refresh-1" } };
      throw new Error(`unexpected Google call ${url}`);
    });
    const exchanged = await exchangeGoogleCode(
      { code: "auth-code", redirectUri: "http://localhost:3000/api/google/oauth/callback" },
      { http, config },
    );
    assert.deepEqual(exchanged, { refreshToken: "refresh-1" });
    assert.deepEqual(
      calls.map((call) => call.url),
      [tokenUrl],
    );
  });

  it("creates one event on book and attaches that id", async () => {
    const { http, calls } = recorder(
      tokenThen((url, method) => {
        if (url === eventsUrl && method === "POST") return { ok: true, status: 200, json: { id: eventId } };
        throw new Error(`unexpected Google call ${method} ${url}`);
      }),
    );
    const attached: string[] = [];
    const synced = await syncGoogleBooking(booking(null, async (id) => {
      attached.push(id);
    }), { http, config, refreshToken: "refresh-1" });
    assert.equal(synced, true);
    assert.equal(posts(calls).length, 1);
    assert.equal(JSON.parse(posts(calls)[0]?.body ?? "{}").id, eventId);
    assert.deepEqual(attached, [eventId]);
  });

  it("updates an already attached event and does not create another", async () => {
    const { http, calls } = recorder(
      tokenThen((url, method) => {
        if (method === "PATCH" && url.endsWith(`/${eventId}`)) return { ok: true, status: 200, json: { id: eventId } };
        throw new Error(`unexpected Google call ${method} ${url}`);
      }),
    );
    const attached: string[] = [];
    const synced = await syncGoogleBooking(booking(eventId, async (id) => {
      attached.push(id);
    }), { http, config, refreshToken: "refresh-1" });
    assert.equal(synced, true);
    assert.equal(posts(calls).length, 0);
    assert.equal(calls.filter((call) => call.method === "PATCH").length, 1);
    assert.deepEqual(attached, []);
  });

  it("does not create a second event when a retry hits the same id", async () => {
    const { http, calls } = recorder(
      tokenThen((url, method) => {
        if (url === eventsUrl && method === "POST") return { ok: false, status: 409, json: {} };
        if (method === "PATCH" && url.endsWith(`/${eventId}`)) return { ok: true, status: 200, json: { id: eventId } };
        throw new Error(`unexpected Google call ${method} ${url}`);
      }),
    );
    const attached: string[] = [];
    const synced = await syncGoogleBooking(booking(null, async (id) => {
      attached.push(id);
    }), { http, config, refreshToken: "refresh-1" });
    assert.equal(synced, true);
    assert.equal(posts(calls).length, 1);
    assert.equal(JSON.parse(posts(calls)[0]?.body ?? "{}").id, eventId);
    assert.deepEqual(attached, [eventId]);

    const again = recorder(
      tokenThen((url, method) => {
        if (method === "PATCH" && url.endsWith(`/${eventId}`)) return { ok: true, status: 200, json: {} };
        throw new Error(`unexpected Google call ${method} ${url}`);
      }),
    );
    const second = await syncGoogleBooking(booking(eventId, async () => {
      throw new Error("attach should not run");
    }), { http: again.http, config, refreshToken: "refresh-1" });
    assert.equal(second, true);
    assert.equal(posts(again.calls).length, 0);
  });

  it("does not post when the attached event is already gone", async () => {
    const { http, calls } = recorder(
      tokenThen((url, method) => {
        if (method === "PATCH") return { ok: false, status: 404, json: {} };
        throw new Error(`unexpected Google call ${method} ${url}`);
      }),
    );
    const synced = await syncGoogleBooking(booking(eventId, async () => {
      throw new Error("attach should not run");
    }), { http, config, refreshToken: "refresh-1" });
    assert.equal(synced, false);
    assert.equal(posts(calls).length, 0);
  });

  it("deletes the event on cancel", async () => {
    const { http, calls } = recorder(
      tokenThen((url, method) => {
        if (method === "DELETE" && url.endsWith(`/${eventId}`)) return { ok: true, status: 204, json: {} };
        throw new Error(`unexpected Google call ${method} ${url}`);
      }),
    );
    const removed = await deleteGoogleBooking("trainer-1", eventId, { http, config, refreshToken: "refresh-1" });
    assert.equal(removed, true);
    assert.equal(calls.filter((call) => call.method === "DELETE").length, 1);
  });

  it("counts a cancel 404 as success", async () => {
    const { http } = recorder(
      tokenThen((url, method) => {
        if (method === "DELETE") return { ok: false, status: 404, json: {} };
        throw new Error(`unexpected Google call ${method} ${url}`);
      }),
    );
    const removed = await deleteGoogleBooking("trainer-1", eventId, { http, config, refreshToken: "refresh-1" });
    assert.equal(removed, true);
  });

  it("counts a cancel 410 as success", async () => {
    const { http } = recorder(
      tokenThen(() => ({ ok: false, status: 410, json: {} })),
    );
    const removed = await deleteGoogleBooking("trainer-1", eventId, { http, config, refreshToken: "refresh-1" });
    assert.equal(removed, true);
  });

  it("makes no Google calls when the calendar is not connected", async () => {
    const { http, calls } = recorder(() => {
      throw new Error("Google should not be called");
    });
    const runtime = { http, config, refreshToken: null };
    const synced = await syncGoogleBooking(booking(null, async () => {
      throw new Error("attach should not run");
    }), runtime);
    const removed = await deleteGoogleBooking("trainer-1", eventId, runtime);
    assert.equal(synced, false);
    assert.equal(removed, false);
    assert.equal(calls.length, 0);
  });

  it("makes no Google calls when the env vars are unset", async () => {
    const previousId = process.env.GOOGLE_CLIENT_ID;
    const previousSecret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    try {
      assert.equal(readGoogleConfig(), null);
      const { http, calls } = recorder(() => {
        throw new Error("Google should not be called");
      });
      const synced = await syncGoogleBooking(booking(null, async () => {
        throw new Error("attach should not run");
      }), { http });
      const removed = await deleteGoogleBooking("trainer-1", eventId, { http });
      const exchanged = await exchangeGoogleCode(
        { code: "auth-code", redirectUri: "http://localhost:3000/api/google/oauth/callback" },
        { http },
      );
      assert.equal(synced, false);
      assert.equal(removed, false);
      assert.equal(exchanged, null);
      assert.equal(calls.length, 0);
    } finally {
      if (previousId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previousId;
      if (previousSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previousSecret;
    }
  });

  it("revokes the refresh token and then deletes stored credentials", async () => {
    const order: string[] = [];
    await disconnectGoogleAccount({
      refreshToken: "refresh-1",
      http: async (url, init) => {
        order.push("revoke");
        assert.equal(url, "https://oauth2.googleapis.com/revoke");
        assert.equal(init?.method, "POST");
        const raw = init?.body;
        const body = raw instanceof URLSearchParams ? raw.toString() : String(raw ?? "");
        assert.match(body, /(^|&)token=refresh-1(&|$)/);
        return { ok: true, status: 200, json: async () => ({}) };
      },
      deleteCredentials: async () => {
        order.push("delete");
      },
    });
    assert.deepEqual(order, ["revoke", "delete"]);
  });

  it("still deletes credentials when revoke fails", async () => {
    let deleted = false;
    await disconnectGoogleAccount({
      refreshToken: "refresh-1",
      http: async () => {
        throw new Error("revoke failed");
      },
      deleteCredentials: async () => {
        deleted = true;
      },
    });
    assert.equal(deleted, true);
  });
});
