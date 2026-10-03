/**
 * Dynamic Expo config. `app.json` stays the source of truth for the base app;
 * `APP_VARIANT=dev` (set by EAS profile `dev`) renames the home-screen label so
 * a staging build is obvious next to production.
 *
 * Bundle id stays `com.splitthewine.app` so we reuse existing Apple credentials.
 * Dev builds use EAS `distribution: "internal"` (not TestFlight) so prod TF stays clean.
 */
const appJson = require("./app.json");

const variant = process.env.APP_VARIANT?.trim() || "";
const isDev = variant === "dev";

/** @type {import('expo/config').ExpoConfig} */
const expo = {
  ...appJson.expo,
  name: isDev ? "Split the Wine Dev" : appJson.expo.name,
  scheme: isDev ? "splitthewinedev" : appJson.expo.scheme,
};

module.exports = { expo };
