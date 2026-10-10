/**
 * Generate web + mobile card theme modules (and patch globals.css) from
 * design-tokens/card-theme.json. Run: npm run theme:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokenPath = join(root, "design-tokens/card-theme.json");

type ThemeMap = Record<string, string>;
type TokenFile = {
  themes: { linen: ThemeMap; candlelight: ThemeMap };
  cssVars: Record<string, string>;
};

const data = JSON.parse(readFileSync(tokenPath, "utf8")) as TokenFile;
const keys = Object.keys(data.themes.linen);
for (const id of ["linen", "candlelight"] as const) {
  const missing = keys.filter((k) => data.themes[id][k] === undefined);
  if (missing.length) throw new Error(`${id} missing keys: ${missing.join(", ")}`);
}

function formatThemeObject(theme: ThemeMap, indent: string): string {
  return keys.map((k) => `${indent}${k}: ${JSON.stringify(theme[k])},`).join("\n");
}

function stwDecls(theme: ThemeMap): string {
  return keys.map((k) => `  ${data.cssVars[k]}: ${theme[k]};`).join("\n");
}

function webModule(): string {
  const typeFields = keys.map((k) => `  ${k}: string;`).join("\n");
  const varEntries = keys
    .map((k) => `  ${k}: ${JSON.stringify(data.cssVars[k])},`)
    .join("\n");
  return `/**
 * Card theme tokens — GENERATED from design-tokens/card-theme.json.
 * Do not edit by hand. Run: npm run theme:generate
 *
 * See plans/card-design-themes.md §3 and marketing/theme.md.
 */

export const CARD_THEME_IDS = ["linen", "candlelight"] as const;

export type CardThemeId = (typeof CARD_THEME_IDS)[number];

/** Approved fallback whenever resolution is uncertain: bad clock, unknown id, no JS. */
export const DEFAULT_CARD_THEME: CardThemeId = "linen";

export type CardTheme = {
${typeFields}
};

export const cardThemes: Record<CardThemeId, CardTheme> = {
  linen: {
${formatThemeObject(data.themes.linen, "    ")}
  },
  candlelight: {
${formatThemeObject(data.themes.candlelight, "    ")}
  },
};

/** Custom-property name per token — the contract \`globals.css\` is tested against. */
export const CARD_THEME_VARS: Record<keyof CardTheme, string> = {
${varEntries}
};

export function isCardThemeId(value: unknown): value is CardThemeId {
  return typeof value === "string" && (CARD_THEME_IDS as readonly string[]).includes(value);
}

/** Unknown ids resolve to the approved default rather than throwing. */
export function resolveCardThemeTokens(id: unknown): CardTheme {
  return cardThemes[isCardThemeId(id) ? id : DEFAULT_CARD_THEME];
}
`;
}

function nativeModule(): string {
  const typeFields = keys.map((k) => `  ${k}: string;`).join("\n");
  return `/**
 * Card theme tokens for native — GENERATED from design-tokens/card-theme.json.
 * Do not edit by hand. Run: npm run theme:generate
 *
 * Copy of web tokens (Metro root is apps/mobile). Parity enforced by dusk.test.ts.
 */

export const CARD_THEME_IDS = ["linen", "candlelight"] as const;

export type CardThemeId = (typeof CARD_THEME_IDS)[number];

export const DEFAULT_CARD_THEME: CardThemeId = "linen";

export type CardTheme = {
${typeFields}
};

export const cardThemes: Record<CardThemeId, CardTheme> = {
  linen: {
${formatThemeObject(data.themes.linen, "    ")}
  },
  candlelight: {
${formatThemeObject(data.themes.candlelight, "    ")}
  },
};

export function isCardThemeId(value: unknown): value is CardThemeId {
  return typeof value === "string" && (CARD_THEME_IDS as readonly string[]).includes(value);
}

/** Unknown ids resolve to the approved default rather than throwing. */
export function resolveCardThemeTokens(id: unknown): CardTheme {
  return cardThemes[isCardThemeId(id) ? id : DEFAULT_CARD_THEME];
}
`;
}

function patchGlobalsCss() {
  const cssPath = join(root, "src/app/globals.css");
  let css = readFileSync(cssPath, "utf8");

  const linenCluster =
    /\/\* Card theme: linen[\s\S]*?\*\/\n(?:  --stw-[^;]+;\n)+/;
  if (!linenCluster.test(css)) {
    throw new Error("globals.css: linen --stw-* cluster not found");
  }
  css = css.replace(
    linenCluster,
    `/* Card theme: linen (default). Values match design-tokens/card-theme.json.
     apply with no \`data-card-theme\` set so the page is correct before the dusk
     script runs — and if it never runs. See plans/card-design-themes.md §3. */
${stwDecls(data.themes.linen)}\n`,
  );

  const candleCluster =
    /(\[data-card-theme="candlelight"\] \{\n)(?:  --stw-[^;]+;\n)+/;
  if (!candleCluster.test(css)) {
    throw new Error("globals.css: candlelight --stw-* cluster not found");
  }
  css = css.replace(
    candleCluster,
    `$1${stwDecls(data.themes.candlelight)}\n`,
  );

  writeFileSync(cssPath, css);
}

writeFileSync(join(root, "src/lib/card-theme/themes.ts"), webModule());
writeFileSync(join(root, "apps/mobile/src/lib/card-theme/themes.ts"), nativeModule());
patchGlobalsCss();
console.log("Generated card themes from design-tokens/card-theme.json");
