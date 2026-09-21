export function WineMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="M22 4h4v4h-4V4Z"
        className="stroke-foreground"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M21 8h6v7"
        className="stroke-foreground"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 15h16v21a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V15Z"
        className="stroke-foreground"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M20 22h8"
        className="stroke-foreground"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
