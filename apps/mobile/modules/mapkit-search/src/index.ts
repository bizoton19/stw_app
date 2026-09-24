import { NativeModule, requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type MapkitSuggestion = {
  placeId: string;
  name: string;
  secondary: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  category: string | null;
};

type MapkitSearchModule = NativeModule & {
  suggest(query: string, lat: number | null, lng: number | null): Promise<MapkitSuggestion[]>;
};

let native: MapkitSearchModule | null = null;

function getNative(): MapkitSearchModule | null {
  if (Platform.OS !== "ios") return null;
  if (native) return native;
  try {
    native = requireNativeModule<MapkitSearchModule>("MapkitSearch");
    return native;
  } catch {
    return null;
  }
}

/** True in a native iOS build that includes this module (not Expo Go). */
export function isMapkitSearchAvailable(): boolean {
  return getNative() != null;
}

export async function mapkitSuggest(
  query: string,
  coords?: { lat: number; lng: number } | null,
): Promise<MapkitSuggestion[]> {
  const mod = getNative();
  if (!mod) return [];
  return mod.suggest(query, coords?.lat ?? null, coords?.lng ?? null);
}
