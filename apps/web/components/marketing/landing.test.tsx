import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "../../app/theme";
import {
  GITHUB_URL,
  Landing,
  MARKETING_DISCLAIMER,
  MARKETING_H1,
  MARKETING_PILL,
  MARKETING_PROOF,
  MARKETING_SECTIONS,
  MARKETING_SUBLINE,
  clientInviteHref,
} from "./landing";

function decode(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function innerTexts(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...html.matchAll(re)].map((match) => decode(match[1] ?? ""));
}

function renderedText(html: string): string {
  const named = [...html.matchAll(/\b(?:alt|aria-label)="([^"]*)"/g)].map((match) => match[1] ?? "");
  return `${decode(html)} ${named.join(" ")}`.trim();
}

const html = renderToStaticMarkup(createElement(ThemeProvider, null, createElement(Landing)));

test("hero and section copy match the locked strings", () => {
  assert.deepEqual(innerTexts(html, "h1"), [MARKETING_H1]);
  assert.equal(innerTexts(html, "h1")[0], "Your coaching. Never a guess.");

  const paragraphs = innerTexts(html, "p");
  assert.equal(paragraphs[0], MARKETING_PILL);
  assert.equal(paragraphs[0], "For independent and online coaches");
  assert.equal(paragraphs[1], MARKETING_SUBLINE);
  assert.equal(
    paragraphs[1],
    "Cleat keeps clients logging on iOS and Android, shows you who skipped and who needs a nudge, and answers routine questions from your own programs only when it's sure. Everything else comes to you.",
  );
  assert.equal(paragraphs[2], MARKETING_PROOF);
  assert.equal(
    paragraphs[2],
    "iOS and Android client app · Trainer desk on the web · Audit trail on every AI reply",
  );

  assert.deepEqual(
    innerTexts(html, "h2"),
    MARKETING_SECTIONS.map((section) => section.title),
  );
  assert.deepEqual(innerTexts(html, "h2"), [
    "Every rep logged. Every skip seen.",
    "It answers when it's sure. You answer the rest.",
    "Booked on your calendar.",
  ]);
});

test("rendered page text has no dash punctuation", () => {
  const text = renderedText(html);
  assert.equal(text.includes("\u2014"), false);
  assert.equal(text.includes("\u2013"), false);
  assert.equal(text.includes(" - "), false);
  assert.equal(text.includes("CoachLoop"), false);
  assert.equal(text.includes("clipped"), false);
  assert.equal(text.includes("Pricing"), false);
  assert.equal(text.includes(MARKETING_DISCLAIMER), true);
});

test("calls to action use the ticket 1 routes", () => {
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
  assert.equal(hrefs.filter((href) => href === "/signup").length, 2);
  assert.equal(hrefs.includes("/login"), true);
  assert.equal(hrefs.includes(clientInviteHref()), true);
  assert.equal(clientInviteHref().endsWith("/invite"), true);
  assert.equal(hrefs.includes(GITHUB_URL), true);
  assert.equal(hrefs.some((href) => href.toLowerCase().includes("pricing")), false);
  assert.equal(hrefs.includes("#how"), true);
});
