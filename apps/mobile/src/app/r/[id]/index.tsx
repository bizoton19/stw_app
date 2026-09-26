import { FlatList, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { ClaimerAvatar } from "@/components/claimer-avatar";
import { ClaimLineRow } from "@/components/claim-line-row";
import { Field } from "@/components/field";
import { PressScale } from "@/components/press-scale";
import { ReceiptImageButton } from "@/components/receipt-image-viewer";
import { useClaimFlow } from "@/context/claim-flow";
import { hapticNotify } from "@/lib/haptics";
import { centsToLabel } from "@/lib/money";
import { computeTotals } from "@/lib/totals";
import { getClaimToken } from "@/lib/session";
import { colors } from "@/lib/theme";
import { useMemo, useState } from "react";
import type { Claim, Item } from "@/lib/types";

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
            Links live in this server's memory. Ask the host for a fresh claim link.
          </Text>
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
  const flow = useClaimFlow();
  const restaurant = flow.receipt?.restaurant?.trim() || "tonight’s check";
  const [name, setName] = useState(() => flow.guest?.name || "");
  const [contact, setContact] = useState(() => flow.guest?.contact || "");

  return (
    <AppShell>
      <InterviewChrome
        step={1}
        total={3}
        kicker={restaurant}
        title={
          flow.isHost
            ? "You're hosting — claim under what name?"
            : `Here is the tab for ${restaurant}`
        }
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
            : "Your host has added you to the tab. You can claim items that you consumed by starting with adding your name and contact."}
        </Text>
        <ReceiptImageButton receiptId={flow.receipt!.id} hasImage={flow.receipt?.hasImage} />
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
  const closed = receipt.status === "finalized";
  const totalSteps = 3;
  const pickStep = 2;
  const activeQueued = flow.queued.filter((id) => (receipt.remaining[id] ?? 0) > 0);

  function goSettle() {
    router.push({
      pathname: "/r/[id]/settle",
      params: flow.isHost ? { id: receipt.id, host: "1" } : { id: receipt.id },
    });
  }

  if (closed) {
    return (
      <InterviewChrome
        step={pickStep}
        total={totalSteps}
        kicker={receipt.restaurant || "The check"}
        title="Claiming is closed"
        footer={
          <View>
            <PrimaryButton onPress={goSettle}>Settle Payment</PrimaryButton>
            {flow.isHost ? (
              <QuietButton disabled={flow.busy} onPress={() => void flow.reopen()}>
                Reopen claiming
              </QuietButton>
            ) : null}
          </View>
        }
      >
        <ReceiptImageButton receiptId={receipt.id} hasImage={receipt.hasImage} />
        {flow.message ? <Text style={styles.err}>{flow.message}</Text> : null}
        <History />
      </InterviewChrome>
    );
  }

  const footer =
    remainingItems.length === 0 ? (
      <View>
        <PrimaryButton onPress={goSettle}>Settle Payment</PrimaryButton>
        {flow.isHost ? (
          <QuietButton
            disabled={flow.busy}
            onPress={() =>
              void flow.closeOut().then((ok) => {
                if (ok) goSettle();
              })
            }
          >
            Close claiming
          </QuietButton>
        ) : null}
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
              if (ok) {
                void hapticNotify("success");
                goSettle();
              } else {
                void hapticNotify("error");
              }
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
                if (ok) goSettle();
              })
            }
          >
            Close — leftovers on the host
          </QuietButton>
        ) : null}
      </View>
    );

  return (
    <InterviewChrome
      step={pickStep}
      total={totalSteps}
      kicker={receipt.restaurant || "The check"}
      title="What did you have?"
      onBack={() => router.back()}
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
            <ReceiptImageButton receiptId={receipt.id} hasImage={receipt.hasImage} />
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
            <ClaimLineRow
              item={item}
              left={left}
              selected={selected}
              onToggle={() => flow.toggle(item.id)}
            />
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
  const closed = receipt.status === "finalized";

  const claimants = useMemo(() => {
    const map = new Map<
      string,
      { personName: string; personContact?: string; claims: Claim[] }
    >();
    for (const claim of receipt.claims) {
      const key = `${claim.personName}\0${claim.personContact ?? ""}`;
      let row = map.get(key);
      if (!row) {
        row = {
          personName: claim.personName,
          personContact: claim.personContact,
          claims: [],
        };
        map.set(key, row);
      }
      row.claims.push(claim);
    }
    return [...map.values()].sort((a, b) => a.personName.localeCompare(b.personName));
  }, [receipt.claims]);

  if (claimants.length === 0) return null;

  const itemName = (itemId: string) =>
    receipt.items.find((item) => item.id === itemId)?.name ?? "Item";

  return (
    <View style={{ marginTop: 24 }}>
      <View style={styles.sectionRow}>
        <Users size={14} color={colors.muted} strokeWidth={2} />
        <Text style={styles.section}>Who claimed what</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.claimCards}
        style={styles.claimScroller}
      >
        {claimants.map((person) => {
          const isYou = flow.guest?.name === person.personName;
          return (
            <View
              key={`${person.personName}\0${person.personContact ?? ""}`}
              style={styles.claimCard}
            >
              <View style={styles.claimCardHead}>
                <ClaimerAvatar name={person.personName} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.claimCardName} numberOfLines={1}>
                    {person.personName}
                    {isYou ? " (you)" : ""}
                  </Text>
                  {person.personContact ? (
                    <Text style={styles.claimCardMeta} numberOfLines={1}>
                      {person.personContact}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.claimCardLines}>
                {person.claims.map((claim) => {
                  const mineToDrop =
                    !closed &&
                    (Boolean(getClaimToken(receipt.id, claim.id)) || flow.isHost);
                  return (
                    <View key={claim.id} style={styles.claimCardLine}>
                      <Text style={styles.claimCardLineText} numberOfLines={2}>
                        {claim.units}× {itemName(claim.itemId)}
                      </Text>
                      {mineToDrop ? (
                        <PressScale
                          disabled={flow.busy}
                          haptic="medium"
                          onPress={() => {
                            if (flow.busy) return;
                            void hapticNotify("warning");
                            void flow.unclaim(claim.id);
                          }}
                          style={styles.unclaimHit}
                        >
                          <Text style={styles.unclaimText}>Unclaim</Text>
                        </PressScale>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  lead: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 16 },
  as: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 12 },
  err: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  section: { fontSize: 12, fontWeight: "600", color: colors.muted },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  claimScroller: { marginHorizontal: -20 },
  claimCards: { paddingHorizontal: 20, gap: 10, paddingVertical: 4 },
  claimCard: {
    width: 200,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
    gap: 12,
  },
  claimCardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  claimCardName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  claimCardMeta: { marginTop: 2, fontSize: 12, color: colors.muted },
  claimCardLines: { gap: 8 },
  claimCardLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  claimCardLineText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: colors.inkSoft,
  },
  unclaimHit: { paddingVertical: 2, paddingHorizontal: 2 },
  unclaimText: { fontSize: 12, fontWeight: "700", color: colors.merlot },
});
