import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { LineKindIcon } from "@/components/line-kind-icon";
import { QtyStepper } from "@/components/qty-stepper";
import { PressScale } from "@/components/press-scale";
import { useClaimFlow } from "@/context/claim-flow";
import { hapticNotify } from "@/lib/haptics";
import { centsToLabel, remainingLineCents, unitPriceCents } from "@/lib/money";
import { colors } from "@/lib/theme";

export default function QtyScreen() {
  const router = useRouter();
  const flow = useClaimFlow();
  const receipt = flow.receipt;
  const totalSteps = 3;
  const qtyStep = 3;
  const autoClaimed = useRef(false);

  const queuedItems = (receipt?.items ?? []).filter(
    (item) => flow.queued.includes(item.id) && (receipt?.remaining[item.id] ?? 0) > 0,
  );
  const totalUnits = queuedItems.reduce((sum, item) => {
    const max = receipt?.remaining[item.id] ?? 0;
    const value = flow.units[item.id] ?? 1;
    return sum + Math.min(Math.max(1, value), max);
  }, 0);

  function goSettle(id: string) {
    router.replace({
      pathname: "/r/[id]/settle",
      params: flow.isHost ? { id, host: "1" } : { id },
    });
  }

  useEffect(() => {
    if (!receipt) return;
    if (queuedItems.length === 0) {
      router.replace({ pathname: "/r/[id]", params: { id: flow.id } });
      return;
    }
    if (flow.needsQty || flow.busy || autoClaimed.current) return;
    autoClaimed.current = true;
    void flow.claimQueued().then((ok) => {
      if (ok) {
        void hapticNotify("success");
        goSettle(receipt.id);
      } else {
        void hapticNotify("error");
        router.replace({ pathname: "/r/[id]", params: { id: receipt.id } });
      }
    });
  }, [flow, queuedItems.length, receipt, router]);

  if (!receipt) return null;
  if (!flow.needsQty) {
    return (
      <AppShell meta={flow.live === "live" ? "Live" : undefined}>
        <Text style={[styles.lead, { textAlign: "center", marginTop: 80 }]}>Claiming…</Text>
      </AppShell>
    );
  }

  return (
    <AppShell meta={flow.live === "live" ? "Live" : undefined}>
      <InterviewChrome
        step={qtyStep}
        total={totalSteps}
        kicker={receipt.restaurant || "The check"}
        title="How many of each?"
        onBack={() => router.back()}
        footer={
          <PrimaryButton
            disabled={flow.busy || !flow.guest || totalUnits < 1}
            busy={flow.busy}
            onPress={() =>
              void flow.claimQueued().then((ok) => {
                if (ok) {
                  void hapticNotify("success");
                  goSettle(receipt.id);
                } else {
                  void hapticNotify("error");
                }
              })
            }
          >
            Finish
          </PrimaryButton>
        }
      >
        <Text style={styles.lead}>Whole glasses only. We will not split a pour.</Text>
        {flow.message ? <Text style={styles.err}>{flow.message}</Text> : null}
        {queuedItems.map((item) => {
          const max = receipt.remaining[item.id] ?? 0;
          const value = Math.min(Math.max(1, flow.units[item.id] ?? 1), Math.max(1, max));
          return (
            <View key={item.id} style={styles.row}>
              <View style={styles.head}>
                <LineKindIcon name={item.name} kind={item.kind} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {centsToLabel(unitPriceCents(item.totalCents, item.qty))} × {max} ·{" "}
                    {centsToLabel(remainingLineCents(item.totalCents, item.qty, max))} left
                  </Text>
                </View>
                <QtyStepper
                  value={value}
                  min={1}
                  max={Math.max(1, max)}
                  onChange={(next) => flow.setUnit(item.id, next)}
                />
              </View>
              <PressScale haptic="select" onPress={() => flow.toggle(item.id)} style={styles.remove}>
                <Text style={styles.removeText}>Remove</Text>
              </PressScale>
            </View>
          );
        })}
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 8 },
  err: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  row: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  remove: { height: 36, justifyContent: "center" },
  removeText: { fontSize: 12, fontWeight: "600", color: colors.muted },
});
