import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { useHostDraft } from "@/context/host-draft";
import { centsToLabel } from "@/lib/money";
import { colors } from "@/lib/theme";

export default function HostShare() {
  const router = useRouter();
  const draft = useHostDraft();
  const [copied, setCopied] = useState(false);
  const total =
    draft.items.reduce((s, i) => s + i.totalCents, 0) +
    draft.fees.reduce((s, f) => s + f.amountCents, 0);

  return (
    <AppShell>
      <InterviewChrome
        step={8}
        total={8}
        kicker="Share"
        title="Send this. They claim what they drank."
        footer={
          <View>
            <PrimaryButton
              onPress={() =>
                router.replace({
                  pathname: "/r/[id]",
                  params: { id: draft.receiptId ?? "demo", host: "1" },
                })
              }
            >
              Open the live board
            </PrimaryButton>
            <QuietButton onPress={() => router.replace("/")}>Done for now</QuietButton>
          </View>
        }
      >
        <View style={styles.urlBox}>
          <Text selectable style={styles.url}>
            {draft.claimUrl}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <QuietButton
              onPress={async () => {
                await Clipboard.setStringAsync(draft.claimUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </QuietButton>
          </View>
          <View style={{ flex: 1 }}>
            <QuietButton
              onPress={async () => {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(draft.claimUrl);
                } else {
                  await Clipboard.setStringAsync(draft.claimUrl);
                  setCopied(true);
                }
              }}
            >
              Share
            </QuietButton>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.muted}>Check total</Text>
          <Text style={styles.total}>{centsToLabel(total)}</Text>
        </View>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  urlBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  url: { fontFamily: "monospace", fontSize: 13, color: colors.ink },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  totalRow: {
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  muted: { fontSize: 14, color: colors.muted },
  total: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
