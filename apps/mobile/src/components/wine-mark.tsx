import Svg, { Path } from "react-native-svg";
import { colors } from "@/lib/theme";

export function WineMark({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M16 8h16l-1.8 13.2c-.5 3.6-3.6 6.3-7.2 6.3s-6.7-2.7-7.2-6.3L16 8Z"
        stroke={colors.ink}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <Path
        d="M24 28v10"
        stroke={colors.ink}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Path
        d="M18 40h12"
        stroke={colors.ink}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  );
}
