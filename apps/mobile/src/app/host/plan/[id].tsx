import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { goHostDesk } from "@/lib/navigation";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { api } from "@/lib/api";
import { publicClaimUrl } from "@/lib/config";
import { getHostToken } from "@/lib/session";
import type { Invitee, PublicReceipt } from "@/lib/types";
import { colors } from "@/lib/theme";

export default function HostPlanBoard() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const claimUrl = id ? publicClaimUrl(id) : "";
  const hostToken = id ? getHostToken(id) : null;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api<PublicReceipt>(`/api/receipts/${id}`, { hostToken });
      setReceipt(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load outing");
    }
  }, [hostToken, id]);

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

  async function copyLink() {
    await Clipboard.setStringAsync(claimUrl);
    Alert.alert("Copied", "Invite link is on your clipboard.");
  }

  async function shareLink() {
    await Share.share({
      message: `Join my outing on Split the Wine — RSVP here:\n${claimUrl}`,
      url: claimUrl,
    });
  }

  function uploadCheck() {
    if (!id) return;
    router.push(`/host/capture?outing=${id}`);
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
    <AppShell meta="Planning">
      <InterviewChrome
        step={2}
        total={3}
        kicker="Planning"
        title={receipt?.restaurant || "Your outing"}
        onBack={goHostDesk}
        onHome={goHostDesk}
        keyboard
        footer={
          <View>
            <FooterHint>When it’s over, upload the check into this same space.</FooterHint>
            <PrimaryButton onPress={uploadCheck}>Upload the check</PrimaryButton>
            <QuietButton onPress={() => void shareLink()}>Share invite link</QuietButton>
            <QuietButton onPress={() => void copyLink()}>Copy link</QuietButton>
          </View>
        }
        supportTip
      >
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {whenLabel ? <Text style={styles.when}>{whenLabel}</Text> : null}
        {receipt?.hostInfo?.note ? (
          <Text style={styles.note}>{receipt.hostInfo.note}</Text>
        ) : null}

        <Text style={styles.hint}>
          One link for everyone. People show up here when they RSVP Going, Maybe, or Can’t.
        </Text>
        {rsvpCount === 0 ? (
          <Text style={styles.empty}>No RSVPs yet — share the link above.</Text>
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
