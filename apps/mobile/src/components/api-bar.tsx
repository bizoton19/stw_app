import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { pingApi } from "@/lib/api";
import {
  apiUrlHint,
  getApiUrl,
  getApiUrlOverride,
  hydrateApiUrl,
  inferredApiUrl,
  setApiUrlOverride,
} from "@/lib/config";
import { colors } from "@/lib/theme";
import { PressScale } from "./press-scale";

export function ApiBar() {
  const [url, setUrl] = useState(getApiUrl());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(getApiUrl());
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateApiUrl();
      if (cancelled) return;
      setUrl(getApiUrl());
      setDraft(getApiUrl());
      const ok = await pingApi();
      if (!cancelled) setReachable(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    await setApiUrlOverride(draft);
    setUrl(getApiUrl());
    setEditing(false);
    setReachable(null);
    void pingApi().then(setReachable);
  }

  async function reset() {
    await setApiUrlOverride("");
    const next = inferredApiUrl();
    setDraft(next);
    setUrl(next);
    setEditing(false);
    setReachable(null);
    void pingApi().then(setReachable);
  }

  const status =
    reachable === null ? "Checking server…" : reachable ? "Server reachable" : "Can't reach server";

  if (editing) {
    return (
      <View style={styles.box}>
        <Text style={styles.label}>API server (this phone must reach it)</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.12:43147"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.hint}>
          Localhost will not work on a physical phone. Use your Mac&apos;s LAN IP. Override stored
          on this device
          {getApiUrlOverride() ? " (custom)" : ""}.
        </Text>
        <View style={styles.row}>
          <PressScale onPress={() => void save()} style={styles.save}>
            <Text style={styles.saveText}>Save</Text>
          </PressScale>
          <PressScale onPress={() => void reset()} style={styles.reset}>
            <Text style={styles.resetText}>Use inferred</Text>
          </PressScale>
        </View>
      </View>
    );
  }

  return (
    <PressScale haptic={false} onPress={() => setEditing(true)} style={styles.box}>
      <Text style={styles.label}>{status}</Text>
      <Text style={styles.url}>{url}</Text>
      <Text style={styles.hint}>
        {apiUrlHint()}. Tap to change — required on a real phone if this is localhost.
      </Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  label: { fontSize: 12, fontWeight: "600", color: colors.inkSoft },
  url: { marginTop: 4, fontSize: 12, color: colors.ink, fontFamily: "monospace" },
  hint: { marginTop: 6, fontSize: 11, lineHeight: 16, color: colors.muted },
  input: {
    marginTop: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.ink,
  },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  save: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.merlot,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: colors.merlotFg, fontSize: 13, fontWeight: "700" },
  reset: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
});
