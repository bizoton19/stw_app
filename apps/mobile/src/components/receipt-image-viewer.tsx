import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { X } from "lucide-react-native";
import { PressScale } from "@/components/press-scale";
import { getApiUrl } from "@/lib/config";
import { colors } from "@/lib/theme";

export function ReceiptImageButton({
  receiptId,
  hasImage,
}: {
  receiptId: string;
  hasImage?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!hasImage) return null;
  return (
    <>
      <PressScale haptic="select" onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={styles.triggerText}>View tab photo</Text>
      </PressScale>
      <ReceiptImageModal
        receiptId={receiptId}
        visible={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function ReceiptImageModal({
  receiptId,
  visible,
  onClose,
}: {
  receiptId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const uri = `${getApiUrl()}/api/receipts/${receiptId}/image`;

  async function download() {
    setBusy(true);
    try {
      const target = `${FileSystem.cacheDirectory ?? ""}tab-${receiptId}.jpg`;
      const result = await FileSystem.downloadAsync(uri, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "image/jpeg",
          dialogTitle: "Tab photo",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Tab photo</Text>
            <Pressable accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.ink} strokeWidth={2.25} />
            </Pressable>
          </View>
          <View style={styles.frame}>
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          </View>
          <PressScale
            haptic="select"
            disabled={busy}
            onPress={() => void download()}
            style={styles.download}
          >
            {busy ? (
              <ActivityIndicator color={colors.merlotFg} />
            ) : (
              <Text style={styles.downloadText}>Download / share</Text>
            )}
          </PressScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
  },
  triggerText: { fontSize: 13, fontWeight: "700", color: colors.merlot },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(42, 36, 28, 0.55)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    borderRadius: 18,
    backgroundColor: colors.paper,
    padding: 16,
    maxHeight: "88%",
    gap: 12,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  frame: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1612",
    minHeight: 280,
    maxHeight: 420,
  },
  image: { width: "100%", height: 380 },
  download: {
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.merlot,
  },
  downloadText: { color: colors.merlotFg, fontSize: 15, fontWeight: "700" },
});
