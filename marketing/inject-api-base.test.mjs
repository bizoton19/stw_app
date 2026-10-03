import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_API_BASE,
  injectApiBase,
  renderApiConfig,
  resolveApiBase,
} from "./inject-api-base.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "inject-api-base.mjs");

test("blank STW_API_BASE resolves to the production origin", () => {
  assert.equal(resolveApiBase(""), DEFAULT_API_BASE);
  assert.equal(resolveApiBase("   "), DEFAULT_API_BASE);
  assert.equal(resolveApiBase(undefined), DEFAULT_API_BASE);
});

test("accepts an origin and strips a trailing slash", () => {
  assert.equal(resolveApiBase("http://127.0.0.1:43147"), "http://127.0.0.1:43147");
  assert.equal(resolveApiBase("https://api.splitthewine.app/"), "https://api.splitthewine.app");
});

test("rejects paths, queries, credentials, and non-http schemes", () => {
  assert.throws(() => resolveApiBase("https://api.splitthewine.app/api"), /no path/);
  assert.throws(() => resolveApiBase("https://api.splitthewine.app?x=1"), /query/);
  assert.throws(() => resolveApiBase("https://user:secret@api.splitthewine.app"), /credentials/);
  assert.throws(() => resolveApiBase("javascript:alert(1)"), /http/);
  assert.throws(() => resolveApiBase("not a url"), /absolute URL/);
});

test("render writes a window.STW_API_BASE assignment", () => {
  const body = renderApiConfig("http://127.0.0.1:43147");
  assert.match(body, /window\.STW_API_BASE = "http:\/\/127\.0\.0\.1:43147";/);
  assert.doesNotMatch(body, /api\.splitthewine\.app/);
});

test("committed api-config.js is the production default", () => {
  const committed = readFileSync(join(here, "api-config.js"), "utf8");
  assert.equal(committed, renderApiConfig(DEFAULT_API_BASE));
});

test("landing HTML does not hardcode the production API origin", () => {
  const htmlFiles = readdirSync(here).filter((name) => name.endsWith(".html"));
  assert.ok(htmlFiles.includes("coming-soon.html"));
  for (const name of htmlFiles) {
    const text = readFileSync(join(here, name), "utf8");
    assert.equal(text.includes("api.splitthewine.app"), false, name);
  }
  const comingSoon = readFileSync(join(here, "coming-soon.html"), "utf8");
  assert.match(comingSoon, /src="\/api-config\.js"/);
  assert.match(comingSoon, /window\.STW_API_BASE/);
  assert.doesNotMatch(comingSoon, /const API_BASE = "https?:/);
});

test("CLI writes the env origin and exits 1 on a bad value", () => {
  const dir = mkdtempSync(join(tmpdir(), "stw-api-base-"));
  const out = join(dir, "api-config.js");
  const ok = spawnSync(process.execPath, [script, "--out", out], {
    env: { ...process.env, STW_API_BASE: "http://127.0.0.1:9999" },
    encoding: "utf8",
  });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(readFileSync(out, "utf8"), /http:\/\/127\.0\.0\.1:9999/);

  const bad = spawnSync(process.execPath, [script, "--out", out], {
    env: { ...process.env, STW_API_BASE: "https://evil.example/steal" },
    encoding: "utf8",
  });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /no path/);
});

test("injectApiBase uses the production default when STW_API_BASE is unset", () => {
  const dir = mkdtempSync(join(tmpdir(), "stw-api-base-"));
  const out = join(dir, "api-config.js");
  const env = { ...process.env };
  delete env.STW_API_BASE;
  const origin = injectApiBase({ env, outPath: out });
  assert.equal(origin, DEFAULT_API_BASE);
  assert.equal(readFileSync(out, "utf8"), renderApiConfig(DEFAULT_API_BASE));
});
