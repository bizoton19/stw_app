import assert from "node:assert/strict";
import { test } from "node:test";
import { controlShowsSpinner } from "../../apps/mobile/src/lib/pending-control";
import { pressAccessibilityState } from "../../apps/mobile/src/lib/press-accessibility";
import {
  CAPTION_FONT_SCALE_MAX,
  PLACE_CAPTION_MIN_HEIGHT,
  PLACE_CARD_HEIGHT,
  STEM_MOTIF_SIZE,
  stemClearsCaption,
} from "../../apps/mobile/src/lib/place-card-caption";
import { stepperLimitPaint } from "../../apps/mobile/src/lib/stepper-limit";

test("a busy pressable keeps disabled and busy in accessibility state", () => {
  assert.deepEqual(pressAccessibilityState(undefined, true, true), {
    disabled: true,
    busy: true,
  });
  assert.deepEqual(pressAccessibilityState({ checked: true }, false, false), {
    checked: true,
    disabled: false,
    busy: false,
  });
  assert.equal(pressAccessibilityState({ busy: true }, true, false).busy, true);
});

test("only the tapped control shows a spinner", () => {
  for (const id of ["going", "maybe", "cant"]) {
    assert.equal(controlShowsSpinner("maybe", id), id === "maybe");
  }
  assert.equal(controlShowsSpinner(null, "going"), false);
  assert.equal(controlShowsSpinner("yes", "yes"), true);
  assert.equal(controlShowsSpinner("yes", "no"), false);
  assert.equal(controlShowsSpinner("claim-a", "claim-a"), true);
  assert.equal(controlShowsSpinner("claim-a", "claim-b"), false);
  assert.equal(controlShowsSpinner("reopen", "delete"), false);
  assert.equal(controlShowsSpinner("delete", "delete"), true);
});

test("the stem hides once the caption band reaches it", () => {
  assert.equal(stemClearsCaption(PLACE_CAPTION_MIN_HEIGHT), true);
  const lastClear = PLACE_CARD_HEIGHT - STEM_MOTIF_SIZE;
  assert.equal(stemClearsCaption(lastClear), true);
  assert.equal(stemClearsCaption(lastClear + 1), false);
});

test("place caption type scale stays at 2 so the first name line is not cut", () => {
  assert.equal(CAPTION_FONT_SCALE_MAX, 2);
});

test("a stepper at its limit uses a hairline chromeBorder ring and an inkFirm glyph", () => {
  const atLimit = stepperLimitPaint(true);
  assert.equal(atLimit.outline, "chromeBorder");
  assert.equal(atLimit.glyph, "inkFirm");
  assert.equal(atLimit.hairline, true);
  const enabled = stepperLimitPaint(false);
  assert.equal(enabled.outline, "border");
  assert.equal(enabled.glyph, "ink");
  assert.equal(enabled.hairline, false);
});
