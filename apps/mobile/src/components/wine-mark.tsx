import Svg, { Path } from "react-native-svg";
import { colors } from "@/lib/theme";

export function WineMark({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M22 4h4v4h-4V4Z"
        stroke={colors.ink}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <Path
        d="M21 8h6v7"
        stroke={colors.ink}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 15h16v21a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V15Z"
        stroke={colors.ink}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <Path
        d="M20 22h8"
        stroke={colors.ink}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  );
}
