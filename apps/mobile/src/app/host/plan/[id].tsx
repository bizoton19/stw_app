import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { goHostDesk } from "@/lib/navigation";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { addOutingInvitees, api } from "@/lib/api";
import { publicClaimUrl } from "@/lib/config";
import { getHostToken } from "@/lib/session";
import type { Invitee, PublicReceipt } from "@/lib/types";
import { colors } from "@/lib/theme";
import { PressScale } from "@/components/press-scale";

export default function HostPlanBoard() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

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
      invited: list.filter((i) => i.response === "invited"),
      maybe: list.filter((i) => i.response === "maybe"),
      cant: list.filter((i) => i.response === "cant"),
    };
  }, [receipt?.invitees]);

  async function copyLink() {
    await Clipboard.setStringAsync(claimUrl);
    Alert.alert("Copied", "Group invite link is on your clipboard.");
  }

  async function shareLink() {
    await Share.share({ message: `Join my outing on Split the Wine:\n${claimUrl}`, url: claimUrl });
  }

  async function inviteOne() {
    if (!id || !name.trim()) return;
    setBusy(true);
    try {
      const { invites } = await addOutingInvitees(
        id,
        [{ personName: name.trim() }],
        hostToken,
      );
      setName("");
      await load();
      const token = invites[0]?.invitee.inviteToken;
      const full = token ? `${publicClaimUrl(id)}?invite=${token}` : claimUrl;
      await Share.share({
        message: `You’re invited — RSVP here:\n${full}`,
        url: full,
      });
    } catch (err) {
      Alert.alert("Invite failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
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
            <QuietButton onPress={() => void shareLink()}>Share group link</QuietButton>
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

        <Text style={styles.section}>Invite someone</Text>
        <View style={styles.inviteRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <PressScale
            disabled={busy || !name.trim()}
            onPress={() => void inviteOne()}
            style={[styles.inviteBtn, (busy || !name.trim()) && { opacity: 0.4 }]}
          >
            <Text style={styles.inviteBtnText}>Invite</Text>
          </PressScale>
        </View>
        <Text style={styles.hint}>Creates Invited → share their personal link. Or use the group link.</Text>

        <Roster title="Going" people={groups.going} />
        <Roster title="Invited" people={groups.invited} />
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
        <Text key={p.id} style={styles.person}>
          · {p.personName}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  err: { color: colors.danger, marginBottom: 10, fontSize: 14 },
  when: { fontSize: 15, fontWeight: "600", color: colors.inkSoft, marginBottom: 6 },
  note: { fontSize: 14, color: colors.ink, marginBottom: 14, lineHeight: 20 },
  section: { marginTop: 8, marginBottom: 8, fontSize: 13, fontWeight: "700", color: colors.inkSoft },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 16, marginTop: 6 },
  row: { gap: 10 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inviteBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.merlot,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtnText: { color: colors.merlotFg, fontWeight: "700", fontSize: 15 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper,
    marginBottom: 8,
  },
  roster: { marginBottom: 14 },
  rosterTitle: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  person: { fontSize: 14, color: colors.inkSoft, lineHeight: 22 },
});
