import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { centsToLabel } from "@/lib/money";
import {
  DEFAULT_GLASSES_PER_BOTTLE,
  MAX_GLASSES_PER_UNIT,
  MIN_GLASSES_PER_UNIT,
  pourAsGlasses,
  pourAsPrinted,
  pourCandidates,
} from "@/lib/pour";
import type { ItemPour } from "@/lib/types";
import { colors } from "@/lib/theme";

export default function HostPour() {
  const router = useRouter();
  const draft = useHostDraft();
  const candidates = useMemo(() => pourCandidates(draft.items), [draft.items]);

  const [pourGlasses, setPourGlasses] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const row of pourCandidates(draft.items)) {
      init[row.itemId] = row.suggestGlasses;
    }
    return init;
  });
  const [pourMode, setPourMode] = useState<Record<string, "glasses" | "as_printed">>(() => {
    const init: Record<string, "glasses" | "as_printed"> = {};
    for (const row of pourCandidates(draft.items)) {
      init[row.itemId] = "glasses";
    }
    return init;
  });

  const pourOk =
    candidates.length > 0 &&
    candidates.every(
      (row) => pourMode[row.itemId] === "glasses" || pourMode[row.itemId] === "as_printed",
    );

  function continueToFees() {
    draft.setItems((prev) => {
      const next = prev.map((item) => {
        const mode = pourMode[item.id];
        if (!mode) return item;
        const pour: ItemPour =
          mode === "glasses"
            ? pourAsGlasses(pourGlasses[item.id] ?? DEFAULT_GLASSES_PER_BOTTLE)
            : pourAsPrinted();
        return { ...item, pour };
      });
      return next;
    });
    router.push("/host/fees");
  }

  useEffect(() => {
    if (candidates.length === 0) router.replace("/host/fees");
  }, [candidates.length, router]);

  if (candidates.length === 0) return null;

  return (
    <AppShell>
      <InterviewChrome
        step={6}
        total={9}
        kicker="Bottles"
        title="How should people claim these?"
        onBack={() => router.back()}
        footer={
          <PrimaryButton disabled={!pourOk} onPress={continueToFees}>
            Continue
          </PrimaryButton>
        }
      >
        <Text style={styles.lead}>
          Friends can take a glass each — tax still follows what they claim.
        </Text>
        {candidates.map((row) => {
          const mode = pourMode[row.itemId] ?? "glasses";
          const glasses = pourGlasses[row.itemId] ?? row.suggestGlasses;
          return (
            <View key={row.itemId} style={styles.card}>
              <Text style={styles.name}>{row.name}</Text>
              <Text style={styles.meta}>
                {centsToLabel(row.totalCents)}
                {row.printedQty > 1 ? ` · qty ${row.printedQty}` : ""} · {row.label}
              </Text>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>{glasses} glasses in this bottle</Text>
                <View style={styles.stepper}>
                  <PressScale
                    accessibilityLabel="Fewer glasses"
                    disabled={glasses <= MIN_GLASSES_PER_UNIT}
                    onPress={() =>
                      setPourGlasses((prev) => ({
                        ...prev,
                        [row.itemId]: Math.max(MIN_GLASSES_PER_UNIT, glasses - 1),
                      }))
                    }
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </PressScale>
                  <Text style={styles.stepVal}>{glasses}</Text>
                  <PressScale
                    accessibilityLabel="More glasses"
                    disabled={glasses >= MAX_GLASSES_PER_UNIT}
                    onPress={() =>
                      setPourGlasses((prev) => ({
                        ...prev,
                        [row.itemId]: Math.min(MAX_GLASSES_PER_UNIT, glasses + 1),
                      }))
                    }
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </PressScale>
                </View>
              </View>
              <View style={styles.modeRow}>
                <PressScale
                  onPress={() =>
                    setPourMode((prev) => ({ ...prev, [row.itemId]: "as_printed" }))
                  }
                  style={[styles.modeBtn, mode === "as_printed" && styles.modeBottleOn]}
                >
                  <Text
                    style={[styles.modeText, mode === "as_printed" && styles.modeBottleText]}
                  >
                    Keep as bottle
                  </Text>
                </PressScale>
                <PressScale
                  onPress={() =>
                    setPourMode((prev) => ({ ...prev, [row.itemId]: "glasses" }))
                  }
                  style={[styles.modeBtn, mode === "glasses" && styles.modeGlassesOn]}
                >
                  <Text
                    style={[styles.modeText, mode === "glasses" && styles.modeGlassesText]}
                  >
                    Split into glasses
                  </Text>
                </PressScale>
              </View>
            </View>
          );
        })}
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20, color: colors.muted, marginBottom: 14 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.paper,
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink, letterSpacing: -0.2 },
  meta: { marginTop: 3, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  stepperRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stepperLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: 18, fontWeight: "700", color: colors.ink },
  stepVal: { width: 24, textAlign: "center", fontSize: 15, fontWeight: "700" },
  modeRow: { marginTop: 12, flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  modeBottleOn: {
    borderColor: colors.merlot,
    backgroundColor: "rgba(110,46,53,0.08)",
  },
  modeGlassesOn: {
    borderColor: colors.select,
    backgroundColor: "rgba(47,93,80,0.12)",
  },
  modeText: { fontSize: 13, fontWeight: "700", color: colors.ink, textAlign: "center" },
  modeBottleText: { color: colors.merlot },
  modeGlassesText: { color: colors.select },
});
