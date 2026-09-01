// Money, dates and coins, formatted the one way.

/** Cents to SGD. The API stores amounts as integer cents so nothing rounds on
 *  the way through; only the screen turns them back into dollars. */
export function money(cents: number) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(cents / 100);
}

export function coins(value: number) {
  return new Intl.NumberFormat("en-SG").format(value);
}

// Every timestamp the API sends is already in Singapore time and carries the
// offset. Pinning the zone here as well means a reviewer working from anywhere
// reads the same clock as the shift they are looking at.
const SGT = "Asia/Singapore";

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-SG", {
    timeZone: SGT,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function date(iso: string | null | undefined) {
  if (!iso) return "—";
  // A plain 'YYYY-MM-DD' is a calendar day, not an instant — parsed as UTC it
  // would slide a day backwards in any zone west of London, so it is read
  // rather than converted.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-SG", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "3 days ago" — how long somebody has been waiting, which is the number that
 *  matters in a queue worked oldest-first. */
export function relative(iso: string | null | undefined) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const minutes = Math.round((then - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en-SG", { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];

  let value = minutes;
  for (const [unit, limit] of units) {
    if (Math.abs(value) < limit) return rtf.format(value, unit);
    value = Math.round(value / limit);
  }
  return rtf.format(value, "year");
}

/** Whether an instant has already passed — an invoice past its due date.
 *
 *  A module function rather than a `Date.now()` at the call site, because the
 *  call site is a component render and reading the clock there is exactly the
 *  impurity React's lint rules reject: the answer changes on a re-render nobody
 *  asked for. */
export function isPast(iso: string | null | undefined) {
  if (!iso) return false;
  const at = new Date(iso).getTime();
  return !Number.isNaN(at) && at < Date.now();
}

/** Whether a calendar day has already gone by. An expired certificate is a
 *  rejection, so the queue says so before anybody clicks approve. */
export function isExpired(day: string | null) {
  if (!day) return false;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: SGT });
  return day.slice(0, 10) < today;
}
