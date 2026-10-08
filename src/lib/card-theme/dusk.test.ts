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
  assert.equal(cardThemes.linen.ink, "#2a241c");
  assert.equal(cardThemes.linen.merlot, "#6e2e35");
  assert.equal(cardThemes.linen.chrome, "#ede8e1");
  assert.equal(cardThemes.linen.chromeBorder, "#d4cdc3");
  assert.equal(cardThemes.linen.inkFirm, "#5a5248");
  assert.equal(cardThemes.linen.photoScrim, "#241c14");
  assert.equal(cardThemes.candlelight.inkFirm, "#56483b");
  assert.equal(cardThemes.candlelight.photoScrim, cardThemes.linen.photoScrim);
  // "Claimed" and "destructive" must mean the same thing at every hour.
  assert.equal(cardThemes.candlelight.select, cardThemes.linen.select);
  assert.equal(cardThemes.candlelight.danger, cardThemes.linen.danger);
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
