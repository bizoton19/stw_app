import { Alert, Image, Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageIcon, Sparkles } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { ChoiceRow } from "@/components/choice-row";
import { useHostDraft } from "@/context/host-draft";
import { colors } from "@/lib/theme";

export default function HostCapture() {
  const router = useRouter();
  const draft = useHostDraft();

  async function takePhoto() {
    if (Platform.OS === "web" || !Device.isDevice) {
      Alert.alert(
        "Camera needs a real phone",
        "Simulators and Expo web don't have a working camera. Pick from the library, or use the sample tab. On a physical device in Expo Go, this opens the system camera.",
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
      quality: 0.85,
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
      Alert.alert("Photos need permission", "Allow photo access, or use the sample tab.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    draft.setPick(mode, {
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
  }

  return (
    <AppShell>
      <InterviewChrome
        step={2}
        total={8}
        kicker="The receipt"
        title="How should we add the tab?"
        onBack={() => router.back()}
        footer={
          <PrimaryButton
            disabled={draft.pickMode === null}
            onPress={() => router.push("/host/parsing")}
          >
            {draft.pickMode === "sample" ? "Use the sample bar tab" : "Continue"}
          </PrimaryButton>
        }
      >
        <View style={styles.list}>
          <ChoiceRow
            icon={<Camera size={20} color={colors.ink} />}
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
            icon={<ImageIcon size={20} color={colors.ink} />}
            title="Choose from library"
            hint="JPEG, PNG, or a screenshot"
            selected={draft.pickMode === "library"}
            onPress={() => void pickLibrary()}
          />
          <ChoiceRow
            icon={<Sparkles size={20} color={colors.ink} />}
            title="Use the sample bar tab"
            hint="Wine package vs apple juice — no camera"
            selected={draft.pickMode === "sample"}
            onPress={() => draft.setPick("sample")}
          />
        </View>
        {draft.image ? (
          <Image source={{ uri: draft.image.uri }} style={styles.preview} />
        ) : null}
        <Text style={styles.note}>
          Photos are read on the server. You still review every line. If scanning isn't
          available, we use the sample bar tab so you can keep going.
        </Text>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  preview: {
    marginTop: 16,
    height: 180,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  note: { marginTop: 16, fontSize: 12, lineHeight: 18, color: colors.muted },
});
