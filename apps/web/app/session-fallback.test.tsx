import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { copy, screenCopy } from "@cleat/domain";
import { SessionLoadFallback } from "./session-fallback";
import { ThemeProvider } from "./theme";

test("session load failure renders Try again, not Checking your session", () => {
  const html = renderToStaticMarkup(
    createElement(ThemeProvider, null, createElement(SessionLoadFallback, { body: screenCopy.loadFailed, onRetry: () => undefined })),
  );
  assert.equal(html.includes(screenCopy.couldNotLoad), true);
  assert.equal(html.includes(screenCopy.retry), true);
  assert.equal(html.includes(copy.checkingSession), false);
  assert.equal(html.includes("permission denied"), false);
});
