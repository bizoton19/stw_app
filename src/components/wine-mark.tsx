export function WineMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="M14 8h20l-2.2 14.4c-.7 4.6-4.6 8-9.3 8h0c-4.7 0-8.6-3.4-9.3-8L14 8Z"
        className="fill-primary"
      />
      <path
        d="M18 12h12l-1.2 8.2c-.4 2.6-2.6 4.5-5.2 4.5h.1c-2.6 0-4.8-1.9-5.2-4.5L18 12Z"
        className="fill-secondary"
      />
      <path d="M24 31v8" className="stroke-primary" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17 41h14" className="stroke-primary" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
