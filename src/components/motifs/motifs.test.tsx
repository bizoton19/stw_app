import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CardWash, MOTIF_NAMES, Motif, type MotifName } from "./index";

function render(name: MotifName, props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(<Motif name={name} {...props} />);
}

test("every motif renders stroke-only and inherits its colour", () => {
  for (const name of MOTIF_NAMES) {
    const html = render(name);
    assert.match(html, /stroke="currentColor"/, `${name} does not inherit colour`);
    assert.match(html, /fill="none"/, `${name} is not stroke-only`);
    // A hard-coded colour would break every theme but the one it was picked for.
    assert.doesNotMatch(html, /#[0-9a-f]{3,8}/i, `${name} hard-codes a colour`);
    assert.doesNotMatch(html, /fill="(?!none)/, `${name} fills a shape`);
  }
});

test("motifs are decorative by default and labelled only when asked", () => {
  assert.match(render("stem"), /aria-hidden="true"/);
  assert.doesNotMatch(render("stem"), /role="img"/);

  const titled = render("stem", { title: "Drink" });
  assert.match(titled, /role="img"/);
  assert.match(titled, /aria-label="Drink"/);
  assert.doesNotMatch(titled, /aria-hidden/);
});

test("size drives both axes, so no motif renders stretched", () => {
  // `perforation` taught this: a stretched tear line deforms into arrowheads.
  assert.match(render("stem", { size: 24 }), /width="24"[\s\S]*height="24"/);
  // The watermark is square too, despite its 160-unit viewBox.
  assert.match(render("split-wash", { size: 40 }), /width="40"[\s\S]*height="40"/);
});

test("the watermark carries the masked utility class, never inline opacity", () => {
  const html = renderToStaticMarkup(<CardWash />);
  assert.match(html, /stw-wash/);
  assert.match(html, /viewBox="0 0 160 160"/);
  assert.doesNotMatch(html, /opacity:/, "opacity belongs to .stw-wash, not the element");
});

test("every motif source in plans/ is either shipped or deliberately left out", () => {
  const dir = new URL("../../../plans/motifs/", import.meta.url);
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.replace(/\.svg$/, ""));
  // `perforation` ships as the `.stw-perf` CSS rule and `paper-grain` as `.stw-grain`:
  // both are backgrounds, not inline icons, so they are not `<Motif>` entries.
  const asCss = ["perforation", "paper-grain"];
  const shipped = new Set<string>(MOTIF_NAMES);
  for (const name of sources) {
    assert.ok(
      shipped.has(name) || asCss.includes(name),
      `plans/motifs/${name}.svg is neither a <Motif> nor a documented CSS motif`,
    );
  }
  for (const name of asCss) {
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    const util = name === "perforation" ? ".stw-perf" : ".stw-grain";
    assert.ok(css.includes(util), `${util} is missing from globals.css`);
  }
});

test("path geometry matches the reviewed SVG sources", () => {
  // The review sheet is what got signed off, so the ported paths must not drift.
  for (const name of MOTIF_NAMES) {
    const source = readFileSync(
      new URL(`../../../plans/motifs/${name}.svg`, import.meta.url),
      "utf8",
    );
    const sourcePaths = [...source.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
    const rendered = render(name);
    for (const d of sourcePaths) {
      assert.ok(rendered.includes(d), `${name} dropped or altered a path from its source`);
    }
  }
});
