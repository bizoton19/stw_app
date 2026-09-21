import { CLAIMER_COLORS, colorForName, initialsFor } from "@/lib/claimer-color";

export function ClaimerAvatar({
  name,
  size = 28,
}: {
  name: string;
  size?: number;
}) {
  const bg = colorForName(name);
  const fontSize = Math.max(10, Math.round(size * 0.38));
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center font-semibold tracking-wide text-[#FBF8F5]"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        fontSize,
        lineHeight: 1,
      }}
      aria-label={name}
      title={name}
    >
      {initialsFor(name)}
    </span>
  );
}

export { CLAIMER_COLORS, colorForName };
