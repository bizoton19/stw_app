import { StyleSheet, Text, View } from "react-native";
import type { PayMethod } from "@/lib/types";
import { PAY_METHOD_META } from "@/lib/pay";

export function PayMethodIcon({
  method,
  size = 28,
}: {
  method: PayMethod;
  size?: number;
}) {
  const meta = PAY_METHOD_META[method];
  const radius = Math.max(6, Math.round(size * 0.28));
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
      <Text style={[styles.mark, { fontSize: Math.round(size * 0.45) }]}>{meta.mark}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: "center", justifyContent: "center" },
  mark: { color: "#FFFFFF", fontWeight: "800" },
});
