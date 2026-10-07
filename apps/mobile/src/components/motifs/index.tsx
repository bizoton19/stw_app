/**
 * Native motif kit — the same ten names as `src/components/motifs/index.tsx`, drawn
 * with `react-native-svg` primitives. Sources: `plans/motifs/*.svg`.
 *
 * `currentColor` does not inherit through react-native-svg the way it does on web, so
 * colour arrives as an explicit `color` prop and defaults to the day merlot. Motifs
 * are atmosphere; affordances stay lucide.
 */

import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { colors } from "@/lib/theme";

const STROKE = 1.6;

export type MotifName =
  | "split-bottle"
  | "stem"
  | "pour"
  | "check-stub"
  | "coupe-pair"
  | "carafe"
  | "cork"
  | "label-band"
  | "grapes"
  | "split-wash";

const VIEW_BOX: Record<MotifName, string> = {
  "split-bottle": "0 0 48 48",
  stem: "0 0 48 48",
  pour: "0 0 48 48",
  "check-stub": "0 0 48 48",
  "coupe-pair": "0 0 48 48",
  carafe: "0 0 48 48",
  cork: "0 0 48 48",
  "label-band": "0 0 48 48",
  grapes: "0 0 48 48",
  "split-wash": "0 0 160 160",
};

/** The jagged split, repeated — the through-line of every motif. */
const SPLIT = "l3 .9 2.4-1.1 2.6 1.2 2.5-1.2 2.5 1.1 2.6-.9";
const WASH_ROW =
  "l16 4.6 12.6-5.6 13.6 6.2 13.2-6.2 13.2 5.8 13.6-5.4 13.4 5.6 13.6-5.2 14 5.4 13.8-4.8";

function Body({ name }: { name: MotifName }) {
  switch (name) {
    case "split-bottle":
      return (
        <>
          <Path d="M21.7 5.2h4.6v4.2h-4.6z" />
          <Path d="M21.1 9.4h5.8v4.6h-5.8z" />
          <Path d="M16.7 14h14.6v24.4a4.2 4.2 0 0 1-4.2 4.2h-6.2a4.2 4.2 0 0 1-4.2-4.2z" />
          <Path d={`M16.7 21.2${SPLIT}`} opacity={0.85} />
          <Path d={`M16.7 28.8${SPLIT}`} opacity={0.85} />
          <Path d={`M16.7 36.4${SPLIT}`} opacity={0.85} />
        </>
      );
    case "stem":
      return (
        <>
          <Path d="M15 9h18l-1.6 11.4a7.6 7.6 0 0 1-14.8 0z" />
          <Path d="M16.4 17.6h15.2" strokeDasharray="0.1 3.4" opacity={0.7} />
          <Path d="M24 27.8v10" />
          <Path d="M17.8 38.6h12.4" />
        </>
      );
    case "pour":
      return (
        <>
          <Path d="M14.5 6.5c8.6 5.4 12.6 12.4 11.4 20.8" />
          <Path d="M25.9 27.3c-.5 2.4-1.8 4.3-3.9 5.6" opacity={0.8} />
          <Ellipse cx={24} cy={37.5} rx={10.5} ry={3.2} />
          <Path
            d="M13.5 37.5c3.2 1.6 7 2.4 10.5 2.4s7.3-.8 10.5-2.4"
            opacity={0.45}
          />
        </>
      );
    case "check-stub":
      return (
        <>
          <Path d="M12 6.5h24v29.8l-4 2.6-4-2.6-4 2.6-4-2.6-4 2.6-4-2.6z" />
          <Path d="M17.2 14.2h13.6" opacity={0.85} />
          <Path d="M17.2 20.2h13.6" opacity={0.7} />
          <Path d="M17.2 26.2h8.4" opacity={0.55} />
        </>
      );
    case "coupe-pair":
      return (
        <>
          <G transform="rotate(-13 17 24)">
            <Path d="M9 11h13l-1.2 8.4a5.6 5.6 0 0 1-10.6 0z" />
            <Path d="M15.5 25.2v9" />
            <Path d="M10.8 35.2h9.4" />
          </G>
          <G transform="rotate(13 31 24)">
            <Path d="M26 11h13l-1.2 8.4a5.6 5.6 0 0 1-10.6 0z" />
            <Path d="M32.5 25.2v9" />
            <Path d="M27.8 35.2h9.4" />
          </G>
        </>
      );
    case "carafe":
      return (
        <>
          <Path d="M20.6 6h6.8v6.4l6 9.2a9 9 0 0 1 1.4 4.8v9.4a6 6 0 0 1-6 6H20.2a6 6 0 0 1-6-6v-9.4a9 9 0 0 1 1.4-4.8l6-9.2z" />
          <Path
            d="M14.4 28.6l3.4 1 2.6-1.2 2.8 1.3 2.7-1.3 2.7 1.2 2.9-1"
            opacity={0.85}
          />
          <Path d="M19.4 12.4h9.2" opacity={0.6} />
        </>
      );
    case "cork":
      return (
        <>
          <Path d="M18 8.5h12a2.4 2.4 0 0 1 2.4 2.4v26.2a2.4 2.4 0 0 1-2.4 2.4H18a2.4 2.4 0 0 1-2.4-2.4V10.9A2.4 2.4 0 0 1 18 8.5z" />
          <Path d="M16.4 17.4h15.2" opacity={0.6} />
          <Path d="M16.4 24h15.2" opacity={0.6} />
          <Path d="M16.4 30.6h15.2" opacity={0.6} />
        </>
      );
    case "label-band":
      return (
        <>
          <Path d="M7 15.5h34a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
          <Path d="M5 20.5h38" opacity={0.55} />
          <Path d="M5 27.5h38" opacity={0.55} />
          <Path d="M19.6 24h8.8" opacity={0.8} />
        </>
      );
    case "grapes":
      return (
        <>
          <Path d="M24 7v6.4" />
          <Path d="M24.4 10.6c2.6-.4 4.6-1.8 5.6-3.8" opacity={0.7} />
          <Circle cx={24} cy={17.6} r={4.2} />
          <Circle cx={18.2} cy={25} r={4.2} />
          <Circle cx={29.8} cy={25} r={4.2} />
          <Circle cx={24} cy={32.4} r={4.2} />
          <Circle cx={24} cy={25} r={4.2} opacity={0.4} />
        </>
      );
    case "split-wash":
      return (
        <G strokeWidth={2.4}>
          <Path d={`M-10 34${WASH_ROW}`} />
          <Path d={`M-10 74${WASH_ROW}`} />
          <Path d={`M-10 114${WASH_ROW}`} />
        </G>
      );
  }
}

export function Motif({
  name,
  size = 16,
  color = colors.merlot,
  opacity,
}: {
  name: MotifName;
  size?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={VIEW_BOX[name]}
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    >
      <Body name={name} />
    </Svg>
  );
}
