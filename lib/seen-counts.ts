"use client";

import { useSyncExternalStore } from "react";
import type { AdminCounts } from "@/lib/counts";

// What each queue held the last time somebody looked at it, kept in this browser.
// "New" is the count now minus that, so it survives a reload or the next morning.

type Seen = Partial<Record<keyof AdminCounts, number>>;

const KEY = "adhoc-admin-seen-counts-v1";
const listeners = new Set<() => void>();

let cache: Seen | null | undefined;

function read(): Seen | null {
  if (cache !== undefined) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function write(next: Seen) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private window or storage blocked: "new" just lasts for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stored snapshot right now, outside React. Null before the first visit. */
export const readSeen = (): Seen | null => read();

/** The stored snapshot, or null before this browser has ever seen the counts. */
export function useSeen(): Seen | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** First visit: everything counts as already seen, so day one is not all "new". */
export function seedSeen(counts: AdminCounts) {
  if (read() === null) write({ ...counts });
}

/** Mark one queue as looked at, at its current count. */
export function markSeen(key: keyof AdminCounts, count: number) {
  const seen = read() ?? {};
  if (seen[key] !== count) write({ ...seen, [key]: count });
}

/** A queue that went down (work cleared) lowers its mark, so later arrivals still show as new. */
export function lowerSeen(counts: AdminCounts) {
  const seen = read();
  if (!seen) return;

  let changed = false;
  const next = { ...seen };
  for (const key of Object.keys(counts) as (keyof AdminCounts)[]) {
    const now = counts[key] ?? 0;
    if ((next[key] ?? 0) > now) {
      next[key] = now;
      changed = true;
    }
  }
  if (changed) write(next);
}

/** How many in a queue arrived since it was last looked at. */
export const freshIn = (seen: Seen | null, counts: AdminCounts | undefined, key: keyof AdminCounts) =>
  seen && counts ? Math.max(0, (counts[key] ?? 0) - (seen[key] ?? 0)) : 0;

/** The snapshot as full counts, for comparing with arrivalSentence. */
export const seenAsCounts = (seen: Seen): AdminCounts =>
  ({
    certificates: 0,
    appeals: 0,
    employers: 0,
    attendance: 0,
    invoices: 0,
    support: 0,
    ...seen,
  }) as AdminCounts;
