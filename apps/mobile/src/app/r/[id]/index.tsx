import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { ClaimerAvatar } from "@/components/claimer-avatar";
import { ClaimLineRow } from "@/components/claim-line-row";
import { Field } from "@/components/field";
import { HostLiveTabBar } from "@/components/host-live-tab-bar";
import { HostMessage } from "@/components/host-message";
import { RsvpConfirmation } from "@/components/rsvp-confirmation";
import { PressScale } from "@/components/press-scale";
import { ReceiptImageButton } from "@/components/receipt-image-viewer";
import { useClaimFlow } from "@/context/claim-flow";
import { hapticNotify } from "@/lib/haptics";
import { hostNoteText } from "@/lib/host-pay";
import { centsToLabel } from "@/lib/money";
import { postRsvp } from "@/lib/api";
import { personRowKey, sameGuest } from "@/lib/guest-id";
import { computeTotals } from "@/lib/totals";
import { getClaimToken } from "@/lib/session";
import { goHostDesk } from "@/lib/navigation";
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

  if (flow.receipt.status === "planning" || flow.receipt.status === "draft") {
    // Draft from a planned outing (has nightAt, no items yet) still shows RSVP.
    if (
      flow.receipt.status === "planning" ||
      (flow.receipt.nightAt && (flow.receipt.items?.length ?? 0) === 0)
    ) {
      return <RsvpScreen />;
    }
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

function RsvpScreen() {
  const flow = useClaimFlow();
  const receipt = flow.receipt!;
  const already =
    receipt.invitees?.find(
      (row) =>
        (row.response === "going" ||
          row.response === "maybe" ||
          row.response === "cant") &&
        flow.guest?.name &&
        row.personName.toLowerCase() === flow.guest.name.toLowerCase(),
    ) ?? null;

  const [name, setName] = useState(() => already?.personName || flow.guest?.name || "");
  const [contact, setContact] = useState(
    () => already?.personContact || flow.guest?.contact || "",
  );
  const [note, setNote] = useState(() => already?.note || "");
  const [busy, setBusy] = useState(false);
  const initialDone =
    already?.response === "going" || already?.response === "maybe" || already?.response === "cant"
      ? already.response
      : null;
  const [done, setDone] = useState<"going" | "maybe" | "cant" | null>(initialDone);
  const [showForm, setShowForm] = useState(!initialDone);
  const [err, setErr] = useState<string | null>(null);

  const whenLabel = receipt.nightAt
    ? new Date(receipt.nightAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const goingCount =
    receipt.invitees?.filter((row) => row.response === "going").length ?? 0;

  async function submit(response: "going" | "maybe" | "cant") {
    if (!name.trim()) {
      setErr("Add your name so the host knows who’s in.");
      return;
    }
    setBusy(true);
    setErr(null);
    // Land on the ticket immediately — don't wait on refresh (that was leaving
    // people on the form with only the button label flipping to "Still going").
    setDone(response);
    setShowForm(false);
    try {
      await postRsvp(receipt.id, {
        response,
        personName: name.trim(),
        personContact: contact.trim() || null,
        note: note.trim() || null,
      });
      await flow.join({ name: name.trim(), contact: contact.trim() });
      void flow.refresh();
      void hapticNotify("success");
    } catch (e) {
      setShowForm(true);
      setErr(e instanceof Error ? e.message : "Couldn’t send RSVP");
      void hapticNotify("error");
    } finally {
      setBusy(false);
    }
  }

  const place = receipt.restaurant?.trim() || "the outing";
  if (done && !showForm) {
    return (
      <AppShell meta="RSVP">
        <RsvpConfirmation
          receipt={receipt}
          response={done}
          busy={busy}
          onChangeRsvp={() => setShowForm(true)}
        />
      </AppShell>
    );
  }

  return (
    <AppShell meta="RSVP">
      <InterviewChrome
        step={1}
        total={2}
        hideProgress
        kicker={whenLabel || "Upcoming"}
        motif="coupe-pair"
        title={place}
        keyboard
        footer={
          <View style={styles.rsvpActions}>
            <PrimaryButton busy={busy} disabled={busy} onPress={() => void submit("going")}>
              Going
            </PrimaryButton>
            <QuietButton busy={busy} onPress={() => void submit("maybe")}>
              Maybe
            </QuietButton>
            <QuietButton busy={busy} onPress={() => void submit("cant")}>
              Can’t
            </QuietButton>
          </View>
        }
      >
        <HostMessage note={hostNoteText(receipt.hostInfo)} />
        <Text style={styles.lead}>
          RSVP for this outing. Same link for everyone — you can change your answer later.
        </Text>
        {goingCount > 0 ? (
          <Text style={styles.rsvpMeta}>{goingCount} going so far</Text>
        ) : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Alex"
          autoComplete="name"
        />
        <Field
          label="Contact"
          hint="(optional)"
          value={contact}
          onChangeText={setContact}
          placeholder="phone, Venmo, or email"
          autoComplete="tel"
          keyboardType="default"
        />
        <Field
          label="Note"
          hint="(optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Bringing a +1, running late…"
          multiline
          style={{ minHeight: 72, height: undefined, paddingVertical: 12, textAlignVertical: "top" }}
        />
      </InterviewChrome>
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
        hideProgress={flow.isHost}
        kicker={restaurant}
        motif="label-band"
        title={
          flow.isHost ? "You're hosting — claim under what name?" : "Claim what you ordered"
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
        <HostMessage note={hostNoteText(flow.receipt?.hostInfo)} />
        <Text style={styles.lead}>
          {flow.isHost
            ? "Pick what you ordered too. Leftovers can still land on you when you close claiming."
            : "Just a name — no app, no account."}
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
  const totals = useMemo(() => computeTotals(receipt), [receipt]);
  const guestShare = flow.guest
    ? totals.people.find((person) => person.personName === flow.guest?.name)
    : undefined;
  const shareSoFarCents = guestShare ? guestShare.totalCents : null;
  const totalSteps = 3;
  const pickStep = 2;
  const activeQueued = flow.queued.filter((id) => (receipt.remaining[id] ?? 0) > 0);
  const note = hostNoteText(receipt.hostInfo);

  function goSettle() {
    router.push({
      pathname: "/r/[id]/settle",
      params: flow.isHost ? { id: receipt.id, host: "1" } : { id: receipt.id },
    });
  }

  function goLiveBoard() {
    router.replace({
      pathname: "/r/[id]/settle",
      params: { id: receipt.id, host: "1" },
    });
  }

  const hostTabBar = flow.isHost ? (
    <HostLiveTabBar
      mode="claims"
      stacked
      onHome={goHostDesk}
      onClaims={() => undefined}
      onLiveBoard={goLiveBoard}
      closed={closed}
      busy={flow.busy}
      onClose={() =>
        void flow.closeOut().then((ok) => {
          if (ok) goLiveBoard();
        })
      }
      onReopen={() => void flow.reopen()}
      onDelete={() => {
        Alert.alert(
          "Delete closed tab?",
          "This permanently deletes the tab. Claim links will stop working.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => {
                void flow.deleteClosed().then((ok) => {
                  if (ok) goHostDesk();
                });
              },
            },
          ],
        );
      }}
    />
  ) : null;

  if (closed) {
    return (
      <InterviewChrome
        step={pickStep}
        total={totalSteps}
        hideProgress={flow.isHost}
        kicker={receipt.restaurant || "The check"}
        motif="label-band"
        title="Claiming is closed"
        onBack={flow.isHost ? goHostDesk : undefined}
        supportTip={flow.isHost}
        footer={
          <View>
            <PrimaryButton onPress={goSettle}>
              {flow.isHost ? "Live board" : "Pay the host"}
            </PrimaryButton>
            {flow.isHost ? (
              hostTabBar
            ) : null}
          </View>
        }
      >
        <ShareSoFar cents={shareSoFarCents} />
        <HostMessage note={note} />
        <ReceiptImageButton receiptId={receipt.id} hasImage={receipt.hasImage} />
        {flow.message ? <Text style={styles.err}>{flow.message}</Text> : null}
        <History />
      </InterviewChrome>
    );
  }

  const claimButton = (
    <PrimaryButton
      disabled={
        remainingItems.length > 0 &&
        (flow.busy || !flow.guest || activeQueued.length === 0)
      }
      busy={remainingItems.length > 0 && flow.busy && !flow.needsQty}
      onPress={() => {
        if (remainingItems.length === 0) {
          goSettle();
          return;
        }
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
      {remainingItems.length === 0
        ? flow.isHost
          ? "Live board"
          : "Pay the host"
        : activeQueued.length === 0
          ? "Pick what you ordered"
          : flow.needsQty
            ? activeQueued.length === 1
              ? "Claim 1 item"
              : `Claim ${activeQueued.length} items`
            : activeQueued.length === 1
              ? "Claim it"
              : `Claim ${activeQueued.length}`}
    </PrimaryButton>
  );

  const footer = (
    <View>
      {claimButton}
      {flow.isHost ? (
        hostTabBar
      ) : null}
    </View>
  );

  return (
    <InterviewChrome
      step={pickStep}
      total={totalSteps}
      hideProgress={flow.isHost}
      kicker={receipt.restaurant || "The check"}
      motif="label-band"
      title="Claim what you ordered"
      onBack={flow.isHost ? goHostDesk : undefined}
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
            <ShareSoFar cents={shareSoFarCents} />
            <HostMessage note={note} />
            <ReceiptImageButton receiptId={receipt.id} hasImage={receipt.hasImage} />
            {totals.unclaimedItemCents > 0 ? (
              <Text style={styles.remainBanner}>
                Still on the table · {centsToLabel(totals.unclaimedItemCents)}
              </Text>
            ) : null}
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

function ShareSoFar({ cents }: { cents: number | null }) {
  if (cents == null) return null;
  return (
    <Text style={styles.shareSoFar}>
      Your share so far · {centsToLabel(cents)} (incl. tax & tip)
    </Text>
  );
}

function History() {
  const flow = useClaimFlow();
  const receipt = flow.receipt!;
  const closed = receipt.status === "finalized";

  const claimants = useMemo(() => {
    const map = new Map<
      string,
      { guestId?: string; personName: string; personContact?: string; seenAt: string; claims: Claim[] }
    >();
    for (const claim of receipt.claims) {
      const key = personRowKey(claim);
      let row = map.get(key);
      if (!row) {
        row = {
          guestId: claim.guestId,
          personName: claim.personName,
          personContact: claim.personContact,
          seenAt: claim.createdAt,
          claims: [],
        };
        map.set(key, row);
      } else if (claim.createdAt >= row.seenAt) {
        row.seenAt = claim.createdAt;
        row.personName = claim.personName;
        if (claim.personContact) row.personContact = claim.personContact;
        if (claim.guestId) row.guestId = claim.guestId;
      }
      row.claims.push(claim);
    }
    return [...map.values()].sort(
      (a, b) => a.personName.localeCompare(b.personName) || (a.guestId ?? "").localeCompare(b.guestId ?? ""),
    );
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
          const isYou = sameGuest(person, flow.guest);
          return (
            <View key={personRowKey(person)} style={styles.claimCard}>
              <View style={styles.claimCardHead}>
                <ClaimerAvatar
                  name={person.personName}
                  colorKey={person.guestId || person.personName}
                  size={32}
                />
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
                          {flow.busy ? (
                            <ActivityIndicator color={colors.merlot} size="small" />
                          ) : (
                            <Text style={styles.unclaimText}>Unclaim</Text>
                          )}
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
  shareSoFar: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: colors.inkSoft,
    fontVariant: ["tabular-nums"],
  },
  remainBanner: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
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
  rsvpActions: { gap: 4 },
  rsvpThanks: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: "center",
    paddingVertical: 8,
  },
  rsvpMeta: { fontSize: 13, color: colors.muted, marginBottom: 12 },
});
