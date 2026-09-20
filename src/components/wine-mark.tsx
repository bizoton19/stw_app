export function WineMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="M16 8h16l-1.8 13.2c-.5 3.6-3.6 6.3-7.2 6.3s-6.7-2.7-7.2-6.3L16 8Z"
        className="stroke-foreground"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M24 28v10"
        className="stroke-foreground"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M18 40h12"
        className="stroke-foreground"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
