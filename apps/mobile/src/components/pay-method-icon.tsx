import { Image, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { PayMethod } from "@/lib/types";
import { PAY_METHOD_META } from "@/lib/pay";

/**
 * Official / store tiles when we have them.
 * Zelle stays a glyph on purple (no public Early Warning logo kit).
 */
const OFFICIAL: Partial<Record<PayMethod, number>> = {
  venmo: require("../../assets/pay/official/venmo.png"),
  paypal: require("../../assets/pay/official/paypal.png"),
  cashapp: require("../../assets/pay/official/cashapp.png"),
  moncash: require("../../assets/pay/official/moncash.png"),
  natcash: require("../../assets/pay/official/natcash.png"),
};

const FALLBACK: Partial<Record<PayMethod, string>> = {
  zelle: "M5 5h14v3.2L9.8 16.4H19V19H5v-3.2L14.2 7.6H5V5z",
  other:
    "M12 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z",
};

export function PayMethodIcon({
  method,
  size = 56,
}: {
  method: PayMethod;
  size?: number;
}) {
  const meta = PAY_METHOD_META[method];
  const radius = Math.max(10, Math.round(size * 0.28));
  const official = OFFICIAL[method];

  if (official) {
    return (
      <Image
        accessibilityLabel={meta.label}
        source={official}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  const glyph = FALLBACK[method];
  const inset = Math.round(size * 0.22);
  return (
    <View
      accessibilityLabel={meta.label}
      style={[
        styles.icon,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: meta.brand,
        },
      ]}
    >
      {glyph ? (
        <Svg width={size - inset} height={size - inset} viewBox="0 0 24 24">
          <Path d={glyph} fill="#FFFFFF" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: "center", justifyContent: "center" },
});
