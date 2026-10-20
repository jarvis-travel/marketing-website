/** Concentric contour rings, the Meridian motif: Moonlight at 13% on navy.
 *  pointer-events-none so the overlay can never intercept clicks on content. */
export function ContourArcs({ className }: { className: string }) {
  return (
    <svg
      className={`pointer-events-none ${className}`}
      viewBox="0 0 520 520"
      fill="none"
      aria-hidden="true"
    >
      {[130, 170, 210, 250].map((r) => (
        <circle
          key={r}
          cx="260"
          cy="260"
          r={r}
          stroke="#F0EEEB"
          strokeOpacity="0.13"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}
