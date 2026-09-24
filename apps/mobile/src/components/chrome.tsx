import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { colors, type } from "@/lib/theme";
import { PressScale } from "./press-scale";
import { WineMark } from "./wine-mark";

/** Product name stays English — brands aren't translated. */
const BRAND = "Split the Wine";

export function AppShell({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: string;
}) {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <WineMark size={26} />
          <Text style={styles.brand}>{BRAND}</Text>
          {meta ? (
            <Text style={[styles.meta, meta === "Live" && { color: colors.merlot }]}>{meta}</Text>
          ) : null}
        </View>
      </SafeAreaView>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

export function InterviewChrome({
  step,
  total,
  kicker,
  title,
  onBack,
  children,
  footer,
  keyboard = false,
  dense = false,
  /** Short screens: grow content area so body can use vertical space. */
  sparse = false,
}: {
  step: number;
  total: number;
  kicker?: string;
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  keyboard?: boolean;
  dense?: boolean;
  sparse?: boolean;
}) {
  const progress = (step / total) * 100;
  const inner = (
    <>
      <View style={styles.progressWrap}>
        <View style={styles.navRow}>
          {onBack ? (
            <PressScale
              accessibilityLabel="Back"
              onPress={onBack}
              haptic={false}
              style={styles.backBtn}
            >
              <ChevronLeft size={26} color={colors.ink} />
            </PressScale>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.stepLabel}>
            {step} of {total}
          </Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          dense && styles.scrollContentDense,
          sparse && styles.scrollContentSparse,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {kicker ? (
          <Text style={[styles.kicker, dense && styles.kickerDense, sparse && styles.kickerSparse]}>
            {kicker}
          </Text>
        ) : null}
        <Text
          style={[styles.title, dense && styles.titleDense, sparse && styles.titleSparse]}
        >
          {title}
        </Text>
        <View
          style={[
            styles.children,
            dense && styles.childrenDense,
            sparse && styles.childrenSparse,
          ]}
        >
          {children}
        </View>
      </ScrollView>
      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        {footer}
      </SafeAreaView>
    </>
  );

  if (!keyboard) {
    return <View style={styles.chrome}>{inner}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.chrome}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}

/** Quiet helper under the sticky CTA — fills footer without competing with the button. */
export function FooterHint({ children }: { children: string }) {
  return <Text style={styles.footerHint}>{children}</Text>;
}

export function PrimaryButton({
  children,
  onPress,
  disabled,
  busy,
}: {
  children: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled || busy || !onPress}
      style={styles.primary}
    >
      {busy ? (
        <ActivityIndicator color={colors.merlotFg} />
      ) : (
        <Text style={styles.primaryText}>{children}</Text>
      )}
    </PressScale>
  );
}

export function QuietButton({
  children,
  onPress,
  disabled,
}: {
  children: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <PressScale onPress={onPress} disabled={disabled} style={styles.quiet}>
      <Text style={styles.quietText}>{children}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  headerSafe: { backgroundColor: colors.paper },
  header: {
    height: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brand: { fontSize: 13, fontWeight: "600", color: colors.ink, flex: 1 },
  meta: { fontSize: 11, fontWeight: "600", color: colors.inkSoft },
  body: { flex: 1, minHeight: 0 },
  chrome: { flex: 1, minHeight: 0 },
  progressWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  navRow: { height: 44, flexDirection: "row", alignItems: "center" },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: type.step,
    fontWeight: "600",
    color: colors.inkSoft,
  },
  track: { height: 2, borderRadius: 99, backgroundColor: colors.border, overflow: "hidden" },
  fill: { height: 2, backgroundColor: colors.merlot, borderRadius: 99 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  scrollContentDense: { paddingTop: 10, paddingBottom: 12 },
  scrollContentSparse: { flexGrow: 1, paddingTop: 28, paddingBottom: 32 },
  kicker: { fontSize: type.kicker, fontWeight: "600", color: colors.inkSoft, marginBottom: 4 },
  kickerDense: { marginBottom: 2, fontSize: 12 },
  kickerSparse: { fontSize: 14, marginBottom: 8 },
  title: {
    fontSize: type.title,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  titleDense: { fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  titleSparse: { fontSize: 30, lineHeight: 36, letterSpacing: -0.55 },
  children: { marginTop: 12 },
  childrenDense: { marginTop: 10 },
  childrenSparse: { marginTop: 28, flexGrow: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.paper,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 6,
  },
  footerHint: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: colors.inkSoft,
    marginBottom: 4,
  },
  primary: {
    height: 52,
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.merlot,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.merlotFg, fontSize: 16, fontWeight: "700" },
  quiet: {
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  quietText: { color: colors.ink, fontSize: 15, fontWeight: "600" },
});
