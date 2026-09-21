import Svg, { Path } from "react-native-svg";
import { colors } from "@/lib/theme";

/**
 * Header mark matching the app icon: merlot bottle with four jagged splits.
 * Filled so it reads at ~22px in the top-left chrome.
 */
export function WineMark({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* cork */}
      <Path d="M22.2 3.5h3.6v3.2h-3.6V3.5Z" fill={colors.merlot} />
      {/* neck */}
      <Path d="M21.4 6.7h5.2v6.8h-5.2V6.7Z" fill={colors.merlot} />
      {/* segment 1 (shoulder) */}
      <Path
        d="M16.5 13.5h15v5.2l-2.2 1.1-2.4-1.3-2.6 1.4-2.5-1.2-2.3 1.2-3-1.2V13.5Z"
        fill={colors.merlot}
      />
      {/* segment 2 */}
      <Path
        d="M16.5 21.2l3 .9 2.3-1.1 2.5 1.2 2.6-1.3 2.4 1.2 2.2-1 0 5.4-2.1 1.1-2.5-1.2-2.5 1.3-2.6-1.2-2.4 1.1-2.9-1.1v-5.3Z"
        fill={colors.merlot}
      />
      {/* segment 3 */}
      <Path
        d="M16.5 28.8l2.9.9 2.4-1.1 2.6 1.2 2.5-1.2 2.5 1.1 2.1-.9v5.5l-2 .9-2.6-1.1-2.5 1.2-2.6-1.2-2.4 1.1-2.9-.9v-5.4Z"
        fill={colors.merlot}
      />
      {/* segment 4 */}
      <Path
        d="M16.5 36.4l2.9.8 2.4-1 2.6 1.1 2.5-1.1 2.6 1.1 2-.8v5.2a3 3 0 0 1-3 3H19.5a3 3 0 0 1-3-3v-5.3Z"
        fill={colors.merlot}
      />
    </Svg>
  );
}
