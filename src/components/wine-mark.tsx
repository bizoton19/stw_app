/** Official brand mark — merlot bottle, tilted, four jagged splits (matches app icon). */
export function WineMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: "inline-flex", transform: "rotate(-18deg)" }}
    >
      <svg viewBox="0 0 48 48" fill="none" className="size-full" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.2 3.5h3.6v3.2h-3.6V3.5Z" fill="#6E2E35" />
        <path d="M21.4 6.7h5.2v6.8h-5.2V6.7Z" fill="#6E2E35" />
        <path
          d="M16.5 13.5h15v5.2l-2.2 1.1-2.4-1.3-2.6 1.4-2.5-1.2-2.3 1.2-3-1.2V13.5Z"
          fill="#6E2E35"
        />
        <path
          d="M16.5 21.2l3 .9 2.3-1.1 2.5 1.2 2.6-1.3 2.4 1.2 2.2-1 0 5.4-2.1 1.1-2.5-1.2-2.5 1.3-2.6-1.2-2.4 1.1-2.9-1.1v-5.3Z"
          fill="#6E2E35"
        />
        <path
          d="M16.5 28.8l2.9.9 2.4-1.1 2.6 1.2 2.5-1.2 2.5 1.1 2.1-.9v5.5l-2 .9-2.6-1.1-2.5 1.2-2.6-1.2-2.4 1.1-2.9-.9v-5.4Z"
          fill="#6E2E35"
        />
        <path
          d="M16.5 36.4l2.9.8 2.4-1 2.6 1.1 2.5-1.1 2.6 1.1 2-.8v5.2a3 3 0 0 1-3 3H19.5a3 3 0 0 1-3-3v-5.3Z"
          fill="#6E2E35"
        />
      </svg>
    </span>
  );
}
