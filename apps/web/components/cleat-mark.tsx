/**
 * Straight apricot cleat in a square tile.
 * Dark theme uses the charcoal tile. Light theme uses the cream tile.
 * Which one shows follows the same data-theme rules as the palette.
 */
export function CleatMark({ size, alt = "" }: { size: number; alt?: string }) {
  return (
    <span
      className="cleat-mark"
      style={{ width: size, height: size }}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <img className="cleat-mark-dark" src="/cleat-avatar-dark.png" alt="" width={size} height={size} />
      <img className="cleat-mark-light" src="/cleat-avatar-light.png" alt="" width={size} height={size} />
    </span>
  );
}
