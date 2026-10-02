import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ReactNode, RefObject } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Home } from "lucide-react-native";
import { colors, type } from "@/lib/theme";
import { HostSupportTip } from "./host-support-tip";
import { PressScale } from "./press-scale";
import { WineMark } from "./wine-mark";

/** Product name stays English — brands aren't translated. */
const BRAND = "Split the Wine";

export function AppShell({
  children,
  meta,
}: {
  children: ReactNode;
  meta?: string;
}) {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <WineMark size={26} />
          <Text style={styles.brand} allowFontScaling>
            {BRAND}
          </Text>
          {meta ? (
            <Text
              allowFontScaling
              style={[styles.meta, meta === "Live" && { color: colors.merlot }]}
            >
              {meta}
            </Text>
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
  onHome,
  children,
  footer,
  keyboard = false,
  dense = false,
  /** Short screens: grow content area so body can use vertical space. */
  sparse = false,
  /**
   * When false, title/kicker stay fixed and `children` fill remaining space
   * (use FlatList inside). Default ScrollView wraps kicker+title+children.
   */
  scroll = true,
  /** Quiet Support Split the Wine link under the step footer (host interview). */
  supportTip = false,
  /** Hide “N of M” + progress bar (host live board is not an interview step). */
  hideProgress = false,
  /** Optional ref to the body ScrollView (scroll-to-error, etc.). */
  scrollRef,
}: {
  step: number;
  total: number;
  kicker?: string;
  title: string;
  onBack?: () => void;
  /** Jump to host desk without stacking Back through every step. */
  onHome?: () => void;
  children: ReactNode;
  /** Omit to leave the step unscrolled by a pinned bar (plan-outing place/date). */
  footer?: ReactNode;
  keyboard?: boolean;
  dense?: boolean;
  sparse?: boolean;
  scroll?: boolean;
  supportTip?: boolean;
  hideProgress?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const progress = (step / total) * 100;
  const heading = (
    <>
      {kicker ? (
        <Text
          allowFontScaling
          style={[styles.kicker, dense && styles.kickerDense, sparse && styles.kickerSparse]}
        >
          {kicker}
        </Text>
      ) : null}
      <Text
        allowFontScaling
        style={[styles.title, dense && styles.titleDense, sparse && styles.titleSparse]}
      >
        {title}
      </Text>
    </>
  );

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        dense && styles.scrollContentDense,
        sparse && styles.scrollContentSparse,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      contentInsetAdjustmentBehavior="automatic"
      bounces={Platform.OS === "ios"}
      overScrollMode={Platform.OS === "android" ? "auto" : undefined}
    >
      {heading}
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
  ) : (
    <View style={styles.scrollFill}>
      <View style={[styles.scrollContent, dense && styles.scrollContentDense]}>
        {heading}
      </View>
      <View
        style={[
          styles.childrenFill,
          dense && styles.childrenDense,
          sparse && styles.childrenSparse,
        ]}
      >
        {children}
      </View>
    </View>
  );

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
              hitSlop={8}
            >
              <ChevronLeft size={26} color={colors.ink} />
            </PressScale>
          ) : (
            <View style={styles.backBtn} />
          )}
          {hideProgress ? (
            <View style={styles.stepLabelSpacer} />
          ) : (
            <Text allowFontScaling style={styles.stepLabel}>
              {step} of {total}
            </Text>
          )}
          {onHome ? (
            <PressScale
              accessibilityLabel="Home"
              onPress={onHome}
              haptic={false}
              style={styles.backBtn}
              hitSlop={8}
            >
              <Home size={22} color={colors.ink} strokeWidth={2.25} />
            </PressScale>
          ) : (
            <View style={styles.backBtn} />
          )}
        </View>
        {hideProgress ? null : (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
        )}
      </View>
      {body}
      {footer != null || supportTip ? (
        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          {footer}
          {supportTip ? <HostSupportTip /> : null}
        </SafeAreaView>
      ) : null}
    </>
  );

  if (!keyboard) {
    return <View style={styles.chrome}>{inner}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.chrome}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 56 : 0}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}

/** Quiet helper under the sticky CTA — fills footer without competing with the button. */
export function FooterHint({ children }: { children: string }) {
  return (
    <Text allowFontScaling style={styles.footerHint}>
      {children}
    </Text>
  );
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
      haptic="light"
      style={styles.primary}
    >
      {busy ? (
        <ActivityIndicator color={colors.merlotFg} />
      ) : (
        <Text allowFontScaling style={styles.primaryText}>
          {children}
        </Text>
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
    <PressScale onPress={onPress} disabled={disabled} haptic={false} style={styles.quiet}>
      <Text allowFontScaling style={styles.quietText}>
        {children}
      </Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  headerSafe: {
    backgroundColor: colors.paper,
    ...Platform.select({
      android: { elevation: 0 },
      ios: {},
    }),
  },
  header: {
    height: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
  stepLabelSpacer: { flex: 1 },
  track: { height: 2, borderRadius: 99, backgroundColor: colors.border, overflow: "hidden" },
  fill: { height: 2, backgroundColor: colors.merlot, borderRadius: 99 },
  scroll: { flex: 1 },
  scrollFill: { flex: 1, minHeight: 0 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  scrollContentDense: { paddingTop: 10, paddingBottom: 8 },
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
  childrenFill: { flex: 1, minHeight: 0, marginTop: 8 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.chromeBorder,
    backgroundColor: colors.chrome,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 6,
    // Match host desk / live-board bottom nav contrast.
    shadowColor: "#2A241C",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
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
    height: Platform.OS === "android" ? 52 : 50,
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
