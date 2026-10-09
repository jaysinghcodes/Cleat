import assert from "node:assert/strict";
import { test } from "node:test";
import type { CleatClient } from "@cleat/api";
import { requireTrainer } from "./server/actor";

test("an invalid trainer token is unauthorized", async () => {
  let membershipCalls = 0;
  const result = await requireTrainer(
    new Request("http://localhost/api/ai/drafts", { headers: { authorization: "Bearer not-a-jwt" } }),
    {
      readConfig: () => ({ url: "http://example.test", anonKey: "anon" }),
      createClient: () =>
        ({
          auth: {
            getUser: async () => ({ data: { user: null }, error: { message: "invalid JWT" } }),
          },
        }) as unknown as CleatClient,
      fetchMembership: async () => {
        membershipCalls += 1;
        throw new Error("jwt malformed");
      },
    },
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 401);
  assert.equal(membershipCalls, 0);
});
