import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goHostDesk } from "@/lib/navigation";
import {
  AppShell,
  FooterHint,
  InterviewChrome,
  PrimaryButton,
  QuietButton,
} from "@/components/chrome";
import { api } from "@/lib/api";
import { publicClaimUrl } from "@/lib/config";
import { registerHostClaimPush } from "@/lib/host-push";
import { shareLink as shareClaimLink } from "@/lib/share-link";
import { clearHostedReceipt, patchHostedReceipt } from "@/lib/host-tabs";
import { getHostToken, hydrateSession } from "@/lib/session";
import type { Invitee, PublicReceipt } from "@/lib/types";
import { colors } from "@/lib/theme";

function localTodayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function outingDay(receipt: PublicReceipt | null): string | null {
  if (!receipt) return null;
  if (receipt.receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(receipt.receiptDate)) {
    return receipt.receiptDate;
  }
  if (receipt.nightAt) return receipt.nightAt.slice(0, 10);
  return null;
}

export default function HostPlanBoard() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [pushHint, setPushHint] = useState<string | null>(null);

  const claimUrl = id ? publicClaimUrl(id) : "";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateSession();
      if (cancelled || !id) return;
      setHostToken(getHostToken(id));
      const result = await registerHostClaimPush(id);
      if (cancelled) return;
      if (result === "ok") {
        setPushHint("You’ll get a notification when someone RSVPs.");
      } else if (result === "denied") {
        setPushHint("Notifications are off — you can still see who’s coming here.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    await hydrateSession();
    const token = getHostToken(id);
    setHostToken(token);
    try {
      const data = await api<PublicReceipt>(`/api/receipts/${id}`, { hostToken: token });
      setReceipt(data);
      setError(null);
      if (data.status === "draft" || data.status === "planning") {
        await patchHostedReceipt(id, { status: data.status });
      }
      if (data.status === "open" || data.status === "finalized") {
        router.replace({ pathname: "/r/[id]/settle", params: { id, host: "1" } });
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 404
          ? "This outing is no longer available."
          : "Couldn’t load this outing. Check your connection and try again.",
      );
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const list = receipt?.invitees ?? [];
    return {
      going: list.filter((i) => i.response === "going"),
      maybe: list.filter((i) => i.response === "maybe"),
      cant: list.filter((i) => i.response === "cant"),
    };
  }, [receipt?.invitees]);

  const day = outingDay(receipt);
  const canUpload = Boolean(day && day <= localTodayKey());

  async function shareLink() {
    await shareClaimLink({
      message: "Join my outing on Split the Wine — RSVP here:",
      url: claimUrl,
    });
  }

  function uploadCheck() {
    if (!id || !canUpload) return;
    router.push(`/host/capture?outing=${id}`);
  }

  function confirmDelete() {
    if (!id) return;
    Alert.alert(
      "Delete this outing?",
      `${receipt?.restaurant || "This outing"} will be deleted for everyone. The invite link will stop working.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await hydrateSession();
                const token = getHostToken(id) ?? hostToken;
                if (!token) throw new Error("This phone can’t delete this outing.");
                await api(`/api/receipts/${id}`, { method: "DELETE", hostToken: token });
              } catch (err) {
                const e = err as { message?: string; code?: string };
                if (e.code !== "not_found") {
                  Alert.alert("Couldn't delete", e.message || "Try again in a moment.");
                  setBusy(false);
                  return;
                }
              }
              await clearHostedReceipt(id);
              goHostDesk();
            })();
          },
        },
      ],
    );
  }

  const whenLabel = receipt?.nightAt
    ? new Date(receipt.nightAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const rsvpCount =
    groups.going.length + groups.maybe.length + groups.cant.length;

  return (
    <AppShell meta={canUpload ? "Today" : "Planning"}>
      <InterviewChrome
        step={1}
        total={1}
        hideProgress
        kicker={canUpload ? "Outing day" : "Planning"}
        motif="cork"
        title={receipt?.restaurant || "Your outing"}
        onBack={goHostDesk}
        onHome={goHostDesk}
        keyboard
        footer={
          <View>
            {canUpload ? (
              <>
                <FooterHint>Tonight’s the night — upload the check here.</FooterHint>
                <PrimaryButton onPress={uploadCheck}>Upload the check</PrimaryButton>
                <QuietButton onPress={() => void shareLink()}>Share invite link</QuietButton>
              </>
            ) : (
              <>
                <FooterHint>
                  You can upload the check on the day of the outing. Share the link so people can RSVP.
                </FooterHint>
                <PrimaryButton onPress={() => void shareLink()}>Share invite link</PrimaryButton>
              </>
            )}
            <QuietButton disabled={busy} onPress={confirmDelete}>
              Delete outing
            </QuietButton>
          </View>
        }
        supportTip
      >
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {whenLabel ? <Text style={styles.when}>{whenLabel}</Text> : null}
        {receipt?.hostInfo?.note ? (
          <Text style={styles.note}>{receipt.hostInfo.note}</Text>
        ) : null}
        {pushHint ? <Text style={styles.pushHint}>{pushHint}</Text> : null}

        <Text style={styles.hint}>
          One link for everyone. People show up here when they RSVP Going, Maybe, or Can’t.
        </Text>
        {rsvpCount === 0 ? (
          <Text style={styles.empty}>No RSVPs yet — share the link.</Text>
        ) : null}

        <Roster title="Going" people={groups.going} />
        <Roster title="Maybe" people={groups.maybe} />
        <Roster title="Can't" people={groups.cant} />
      </InterviewChrome>
    </AppShell>
  );
}

function Roster({ title, people }: { title: string; people: Invitee[] }) {
  if (people.length === 0) return null;
  return (
    <View style={styles.roster}>
      <Text style={styles.rosterTitle}>
        {title} ({people.length})
      </Text>
      {people.map((p) => (
        <View key={p.id} style={styles.personBlock}>
          <Text style={styles.person}>· {p.personName}</Text>
          {p.note ? <Text style={styles.personNote}>{p.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  err: { color: colors.danger, marginBottom: 10, fontSize: 14 },
  when: { fontSize: 15, fontWeight: "600", color: colors.inkSoft, marginBottom: 6 },
  note: { fontSize: 14, color: colors.ink, marginBottom: 14, lineHeight: 20 },
  pushHint: {
    marginBottom: 10,
    fontSize: 14,
    lineHeight: 20,
    color: colors.merlot,
    fontWeight: "600",
  },
  hint: { fontSize: 13, color: colors.muted, marginBottom: 12, marginTop: 4, lineHeight: 18 },
  empty: { fontSize: 14, color: colors.inkSoft, marginBottom: 16 },
  roster: { marginBottom: 14 },
  rosterTitle: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  personBlock: { marginBottom: 4 },
  person: { fontSize: 14, color: colors.inkSoft, lineHeight: 22 },
  personNote: {
    fontSize: 13,
    color: colors.muted,
    marginLeft: 12,
    marginBottom: 2,
    fontStyle: "italic",
  },
});
