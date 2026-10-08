import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { ReactNode, RefObject } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Home } from "lucide-react-native";
import { useKeyboardVisible } from "@/hooks/use-keyboard-visible";
import { Motif, type MotifName } from "@/components/motifs";
import { colors, type } from "@/lib/theme";
import { HostSupportTip } from "./host-support-tip";
import { PressScale } from "./press-scale";

/** Product name stays English — brands aren't translated. */
const BRAND = "Split the Wine";

/** Brand bar under the status-bar inset. Interview chrome starts below it. */
const APP_HEADER_HEIGHT = 48;

/**
 * Sticky footer padding while the keyboard is open. Host items adds this
 * to the footer slot height when scrolling a row clear of the bar.
 */
export const FOOTER_PADDING_TOP = 12;
export const FOOTER_PADDING_KEYBOARD_BOTTOM = 8;

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
          <Motif name="split-bottle" size={22} color={colors.merlot} />
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
  motif,
  title,
  onBack,
  onHome,
  children,
  footer,
  keyboard = true,
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
  /** Track offset so a screen can scroll a focused field clear of the footer. */
  onScroll,
}: {
  step: number;
  total: number;
  kicker?: string;
  /** Atmosphere beside the kicker. Carries no meaning the kicker doesn't. */
  motif?: MotifName;
  title: string;
  onBack?: () => void;
  /** Jump to host desk without stacking Back through every step. */
  onHome?: () => void;
  children: ReactNode;
  /** Omit to leave the step unscrolled by a pinned bar (plan-outing place/date). */
  footer?: ReactNode;
  /** Keyboard avoiding — default on; pass false only if a screen must opt out. */
  keyboard?: boolean;
  dense?: boolean;
  sparse?: boolean;
  scroll?: boolean;
  supportTip?: boolean;
  hideProgress?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const keyboardOpen = useKeyboardVisible();
  const insets = useSafeAreaInsets();
  const progress = (step / total) * 100;
  const kickerStyle = [
    styles.kicker,
    dense && styles.kickerDense,
    sparse && styles.kickerSparse,
  ];
  const heading = (
    <>
      {kicker && motif ? (
        <View
          style={[
            styles.kickerRow,
            dense && styles.kickerRowDense,
            sparse && styles.kickerRowSparse,
          ]}
        >
          <Motif name={motif} size={15} color={colors.merlot} opacity={0.8} />
          <Text allowFontScaling style={[kickerStyle, styles.kickerInRow]}>
            {kicker}
          </Text>
        </View>
      ) : kicker ? (
        <Text allowFontScaling style={kickerStyle}>
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
        keyboardOpen && styles.scrollContentKeyboard,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 16 : undefined}
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
        <SafeAreaView
          edges={keyboardOpen ? [] : ["bottom"]}
          style={[styles.footer, keyboardOpen && styles.footerKeyboard]}
        >
          {footer}
          {supportTip && !keyboardOpen ? <HostSupportTip /> : null}
        </SafeAreaView>
      ) : null}
    </>
  );

  // Default on for all interview screens; pass keyboard={false} to opt out.
  if (!keyboard) {
    return <View style={styles.chrome}>{inner}</View>;
  }

  // onLayout y is parent-relative (0 under the brand bar). RN treats
  // keyboardVerticalOffset as the distance from the top of the screen to this
  // view, so the status-bar inset + brand bar have to be included or the
  // sticky footer stays partly under the keyboard.
  const keyboardVerticalOffset =
    Platform.OS === "ios" ? insets.top + APP_HEADER_HEIGHT : 0;

  return (
    <KeyboardAvoidingView
      style={styles.chrome}
      // iOS: pad so sticky CTAs sit above the keyboard.
      // Android: app.json uses softwareKeyboardLayoutMode "resize" — skip
      // behavior="height" so we don't double-shrink and fight the bottom nav.
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
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
  const locked = Boolean(disabled) || busy || !onPress;
  // Busy keeps the merlot fill and spinner. Disabled is a flat chrome button.
  const showDisabled = !busy && locked;
  return (
    <PressScale
      onPress={onPress}
      disabled={locked}
      haptic="light"
      style={[styles.primary, showDisabled && styles.primaryDisabled]}
    >
      {busy ? (
        <ActivityIndicator color={colors.merlotFg} />
      ) : (
        <Text
          allowFontScaling
          style={[styles.primaryText, showDisabled && styles.primaryTextDisabled]}
        >
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
      <Text allowFontScaling style={[styles.quietText, disabled && styles.quietTextDisabled]}>
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
    height: APP_HEADER_HEIGHT,
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
  scroll: { flex: 1, minHeight: 0 },
  scrollFill: { flex: 1, minHeight: 0 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  scrollContentDense: { paddingTop: 10, paddingBottom: 8 },
  scrollContentSparse: { flexGrow: 1, paddingTop: 28, paddingBottom: 32 },
  scrollContentKeyboard: { paddingBottom: 24 },
  kicker: { fontSize: type.kicker, fontWeight: "600", color: colors.inkSoft, marginBottom: 4 },
  kickerDense: { marginBottom: 2, fontSize: 12 },
  kickerSparse: { fontSize: 14, marginBottom: 8 },
  /** Spacing moves to the row so the motif and kicker share one baseline. */
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  kickerRowDense: { marginBottom: 2 },
  kickerRowSparse: { marginBottom: 8 },
  kickerInRow: { marginBottom: 0 },
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
    paddingTop: FOOTER_PADDING_TOP,
    gap: 6,
    // Match host desk / live-board bottom nav contrast.
    shadowColor: "#2A241C",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  footerKeyboard: {
    // Keyboard already covers the home indicator — drop extra bottom chrome.
    paddingBottom: FOOTER_PADDING_KEYBOARD_BOTTOM,
    shadowOpacity: 0,
    elevation: 0,
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
  primaryDisabled: { backgroundColor: colors.chromeBorder },
  primaryText: { color: colors.merlotFg, fontSize: 16, fontWeight: "700" },
  primaryTextDisabled: { color: colors.inkFirm },
  quiet: {
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  quietText: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  quietTextDisabled: { color: colors.muted },
});
