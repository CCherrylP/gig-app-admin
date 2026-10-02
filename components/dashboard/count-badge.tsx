import { cn } from "@/lib/utils";

// HOW MANY THINGS ARE WAITING, in red, in one place.
//
// WHY THIS EXISTS. Every surface that shows one of these numbers had its own
// idea of what it looked like: the sidebar used `SidebarMenuBadge`, which is a
// plain number in the sidebar's own text colour and reads as a label rather than
// as work; the tab bars and the to-do list used a soft amber pill; and the header
// bell used a third thing. None of them read as a notification, which is the one
// job they all have — so "is anything waiting" was a question you answered by
// reading the dashboard carefully instead of by glancing at it.
//
// TWO TONES, AND THEY ARE DOING DIFFERENT JOBS. It is tempting to pick one and
// be consistent, and that would be the wrong kind of consistency:
//
//   red     THE MARK. Solid, on the nav and on the bell — the thing peripheral
//           vision catches from across a screen you are not reading. It answers
//           "is there anything", which is the question somebody has while doing
//           something else, and it is the half this dashboard was missing.
//   amber   THE COUNT IN CONTEXT. A soft pill in a tab bar, a to-do row, a
//           panel — somewhere the eye is already looking and the number is the
//           content rather than the alarm. Red everywhere would make a screen
//           with eight queues on it read as eight alarms, and then none of them
//           reads as one.
//
// Same component, so the shape, the width, the cap and the "nothing at zero"
// rule cannot drift between the two.

/** The badge. Renders NOTHING at zero — an explicit "0" is a line of noise on
 *  every row of a clear dashboard, and "nothing waiting" is better said by the
 *  absence of a mark than by a number. */
export function CountBadge({
  count,
  tone = "red",
  className,
}: {
  count: number | undefined;
  /** `red` is the mark, `amber` is the count in context. See the note above. */
  tone?: "red" | "amber";
  className?: string;
}) {
  if (!count || count < 1) return null;

  return (
    <span
      className={cn(
        "inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
        tone === "red"
          ? "bg-red-500 text-white"
          : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
        className,
      )}
    >
      {/* Capped so a pathological number cannot stretch a nav rail or a tab. The
          decision it drives is "open this queue", and 150 is no more persuasive
          than 99+. */}
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** The DOT, for where a full number does not fit: the sidebar collapsed to
 *  icons, and the corner of the header bell.
 *
 *  It still carries a number up to nine, because "how many" is most of the value
 *  — one certificate and fourteen are different mornings. Past that it becomes a
 *  plain dot, since three characters at this size are unreadable anyway and the
 *  only question left is whether to look.
 *
 *  `ring-background` is what keeps it legible on top of whatever it is pinned to:
 *  a red circle overlapping a dark icon loses its edge without it. */
export function CountDot({
  count,
  className,
}: {
  count: number | undefined;
  className?: string;
}) {
  if (!count || count < 1) return null;

  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none inline-flex items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold leading-none text-white ring-2 ring-background",
        count > 9 ? "size-2.5" : "size-4",
        className,
      )}
    >
      {count > 9 ? "" : count}
    </span>
  );
}
