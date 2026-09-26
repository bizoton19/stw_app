import { useEffect, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { IconActionButton } from "@/components/icon-action-button";
import { useHostDraft } from "@/context/host-draft";
import { registerHostClaimPush } from "@/lib/host-push";
import { centsToLabel } from "@/lib/money";
import { colors } from "@/lib/theme";

export default function HostShare() {
  const router = useRouter();
  const draft = useHostDraft();
  const [copied, setCopied] = useState(false);
  const [pushHint, setPushHint] = useState<string | null>(null);
  const activeItems = draft.items.filter((i) => !i.removed);
  const total =
    activeItems.reduce((s, i) => s + i.totalCents, 0) +
    draft.fees.reduce((s, f) => s + f.amountCents, 0);
  const place = draft.venue?.name?.trim() || draft.restaurant.trim() || "Tonight’s check";
  const receiptId = draft.receiptId ?? "demo";

  useEffect(() => {
    if (!draft.receiptId) return;
    void (async () => {
      const result = await registerHostClaimPush(draft.receiptId!);
      if (result === "ok") {
        setPushHint("You’ll get a ping when someone claims.");
      } else if (result === "denied") {
        setPushHint("Notifications are off — you can still watch the live board.");
      }
    })();
  }, [draft.receiptId]);

  return (
    <AppShell>
      <InterviewChrome
        step={9}
        total={9}
        kicker="Share"
        title="Send this. They claim what they consumed."
        sparse
        footer={
          <View>
            <FooterHint>Anyone with the link can claim — no account needed.</FooterHint>
            <PrimaryButton
              onPress={() =>
                router.replace({
                  pathname: "/r/[id]/settle",
                  params: { id: receiptId, host: "1" },
                })
              }
            >
              Open the live board
            </PrimaryButton>
            <QuietButton onPress={() => router.replace("/")}>Home</QuietButton>
          </View>
        }
      >
        <Text style={styles.place}>{place}</Text>
        {draft.venue?.formattedAddress ? (
          <Text style={styles.address}>{draft.venue.formattedAddress}</Text>
        ) : null}
        {pushHint ? <Text style={styles.pushHint}>{pushHint}</Text> : null}

        <View style={styles.totalBlock}>
          <Text style={styles.muted}>Check total</Text>
          <Text style={styles.total}>{centsToLabel(total)}</Text>
        </View>

        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>Claim link</Text>
          <Text selectable style={styles.url}>
            {draft.claimUrl}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <IconActionButton
              icon="copy"
              label={copied ? "Copied" : "Copy"}
              onPress={async () => {
                await Clipboard.setStringAsync(draft.claimUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <IconActionButton
              icon="share"
              label="Share"
              onPress={async () => {
                try {
                  await Share.share({
                    message: `Claim what you ordered on ${place}: ${draft.claimUrl}`,
                    url: draft.claimUrl,
                  });
                } catch {
                  await Clipboard.setStringAsync(draft.claimUrl);
                  setCopied(true);
                }
              }}
            />
          </View>
        </View>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  place: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  address: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  pushHint: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.merlot,
    fontWeight: "600",
  },
  totalBlock: {
    marginTop: 28,
    marginBottom: 8,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  muted: { fontSize: 15, fontWeight: "600", color: colors.inkSoft },
  total: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  urlBox: {
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.paper,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSoft,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  url: { fontFamily: "monospace", fontSize: 14, lineHeight: 20, color: colors.ink },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
});
