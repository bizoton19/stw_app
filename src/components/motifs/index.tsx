/**
 * Motif kit — see plans/card-design-themes.md §2. Sources: plans/motifs/*.svg.
 *
 * Every motif is stroke-only and paints with `currentColor`, so one definition
 * serves every theme. Motifs never set their own colour and never reserve
 * layout space: making `<Motif>` return `null` removes them with no reflow.
 *
 * These are atmosphere. Affordances (copy, share, back) stay lucide.
 */

const S = 1.6;

type MotifDef = { viewBox: string; width: number; height: number; body: React.ReactNode };

/** The signature — line-art sibling of the filled `WineMark`. */
const splitBottle: MotifDef = {
  viewBox: "0 0 48 48",
  width: 48,
  height: 48,
  body: (
    <>
      <path d="M21.7 5.2h4.6v4.2h-4.6z" />
      <path d="M21.1 9.4h5.8v4.6h-5.8z" />
      <path d="M16.7 14h14.6v24.4a4.2 4.2 0 0 1-4.2 4.2h-6.2a4.2 4.2 0 0 1-4.2-4.2z" />
      <path d="M16.7 21.2l3 .9 2.4-1.1 2.6 1.2 2.5-1.2 2.5 1.1 2.6-.9" opacity=".85" />
      <path d="M16.7 28.8l3 .9 2.4-1.1 2.6 1.2 2.5-1.2 2.5 1.1 2.6-.9" opacity=".85" />
      <path d="M16.7 36.4l3 .9 2.4-1.1 2.6 1.2 2.5-1.2 2.5 1.1 2.6-.9" opacity=".85" />
    </>
  ),
};

/** A single glass. Drink line marker. */
const stem: MotifDef = {
  viewBox: "0 0 48 48",
  width: 48,
  height: 48,
  body: (
    <>
      <path d="M15 9h18l-1.6 11.4a7.6 7.6 0 0 1-14.8 0z" />
      <path d="M16.4 17.6h15.2" strokeDasharray="0.1 3.4" opacity=".7" />
      <path d="M24 27.8v10" />
      <path d="M17.8 38.6h12.4" />
    </>
  ),
};

/** Stream and pool. The settle moment — the one motif allowed to animate. */
const pour: MotifDef = {
  viewBox: "0 0 48 48",
  width: 48,
  height: 48,
  body: (
    <>
      <path d="M14.5 6.5c8.6 5.4 12.6 12.4 11.4 20.8" />
      <path d="M25.9 27.3c-.5 2.4-1.8 4.3-3.9 5.6" opacity=".8" />
      <ellipse cx="24" cy="37.5" rx="10.5" ry="3.2" />
      <path d="M13.5 37.5c3.2 1.6 7 2.4 10.5 2.4s7.3-.8 10.5-2.4" opacity=".45" />
    </>
  ),
};

/** Itemized bill with a torn foot. "The tab" / food line marker. */
const checkStub: MotifDef = {
  viewBox: "0 0 48 48",
  width: 48,
  height: 48,
  body: (
    <>
      <path d="M12 6.5h24v29.8l-4 2.6-4-2.6-4 2.6-4-2.6-4 2.6-4-2.6z" />
      <path d="M17.2 14.2h13.6" opacity=".85" />
      <path d="M17.2 20.2h13.6" opacity=".7" />
      <path d="M17.2 26.2h8.4" opacity=".55" />
    </>
  ),
};

/** Two glasses leaning in. Share / invite kicker. */
const coupePair: MotifDef = {
  viewBox: "0 0 48 48",
  width: 48,
  height: 48,
  body: (
    <>
      <g transform="rotate(-13 17 24)">
        <path d="M9 11h13l-1.2 8.4a5.6 5.6 0 0 1-10.6 0z" />
        <path d="M15.5 25.2v9" />
        <path d="M10.8 35.2h9.4" />
      </g>
      <g transform="rotate(13 31 24)">
        <path d="M26 11h13l-1.2 8.4a5.6 5.6 0 0 1-10.6 0z" />
        <path d="M32.5 25.2v9" />
        <path d="M27.8 35.2h9.4" />
      </g>
    </>
  ),
};

/** The shared pour. Shared or split lines. */
const carafe: MotifDef = {
  viewBox: "0 0 48 48",
  width: 48,
  height: 48,
  body: (
    <>
      <path d="M20.6 6h6.8v6.4l6 9.2a9 9 0 0 1 1.4 4.8v9.4a6 6 0 0 1-6 6H20.2a6 6 0 0 1-6-6v-9.4a9 9 0 0 1 1.4-4.8l6-9.2z" />
      <path d="M14.4 28.6l3.4 1 2.6-1.2 2.8 1.3 2.7-1.3 2.7 1.2 2.9-1" opacity=".85" />
      <path d="M19.4 12.4h9.2" opacity=".6" />
    </>
  ),
};

/** Opened, not sealed. "The night started" — host desk, outing cards. */
const cork: MotifDef = {
  viewBox: "0 0 48 48",
  width: 48,
  height: 48,
  body: (
    <>
      <path d="M18 8.5h12a2.4 2.4 0 0 1 2.4 2.4v26.2a2.4 2.4 0 0 1-2.4 2.4H18a2.4 2.4 0 0 1-2.4-2.4V10.9A2.4 2.4 0 0 1 18 8.5z" />
      <path d="M16.4 17.4h15.2" opacity=".6" />
      <path d="M16.4 24h15.2" opacity=".6" />
      <path d="M16.4 30.6h15.2" opacity=".6" />
    </>
  ),
};

/** A wine label as a rule. Venue kicker ornament. */
const labelBand: MotifDef = {
  viewBox: "0 0 48 48",
  width: 48,
  height: 48,
  body: (
    <>
      <path d="M7 15.5h34a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
      <path d="M5 20.5h38" opacity=".55" />
      <path d="M5 27.5h38" opacity=".55" />
      <path d="M19.6 24h8.8" opacity=".8" />
    </>
  ),
};

/** Abstract cluster. Decorative only — the easiest motif to overuse. */
const grapes: MotifDef = {
  viewBox: "0 0 48 48",
  width: 48,
  height: 48,
  body: (
    <>
      <path d="M24 7v6.4" />
      <path d="M24.4 10.6c2.6-.4 4.6-1.8 5.6-3.8" opacity=".7" />
      <circle cx="24" cy="17.6" r="4.2" />
      <circle cx="18.2" cy="25" r="4.2" />
      <circle cx="29.8" cy="25" r="4.2" />
      <circle cx="24" cy="32.4" r="4.2" />
      <circle cx="24" cy="25" r="4.2" opacity=".4" />
    </>
  ),
};

/** Oversized jagged splits. Card watermark — use the `.stw-wash` utility. */
const splitWash: MotifDef = {
  viewBox: "0 0 160 160",
  width: 160,
  height: 160,
  body: (
    <g strokeWidth={2.4}>
      <path d="M-10 34l16 4.6 12.6-5.6 13.6 6.2 13.2-6.2 13.2 5.8 13.6-5.4 13.4 5.6 13.6-5.2 14 5.4 13.8-4.8" />
      <path d="M-10 74l16 4.6 12.6-5.6 13.6 6.2 13.2-6.2 13.2 5.8 13.6-5.4 13.4 5.6 13.6-5.2 14 5.4 13.8-4.8" />
      <path d="M-10 114l16 4.6 12.6-5.6 13.6 6.2 13.2-6.2 13.2 5.8 13.6-5.4 13.4 5.6 13.6-5.2 14 5.4 13.8-4.8" />
    </g>
  ),
};

const MOTIFS = {
  "split-bottle": splitBottle,
  stem,
  pour,
  "check-stub": checkStub,
  "coupe-pair": coupePair,
  carafe,
  cork,
  "label-band": labelBand,
  grapes,
  "split-wash": splitWash,
} satisfies Record<string, MotifDef>;

export type MotifName = keyof typeof MOTIFS;

export function Motif({
  name,
  size = 16,
  className,
  style,
  title,
}: {
  name: MotifName;
  /** Rendered edge length. Ignored when `className` sizes the element. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Omit unless the motif carries meaning no nearby text already carries. */
  title?: string;
}) {
  const motif = MOTIFS[name];
  const ratio = motif.height / motif.width;
  return (
    <svg
      viewBox={motif.viewBox}
      width={size}
      height={Math.round(size * ratio)}
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={S}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {motif.body}
    </svg>
  );
}

/**
 * Card watermark. Absolutely positioned and masked, so it reflows nothing —
 * the parent needs `position: relative` and `overflow: hidden`.
 */
export function CardWash({ className }: { className?: string }) {
  return <Motif name="split-wash" className={`stw-wash ${className ?? ""}`} />;
}
