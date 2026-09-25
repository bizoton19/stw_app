import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Receipt, Users } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { ClaimerAvatar } from "@/components/claimer-avatar";
import { Field } from "@/components/field";
import { PressScale } from "@/components/press-scale";
import { useClaimFlow } from "@/context/claim-flow";
import { hapticNotify } from "@/lib/haptics";
import { centsToLabel } from "@/lib/money";
import { computeTotals } from "@/lib/totals";
import { getClaimToken } from "@/lib/session";
import { colors } from "@/lib/theme";
import { useMemo, useState } from "react";
import type { Item } from "@/lib/types";

export default function ClaimScreen() {
  const router = useRouter();
  const flow = useClaimFlow();
  const meta =
    flow.live === "live" ? "Live" : flow.live === "offline" ? "Offline" : "Reconnecting";

  if (flow.error && !flow.receipt) {
    return (
      <AppShell meta="Missing">
        <View style={{ padding: 20, paddingTop: 40 }}>
          <Text style={styles.title}>That tab is gone</Text>
          <Text style={styles.muted}>
            Links live in this server's memory. Start a new receipt from home.
          </Text>
          <View style={{ marginTop: 24 }}>
            <PrimaryButton onPress={() => router.replace("/")}>Back home</PrimaryButton>
          </View>
        </View>
      </AppShell>
    );
  }

  if (!flow.receipt) {
    return (
      <AppShell meta="Loading">
        <Text style={[styles.muted, { textAlign: "center", marginTop: 80 }]}>
          Opening the check…
        </Text>
      </AppShell>
    );
  }

  if (!flow.guest) {
    return <JoinScreen />;
  }

  return (
    <AppShell meta={meta}>
      <PickBoard />
    </AppShell>
  );
}

function JoinScreen() {
  const router = useRouter();
  const flow = useClaimFlow();
  const [name, setName] = useState(
    () =>
      flow.guest?.name ||
      flow.receipt?.hostInfo?.payments[0]?.handle?.replace(/^[@$]/, "") ||
      "",
  );
  const [contact, setContact] = useState(() => flow.guest?.contact || "");
  return (
    <AppShell>
      <InterviewChrome
        step={1}
        total={3}
        kicker={flow.receipt?.restaurant || "At the table"}
        title={flow.isHost ? "You're hosting — claim under what name?" : "What should we call you?"}
        onBack={() => router.replace("/")}
        keyboard
        footer={
          <PrimaryButton
            disabled={!name.trim()}
            onPress={() => void flow.join({ name: name.trim(), contact: contact.trim() })}
          >
            See the check
          </PrimaryButton>
        }
      >
        <Text style={styles.lead}>
          {flow.isHost
            ? "Pick what you ordered too. Leftovers can still land on you when you close claiming."
            : "A name is enough. Add a handle so the host can reach you if something looks off."}
        </Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Alex" autoComplete="name" />
        <Field
          label="Contact"
          hint="(optional)"
          value={contact}
          onChangeText={setContact}
          placeholder="phone, Venmo, or email"
          autoComplete="tel"
          keyboardType="default"
        />
      </InterviewChrome>
    </AppShell>
  );
}

function PickBoard() {
  const router = useRouter();
  const flow = useClaimFlow();
  const receipt = flow.receipt!;
  const remainingItems = receipt.items.filter((item) => (receipt.remaining[item.id] ?? 0) > 0);
  const goneItems = receipt.items.filter((item) => (receipt.remaining[item.id] ?? 0) <= 0);
  const totals = useMemo(() => computeTotals(receipt), [receipt]);
  const mine = flow.guest
    ? totals.people.find((p) => p.personName === flow.guest?.name)
    : undefined;
  const closed = receipt.status === "finalized";
  const totalSteps = 3;
  const pickStep = 2;
  const activeQueued = flow.queued.filter((id) => (receipt.remaining[id] ?? 0) > 0);

  if (closed) {
    return (
      <InterviewChrome
        step={pickStep}
        total={totalSteps}
        kicker={receipt.restaurant || "The check"}
        title="Claiming is closed"
        onBack={() => router.replace("/")}
        footer={
          <View>
            <PrimaryButton
              onPress={() =>
                router.push({
                  pathname: "/r/[id]/settle",
                  params: flow.isHost
                    ? { id: receipt.id, host: "1" }
                    : { id: receipt.id },
                })
              }
            >
              See who owes what
            </PrimaryButton>
            {flow.isHost ? (
              <QuietButton
                disabled={flow.busy}
                onPress={() => void flow.reopen()}
              >
                Reopen claiming
              </QuietButton>
            ) : null}
            <QuietButton onPress={() => router.replace("/")}>Home</QuietButton>
          </View>
        }
      >
        {mine ? (
          <Text style={styles.mine}>
            Your running total · {centsToLabel(mine.totalCents)}
          </Text>
        ) : (
          <Text style={styles.mine}>Your running total · {centsToLabel(0)}</Text>
        )}
        {flow.message ? <Text style={styles.err}>{flow.message}</Text> : null}
        <History />
      </InterviewChrome>
    );
  }

  const footer =
    remainingItems.length === 0 ? (
      <View>
        <PrimaryButton
          onPress={() =>
            router.push({
              pathname: "/r/[id]/settle",
              params: flow.isHost ? { id: receipt.id, host: "1" } : { id: receipt.id },
            })
          }
        >
          See who owes what
        </PrimaryButton>
        {flow.isHost ? (
          <QuietButton
            disabled={flow.busy}
            onPress={() =>
              void flow.closeOut().then((ok) => {
                if (ok)
                  router.push({
                    pathname: "/r/[id]/settle",
                    params: { id: receipt.id, host: "1" },
                  });
              })
            }
          >
            Close claiming
          </QuietButton>
        ) : null}
        <QuietButton onPress={() => router.replace("/")}>Home</QuietButton>
      </View>
    ) : (
      <View>
        <PrimaryButton
          disabled={flow.busy || !flow.guest || activeQueued.length === 0}
          busy={flow.busy && !flow.needsQty}
          onPress={() => {
            if (flow.needsQty) {
              router.push({ pathname: "/r/[id]/qty", params: { id: receipt.id } });
              return;
            }
            void flow.claimQueued().then((ok) => {
              if (ok) void hapticNotify("success");
              else void hapticNotify("error");
            });
          }}
        >
          {activeQueued.length === 0
            ? "Pick what you had"
            : flow.needsQty
              ? activeQueued.length === 1
                ? "Claim 1 item"
                : `Claim ${activeQueued.length} items`
              : activeQueued.length === 1
                ? "Claim it"
                : `Claim ${activeQueued.length}`}
        </PrimaryButton>
        {flow.isHost ? (
          <QuietButton
            disabled={flow.busy}
            onPress={() =>
              void flow.closeOut().then((ok) => {
                if (ok)
                  router.push({
                    pathname: "/r/[id]/settle",
                    params: { id: receipt.id, host: "1" },
                  });
              })
            }
          >
            Close — leftovers on the host
          </QuietButton>
        ) : (
          <QuietButton
            onPress={() =>
              router.push({ pathname: "/r/[id]/settle", params: { id: receipt.id } })
            }
          >
            Running totals
          </QuietButton>
        )}
        <QuietButton onPress={() => router.replace("/")}>Home</QuietButton>
      </View>
    );

  return (
    <InterviewChrome
      step={pickStep}
      total={totalSteps}
      kicker={receipt.restaurant || "The check"}
      title="What did you have?"
      onBack={() => router.replace("/")}
      footer={footer}
      scroll={false}
    >
      <FlatList
        data={remainingItems}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        contentInsetAdjustmentBehavior="automatic"
        bounces={Platform.OS === "ios"}
        overScrollMode={Platform.OS === "android" ? "auto" : undefined}
        ListHeaderComponent={
          <View>
            {flow.guest ? (
              <Text style={styles.as}>
                Claiming as {flow.guest.name}
                {flow.isHost ? " (host)" : ""}
                {flow.guest.contact ? ` · ${flow.guest.contact}` : ""}
              </Text>
            ) : null}
            <Text style={styles.mine}>
              Your running total · {centsToLabel(mine?.totalCents ?? 0)}
            </Text>
            {flow.message ? <Text style={styles.err}>{flow.message}</Text> : null}
            {remainingItems.length === 0 ? (
              <Text style={[styles.muted, { textAlign: "center", paddingVertical: 32 }]}>
                Everything on this check is claimed.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }: { item: Item }) => {
          const left = receipt.remaining[item.id] ?? 0;
          const selected = activeQueued.includes(item.id);
          return (
            <PressScale
              accessibilityState={{ selected }}
              haptic="select"
              onPress={() => flow.toggle(item.id)}
              style={styles.item}
            >
              <View style={styles.checkHit}>
                <View style={[styles.check, selected && styles.checkOn]}>
                  {selected ? <Check size={12} color={colors.merlotFg} strokeWidth={3} /> : null}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={[styles.muted, styles.tabular]}>
                  {centsToLabel(item.totalCents)} for {item.qty}
                </Text>
              </View>
              <Text style={[styles.left, selected && { color: colors.merlot }]}>{left} left</Text>
            </PressScale>
          );
        }}
        ListFooterComponent={
          <View>
            {goneItems.length > 0 ? (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.section}>Claimed out</Text>
                {goneItems.map((item) => (
                  <Text key={item.id} style={styles.muted}>
                    {item.name}
                  </Text>
                ))}
              </View>
            ) : null}
            <History />
          </View>
        }
      />
    </InterviewChrome>
  );
}

function History() {
  const flow = useClaimFlow();
  const receipt = flow.receipt!;
  if (receipt.claims.length === 0) return null;
  const closed = receipt.status === "finalized";
  return (
    <View style={{ marginTop: 24 }}>
      <View style={styles.sectionRow}>
        <Users size={14} color={colors.muted} strokeWidth={2} />
        <Text style={styles.section}>Who claimed what</Text>
      </View>
      {receipt.items.map((item) => {
        const claims = receipt.claims.filter((c) => c.itemId === item.id);
        if (claims.length === 0) return null;
        return (
          <View key={item.id} style={{ marginBottom: 16 }}>
            <View style={styles.itemLabelRow}>
              <Receipt size={13} color={colors.inkSoft} strokeWidth={2} />
              <Text style={styles.itemName}>{item.name}</Text>
            </View>
            {claims.map((claim) => {
              const mineToDrop = getClaimToken(receipt.id, claim.id) && !closed;
              return (
                <View key={claim.id} style={styles.claimRow}>
                  <ClaimerAvatar name={claim.personName} size={26} />
                  <Text style={[styles.muted, { flex: 1, marginTop: 0 }]}>
                    {claim.personName} · {claim.units}
                    {claim.personContact ? ` · ${claim.personContact}` : ""}
                  </Text>
                  {mineToDrop ? (
                    <PressScale
                      disabled={flow.busy}
                      haptic="medium"
                      onPress={() => {
                        void hapticNotify("warning");
                        void flow.unclaim(claim.id);
                      }}
                      style={{ height: 44, justifyContent: "center", paddingHorizontal: 4 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.ink }}>
                        Unclaim
                      </Text>
                    </PressScale>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
  lead: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 16 },
  mine: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"], marginBottom: 8 },
  as: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 12 },
  err: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.merlot, borderColor: colors.merlot },
  itemName: { fontSize: 15, fontWeight: "600", color: colors.ink },
  left: { fontSize: 12, fontWeight: "600", color: colors.inkSoft, fontVariant: ["tabular-nums"] },
  section: { fontSize: 12, fontWeight: "600", color: colors.muted },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  itemLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  claimRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
});
