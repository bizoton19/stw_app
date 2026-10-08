import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { hostedStatusTone } from "../../apps/mobile/src/lib/hosted-status";

test("a draft outing is not the Open chip", () => {
  assert.equal(hostedStatusTone("draft"), "draft");
  assert.equal(hostedStatusTone("planning"), "draft");
  assert.equal(hostedStatusTone("finalized"), "closed");
  assert.equal(hostedStatusTone("open"), "open");
  assert.equal(hostedStatusTone(undefined), "open");
  assert.equal(hostedStatusTone(null), "open");
});

test("disabled controls use tokens instead of an opacity dim", () => {
  const root = new URL("../..", import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, root), "utf8");
  const press = read("apps/mobile/src/components/press-scale.tsx");
  const chrome = read("apps/mobile/src/components/chrome.tsx");
  const items = read("apps/mobile/src/app/host/items.tsx");
  const cards = read("apps/mobile/src/components/nearby-place-cards.tsx");
  const home = read("apps/mobile/src/app/(tabs)/index.tsx");

  assert.doesNotMatch(press, /opacity:\s*0\.35/);
  assert.match(press, /disabled: Boolean\(disabled\)/);
  assert.match(chrome, /primaryDisabled: \{ backgroundColor: colors\.chromeBorder \}/);
  assert.match(chrome, /primaryTextDisabled: \{ color: colors\.inkFirm \}/);
  assert.match(chrome, /quietTextDisabled: \{ color: colors\.muted \}/);
  assert.match(chrome, /ActivityIndicator color=\{colors\.merlotFg\}/);
  assert.doesNotMatch(chrome, /#5a5248|#d4cdc3/);

  assert.doesNotMatch(items, /opacity:\s*0\.4/);
  assert.match(items, /halfBtnDisabled: \{[\s\S]*backgroundColor: colors\.chromeBorder/);
  assert.match(items, /continueDisabled: \{ backgroundColor: colors\.chromeBorder \}/);
  assert.match(items, /color: colors\.inkFirm/);

  assert.match(cards, /experimental_backgroundImage: CAPTION_SCRIM/);
  assert.match(cards, /0\.78/);
  assert.match(cards, /name="stem"/);
  assert.match(cards, /opacity=\{0\.8\}/);
  assert.match(cards, /metaPlain: \{ color: colors\.inkFirm \}/);
  assert.doesNotMatch(cards, /#5a5248|rgba\(36,\s*28,\s*20,\s*0\.55\)/);
  assert.doesNotMatch(cards, /flex:\s*1/);

  assert.match(home, /hostedStatusTone/);
  assert.match(home, /statusPillTextClosed: \{ color: colors\.inkFirm \}/);
  assert.match(home, /rowStatusClosed: \{ color: colors\.inkFirm \}/);
  assert.doesNotMatch(home, /#5a5248/);
});
