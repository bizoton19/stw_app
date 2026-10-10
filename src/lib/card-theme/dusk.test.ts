import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cardThemeBootScript } from "./boot-script";
import { cardThemeOverride, duskTheme, resolveCardTheme } from "./dusk";
import {
  CARD_THEME_IDS,
  CARD_THEME_VARS,
  cardThemes,
  resolveCardThemeTokens,
  type CardTheme,
} from "./themes";

/** Local wall-clock time — `duskTheme` reads `getHours()`, which is timezone-dependent. */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 9, 2, hour, minute, 0, 0);
}

test("dusk boundary: 18:59 is still day, 19:00 is dusk", () => {
  assert.equal(duskTheme(at(18, 59)), "linen");
  assert.equal(duskTheme(at(19, 0)), "candlelight");
});

test("dawn boundary: 05:59 is still dusk, 06:00 is day", () => {
  assert.equal(duskTheme(at(5, 59)), "candlelight");
  assert.equal(duskTheme(at(6, 0)), "linen");
});

test("a 18:30 dinner does not open already dimmed", () => {
  assert.equal(duskTheme(at(18, 30)), "linen");
});

test("midnight and noon sit on the expected sides", () => {
  assert.equal(duskTheme(at(0, 0)), "candlelight");
  assert.equal(duskTheme(at(12, 0)), "linen");
  assert.equal(duskTheme(at(23, 59)), "candlelight");
});

test("a nonsense clock falls back to the approved default", () => {
  assert.equal(duskTheme(new Date(Number.NaN)), "linen");
});

test("the QA override wins over the clock; junk values are ignored", () => {
  assert.equal(cardThemeOverride("?cardTheme=candlelight"), "candlelight");
  assert.equal(cardThemeOverride("cardTheme=linen"), "linen");
  assert.equal(cardThemeOverride("?cardTheme=patio"), null);
  assert.equal(cardThemeOverride(""), null);
  assert.equal(resolveCardTheme(at(12, 0), "?cardTheme=candlelight"), "candlelight");
  assert.equal(resolveCardTheme(at(21, 0), "?cardTheme=linen"), "linen");
  // `cellar` is deferred, not shippable — it must not resolve.
  assert.equal(resolveCardTheme(at(21, 0), "?cardTheme=cellar"), "candlelight");
});

test("unknown theme ids resolve to linen instead of throwing", () => {
  assert.deepEqual(resolveCardThemeTokens("cellar"), cardThemes.linen);
  assert.deepEqual(resolveCardThemeTokens(undefined), cardThemes.linen);
});

test("every theme defines every token, and linen holds the shipped palette", () => {
  const tokens = Object.keys(cardThemes.linen).sort();
  for (const id of CARD_THEME_IDS) {
    assert.deepEqual(Object.keys(cardThemes[id]).sort(), tokens, `${id} is missing tokens`);
  }
  // Load-bearing per plan §6: while these hold, the theme work stays one-line reversible.
  assert.equal(cardThemes.linen.paper, "#f6f4f1");
  assert.equal(cardThemes.linen.sheet, "#fffcf8");
  assert.equal(cardThemes.linen.ink, "#2a241c");
  assert.equal(cardThemes.linen.merlot, "#6e2e35");
  assert.equal(cardThemes.linen.chrome, "#ede8e1");
  assert.equal(cardThemes.linen.chromeBorder, "#d4cdc3");
  // v2 contrast: secondary/tertiary shared so candlelight doesn't drop AA.
  assert.equal(cardThemes.linen.inkSoft, "#6e6253");
  assert.equal(cardThemes.linen.muted, "#71675d");
  assert.equal(cardThemes.linen.merlotPressed, "#5a252c");
  assert.equal(cardThemes.candlelight.inkSoft, cardThemes.linen.inkSoft);
  assert.equal(cardThemes.candlelight.muted, cardThemes.linen.muted);
  assert.ok(cardThemes.linen.focusRing);
  assert.ok(cardThemes.linen.disabledSurface);
  // "Claimed" and "destructive" must mean the same thing at every hour.
  assert.equal(cardThemes.candlelight.select, cardThemes.linen.select);
  assert.equal(cardThemes.candlelight.danger, cardThemes.linen.danger);
});

/** Relative luminance + contrast ratio (sRGB hex, WCAG). */
function contrastRatio(fgHex: string, bgHex: string): number {
  const lum = (hex: string) => {
    const n = hex.replace("#", "");
    const rgb = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const a = lum(fgHex);
  const b = lum(bgHex);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

test("linen and candlelight text roles meet AA contrast on their paper", () => {
  for (const id of CARD_THEME_IDS) {
    const t = cardThemes[id];
    assert.ok(contrastRatio(t.ink, t.paper) >= 4.5, `${id} ink on paper`);
    assert.ok(contrastRatio(t.inkSoft, t.paper) >= 4.5, `${id} inkSoft on paper`);
    assert.ok(contrastRatio(t.muted, t.paper) >= 4.5, `${id} muted on paper`);
    assert.ok(contrastRatio(t.merlotFg, t.merlot) >= 4.5, `${id} merlotFg on merlot`);
    assert.ok(contrastRatio(t.select, t.paper) >= 3, `${id} select on paper`);
    assert.ok(contrastRatio(t.danger, t.paper) >= 4.5, `${id} danger on paper`);
  }
});

test("globals.css declares the same token values as themes.ts", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const blocks: Record<string, RegExp> = {
    linen: /:root\s*\{([\s\S]*?)\n\}/,
    candlelight: /\[data-card-theme="candlelight"\]\s*\{([\s\S]*?)\n\}/,
  };
  for (const id of CARD_THEME_IDS) {
    const block = css.match(blocks[id])?.[1];
    assert.ok(block, `globals.css has no ${id} block`);
    for (const token of Object.keys(CARD_THEME_VARS) as (keyof CardTheme)[]) {
      const name = CARD_THEME_VARS[token];
      const declared = block.match(new RegExp(`${name}:\\s*([^;]+);`));
      if (!declared) {
        // Not re-declared is legal only when the theme inherits linen's value.
        assert.equal(
          cardThemes[id][token],
          cardThemes.linen[token],
          `globals.css ${id} omits ${name} but themes.ts gives it a distinct value`,
        );
        continue;
      }
      assert.equal(
        declared[1].trim(),
        cardThemes[id][token],
        `globals.css ${id} declares ${name} out of sync with themes.ts`,
      );
    }
  }
});

test("native card-theme tokens have not drifted from web", () => {
  // apps/mobile keeps its own copy because Metro's project root is apps/mobile.
  // This is the guard that keeps the copy honest.
  const src = readFileSync(
    new URL("../../../apps/mobile/src/lib/card-theme/themes.ts", import.meta.url),
    "utf8",
  );
  for (const id of CARD_THEME_IDS) {
    const block = src.match(new RegExp(`${id}: \\{([\\s\\S]*?)\\n  \\}`))?.[1];
    assert.ok(block, `native themes.ts has no ${id} map`);
    for (const [token, value] of Object.entries(cardThemes[id])) {
      const declared = block.match(new RegExp(`\\b${token}: "([^"]*)"`));
      assert.ok(declared, `native themes.ts ${id} is missing ${token}`);
      assert.equal(
        declared[1],
        value,
        `native themes.ts ${id}.${token} drifted from web`,
      );
    }
  }
});

test("the boot script sets the theme before paint, with the tested boundaries", () => {
  // No React, no hydration mismatch — the script owns the attribute outright.
  assert.match(cardThemeBootScript, /dataset\.cardTheme/);
  assert.match(cardThemeBootScript, /getHours/);
  assert.ok(cardThemeBootScript.includes(">=19"), "dusk hour is not interpolated");
  assert.ok(cardThemeBootScript.includes("<6"), "dawn hour is not interpolated");
  assert.ok(cardThemeBootScript.includes("cardTheme"), "QA override is missing");
  // Must be a single self-invoking statement safe to inline in <head>.
  assert.match(cardThemeBootScript, /^\(function\(\)\{[\s\S]*\}\)\(\);$/);
});
