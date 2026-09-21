import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "stw-api-url";
const API_PORT = process.env.EXPO_PUBLIC_API_PORT?.trim() || "43147";

let override: string | null = null;

function stripSlash(url: string) {
  return url.replace(/\/$/, "");
}

function hostFromExpo(): string | null {
  const fromConfig = Constants.expoConfig?.hostUri;
  const fromExp = Constants.experienceUrl;
  const raw = fromConfig || fromExp || "";
  if (!raw) return null;
  const host = raw
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split("/")[0]
    .split(":")[0];
  if (!host) return null;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".exp.direct")) {
    return null;
  }
  return host;
}

/** Default API origin. Never use the OpenRouter key here. */
export function inferredApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (env) return stripSlash(env);

  const lan = hostFromExpo();
  if (lan) return `http://${lan}:${API_PORT}`;

  if (Platform.OS === "android") return `http://10.0.2.2:${API_PORT}`;
  return `http://127.0.0.1:${API_PORT}`;
}

export function getApiUrl(): string {
  return stripSlash(override || inferredApiUrl());
}

export function getApiUrlOverride(): string | null {
  return override;
}

export async function hydrateApiUrl() {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  override = stored?.trim() ? stripSlash(stored.trim()) : null;
}

export async function setApiUrlOverride(url: string) {
  const next = url.trim();
  if (!next) {
    override = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  override = stripSlash(next);
  await AsyncStorage.setItem(STORAGE_KEY, override);
}

export function publicClaimUrl(receiptId: string): string {
  const share = process.env.EXPO_PUBLIC_SHARE_URL?.trim();
  const base = stripSlash(share || getApiUrl());
  return `${base}/r/${receiptId}`;
}

export function apiUrlHint(): string {
  const lan = hostFromExpo();
  if (lan) return `Inferred from Expo (${lan})`;
  if (process.env.EXPO_PUBLIC_API_URL?.trim()) return "From EXPO_PUBLIC_API_URL";
  if (Platform.OS === "android") return "Android emulator default";
  return "This computer only (localhost)";
}
