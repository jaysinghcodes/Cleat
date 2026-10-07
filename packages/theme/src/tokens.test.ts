import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cycleThemePreference,
  dark,
  light,
  themeStylesheet,
  themes,
} from "./index";

function keys(value: object): string[] {
  return Object.keys(value).sort();
}

test("both themes export the same keys", () => {
  assert.deepEqual(keys(dark), keys(light));
  assert.deepEqual(keys(themes.dark), keys(themes.light));
});

test("onAccent is charcoal on both themes", () => {
  assert.equal(dark.onAccent, "#1C1917");
  assert.equal(light.onAccent, "#1C1917");
});

test("light accentText is the darker apricot", () => {
  assert.equal(light.accentText, "#9A5B2F");
  assert.equal(light.accent, "#E8A87C");
  assert.notEqual(light.accentText, light.accent);
});

test("theme preference cycles System, Dark, Light", () => {
  assert.equal(cycleThemePreference("system"), "dark");
  assert.equal(cycleThemePreference("dark"), "light");
  assert.equal(cycleThemePreference("light"), "system");
});

test("stylesheet follows the OS and lets data-theme override it", () => {
  assert.match(themeStylesheet, /prefers-color-scheme: light/);
  assert.match(themeStylesheet, /prefers-color-scheme: dark/);
  assert.match(themeStylesheet, /data-theme="light"/);
  assert.match(themeStylesheet, /--accent-text: #9A5B2F/);
  assert.match(themeStylesheet, /--on-accent: #1C1917/);
  assert.match(themeStylesheet, /--cta-text: #1C1917/);
});
