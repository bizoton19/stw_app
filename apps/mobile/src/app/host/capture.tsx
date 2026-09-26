import { useEffect, useRef } from "react";
import { Alert, Image, Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { useShareIntentContext } from "expo-share-intent";
import { Camera, ImageIcon, Share2 } from "lucide-react-native";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { ChoiceRow } from "@/components/choice-row";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { showActionMenu } from "@/lib/action-menu";
import { colors } from "@/lib/theme";

export default function HostCapture() {
  const router = useRouter();
  const draft = useHostDraft();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const consumedShareRef = useRef(false);
  const hasImage = Boolean(draft.image);

  useEffect(() => {
    if (consumedShareRef.current) return;
    if (!hasShareIntent) return;
    const file = shareIntent.files?.[0];
    if (!file?.path) return;
    consumedShareRef.current = true;
    draft.setPick("share", {
      uri: file.path,
      fileName: file.fileName ?? null,
      mimeType: file.mimeType ?? "image/jpeg",
    });
    resetShareIntent(false);
  }, [draft.setPick, hasShareIntent, resetShareIntent, shareIntent.files]);

  async function takePhoto() {
    if (Platform.OS === "web" || !Device.isDevice) {
      Alert.alert(
        "Camera needs a real phone",
        "Simulators and Expo web don't have a working camera. Pick from the library instead.",
      );
      await pickLibrary("camera");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera needs permission",
        "Allow the camera to photograph the tab, or pick from your library.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      exif: false,
      cameraType: ImagePicker.CameraType.back,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    draft.setPick("camera", {
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
  }

  async function pickLibrary(mode: "camera" | "library" = "library") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && Platform.OS !== "web") {
      Alert.alert("Photos need permission", "Allow photo access to continue.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    draft.setPick(mode, {
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
  }

  function replaceImage() {
    if (draft.pickMode === "camera") {
      void takePhoto();
      return;
    }
    if (draft.pickMode === "library") {
      void pickLibrary("library");
      return;
    }
    showActionMenu({
      title: "Replace photo",
      message: "How do you want to replace this receipt?",
      options: [
        { label: "Take a photo", onPress: () => void takePhoto() },
        { label: "Choose from library", onPress: () => void pickLibrary("library") },
      ],
    });
  }

  const iconSize = hasImage ? 20 : 28;
  const iconColor = colors.ink;

  return (
    <AppShell>
      <InterviewChrome
        step={2}
        total={9}
        kicker="The receipt"
        title="How should we add the tab?"
        onBack={() => router.back()}
        sparse={!hasImage}
        footer={
          <View>
            <FooterHint>
              {draft.image
                ? "Tap the photo above if you need a different shot."
                : "From Photos you can also Share → Split the Wine."}
            </FooterHint>
            <PrimaryButton
              disabled={draft.pickMode === null || !draft.image}
              onPress={() => router.push("/host/parsing")}
            >
              Continue
            </PrimaryButton>
          </View>
        }
      >
        <View style={[styles.list, !hasImage && styles.listEmpty]}>
          <ChoiceRow
            size={hasImage ? "default" : "large"}
            icon={<Camera size={iconSize} color={iconColor} strokeWidth={2.25} />}
            title="Take a photo"
            hint={
              Platform.OS === "web"
                ? "Uses the system picker here. Real camera on iOS and Android."
                : "Opens the device camera"
            }
            selected={draft.pickMode === "camera"}
            onPress={() => void takePhoto()}
          />
          <ChoiceRow
            size={hasImage ? "default" : "large"}
            icon={<ImageIcon size={iconSize} color={iconColor} strokeWidth={2.25} />}
            title="Choose from library"
            hint="JPEG, PNG, or a screenshot"
            selected={draft.pickMode === "library"}
            onPress={() => void pickLibrary()}
          />
          {draft.pickMode === "share" && draft.image ? (
            <ChoiceRow
              icon={<Share2 size={20} color={colors.ink} />}
              title="Shared from Photos"
              hint="Opened from the system share sheet"
              selected
              onPress={() => undefined}
            />
          ) : null}
        </View>
        {draft.image ? (
          <PressScale
            accessibilityLabel="Replace receipt photo"
            onPress={replaceImage}
            style={styles.previewWrap}
          >
            <Image source={{ uri: draft.image.uri }} style={styles.preview} />
            <View style={styles.previewOverlay}>
              <Text style={styles.previewHint}>Tap to replace</Text>
            </View>
          </PressScale>
        ) : null}
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  listEmpty: {
    borderTopWidth: 0,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 280,
    paddingTop: 8,
  },
  previewWrap: {
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  preview: {
    height: 260,
    width: "100%",
  },
  previewOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 10,
    backgroundColor: "rgba(42, 36, 28, 0.55)",
    alignItems: "center",
  },
  previewHint: {
    color: "#F6F4F1",
    fontSize: 13,
    fontWeight: "700",
  },
});
