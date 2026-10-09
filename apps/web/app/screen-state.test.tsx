import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { themeStylesheet } from "@cleat/theme";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import { STATE_ROUTES, StateGallery } from "./state-gallery";

const html = renderToStaticMarkup(createElement(StateGallery));

test("state gallery hides raw errors and has a retry", () => {
  assert.equal(html.includes("JWT"), false);
  assert.equal(html.includes("PGRST"), false);
  assert.equal(html.includes("Try again"), true);
  assert.equal(html.includes("You are offline."), true);
  assert.equal(html.includes("\u2014"), false);
  assert.equal(html.includes("\u2013"), false);
  assert.equal(html.includes(" - "), false);
});

async function axeRoute(theme: "light" | "dark", route: string) {
  const globals = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
  const document = `<!doctype html><html lang="en" data-theme="${theme}"><head><title>Cleat ${route}</title><style>${themeStylesheet}\n${globals}</style></head><body>${html}</body></html>`;
  const dom = new JSDOM(document, { pretendToBeVisual: true, runScripts: "dangerously", url: "http://localhost/" });
  const script = dom.window.document.createElement("script");
  script.textContent = axe.source;
  dom.window.document.head.appendChild(script);
  const root = dom.window.document.querySelector(`[data-route="${route}"]`);
  assert.ok(root);
  const runner = (dom.window as unknown as { axe: typeof axe }).axe;
  const results = await runner.run(root, { resultTypes: ["violations"] });
  return results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
}

for (const route of STATE_ROUTES) {
  for (const theme of ["light", "dark"] as const) {
    test(`axe ${theme} ${route} has no serious issues`, async () => {
      const serious = await axeRoute(theme, route);
      const labels = Array.from(serious, (item) => `${item.id}: ${item.help}`);
      assert.deepEqual(labels, []);
    });
  }
}
