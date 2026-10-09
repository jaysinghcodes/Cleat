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
  assert.match(themeStylesheet, /--on-urgent: #1C1917/);
  assert.match(themeStylesheet, /--on-urgent: #FFFFFF/);
});

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const raw = hex.replace("#", "");
  const r = channel(parseInt(raw.slice(0, 2), 16));
  const g = channel(parseInt(raw.slice(2, 4), 16));
  const b = channel(parseInt(raw.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(left: string, right: string): number {
  const a = luminance(left);
  const b = luminance(right);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function blendOver(tint: string, background: string): string {
  const match = tint.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
  assert.ok(match);
  const alpha = Number(match[4]);
  const bg = background.replace("#", "");
  const parts = [0, 1, 2].map((index) => {
    const fg = Number(match[index + 1]);
    const base = parseInt(bg.slice(index * 2, index * 2 + 2), 16);
    return Math.round(fg * alpha + base * (1 - alpha));
  });
  return `#${parts.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

test("approved status inks stay at least 4.5:1 on their tint over page and card", () => {
  const cases = [
    {
      name: "dark error",
      ink: dark.error,
      tint: dark.errorTint,
      page: dark.page,
      card: dark.card,
    },
    {
      name: "light success",
      ink: light.success,
      tint: light.successTint,
      page: light.page,
      card: light.card,
    },
    {
      name: "light warn",
      ink: light.warn,
      tint: light.warnTint,
      page: light.page,
      card: light.card,
    },
    {
      name: "light skip",
      ink: light.skip,
      tint: light.skipTint,
      page: light.page,
      card: light.card,
    },
  ];
  for (const item of cases) {
    for (const surface of ["page", "card"] as const) {
      const ratio = contrast(item.ink, blendOver(item.tint, item[surface]));
      assert.ok(ratio >= 4.5, `${item.name} on ${surface} is ${ratio.toFixed(2)}`);
    }
  }
});

test("emergency solid fill and injury tint stay distinguishable in grayscale", () => {
  for (const theme of [dark, light]) {
    const injury = blendOver(theme.errorTint, theme.card);
    assert.ok(contrast(theme.error, injury) >= 3, theme.colorScheme);
    assert.ok(contrast(theme.onUrgent, theme.error) >= 4.5, theme.colorScheme);
    assert.ok(contrast(theme.text, injury) >= 4.5, theme.colorScheme);
    assert.ok(contrast(theme.textSecondary, injury) >= 4.5, theme.colorScheme);
    assert.notEqual(theme.error.toLowerCase(), injury.toLowerCase());
  }
});

test("accountability headers use textSecondary on raised and soft rows", () => {
  for (const theme of [dark, light]) {
    const onRaised = contrast(theme.textSecondary, theme.raised);
    const onSoft = contrast(theme.textSecondary, theme.bgSoft);
    assert.ok(onRaised >= 4.5, `${theme.colorScheme} textSecondary on raised is ${onRaised.toFixed(2)}`);
    assert.ok(onSoft >= 4.5, `${theme.colorScheme} textSecondary on bgSoft is ${onSoft.toFixed(2)}`);
  }
});

test("text and status inks pass AA on page and card", () => {
  for (const theme of [dark, light]) {
    for (const surface of [theme.page, theme.card]) {
      assert.ok(contrast(theme.text, surface) >= 4.5, `${theme.colorScheme} text`);
      assert.ok(contrast(theme.textSecondary, surface) >= 4.5, `${theme.colorScheme} secondary`);
      assert.ok(contrast(theme.textTertiary, surface) >= 4.5, `${theme.colorScheme} tertiary`);
      assert.ok(contrast(theme.accentText, surface) >= 4.5, `${theme.colorScheme} accent text`);
      for (const ink of [theme.success, theme.warn, theme.skip, theme.error]) {
        assert.ok(contrast(ink, surface) >= 4.5, `${theme.colorScheme} ink on surface`);
      }
    }
    assert.ok(contrast(theme.text, theme.raised) >= 4.5, `${theme.colorScheme} text on raised`);
    assert.ok(contrast(theme.textSecondary, theme.raised) >= 4.5, `${theme.colorScheme} secondary on raised`);
    assert.ok(contrast(theme.onAccent, theme.accent) >= 4.5, `${theme.colorScheme} on accent`);
    assert.ok(contrast(theme.accentText, blendOver(theme.accentSoft, theme.card)) >= 4.5, `${theme.colorScheme} accent on soft`);
  }
});
