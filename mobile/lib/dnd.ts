// Fractional-position math for drag reordering, mirroring the web app's
// src/lib/dnd.ts. Keeping items at midpoints avoids renumbering on every move.

/** New position for an item now sitting at `index` in an ordered list. */
export function positionForIndex(
  ordered: { position: number }[],
  index: number,
): number {
  const prev = ordered[index - 1];
  const next = ordered[index + 1];
  if (prev && next) return (prev.position + next.position) / 2;
  if (prev) return prev.position + 1000;
  if (next) return next.position - 1000;
  return 1000;
}
