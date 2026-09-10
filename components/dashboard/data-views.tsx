"use client";

import * as React from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export type IconType = Parameters<typeof HugeiconsIcon>[0]["icon"];

// ─── Avatars ──────────────────────────────────────────────────────────────────

export function initials(...parts: (string | undefined | null)[]) {
  const letters = parts
    .map((p) => (p ?? "").trim()[0] ?? "")
    .join("")
    .slice(0, 2);
  return letters.toUpperCase() || "?";
}

const AVATAR_PALETTE = [
  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
];

export function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/** Colored initials avatar. Pass `label` for the visible text and `seed` for the color. */
export function InitialsAvatar({
  seed,
  label,
  className,
}: {
  seed: string;
  label: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      <AvatarFallback
        className={cn("text-xs font-semibold", avatarColor(seed))}
      >
        {label}
      </AvatarFallback>
    </Avatar>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

const DEFAULT_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PUBLISHED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  APPROVED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  LIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  INACTIVE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  CLOSED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  SUSPENDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Generic status badge. Looks up a style by upper-cased status, falls back to neutral. */
export function StatusPill({
  status,
  label,
  styles,
}: {
  status?: string | null;
  label?: string;
  styles?: Record<string, string>;
}) {
  if (!status) return null;
  const key = status.toUpperCase();
  const cls =
    (styles && styles[key]) ??
    DEFAULT_STATUS_STYLES[key] ??
    "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {label ?? titleCase(status)}
    </span>
  );
}

// ─── Detail-modal building blocks ─────────────────────────────────────────────

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

/** Icon + label + value row used inside detail modals. */
export function InfoRow({
  icon,
  label,
  value,
  fullWidth,
}: {
  icon: IconType;
  label: string;
  value?: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", fullWidth && "col-span-2")}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <HugeiconsIcon icon={icon} size={16} strokeWidth={1.5} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="truncate text-sm font-medium">{value ?? "—"}</span>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  count,
  icon,
  cls = "text-primary",
}: {
  label: string;
  count: React.ReactNode;
  icon: IconType;
  cls?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <HugeiconsIcon
            icon={icon}
            strokeWidth={1.5}
            className={cn("size-5", cls)}
          />
        </div>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {count}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

// ─── Queue panel ──────────────────────────────────────────────────────────────

export type QueueRow = {
  key: string;
  seed: string;
  title: string;
  subtitle: string;
  meta: string;
};

/** A queue as a card: who is waiting, oldest first, with a way through to the
 *  page that works it. The Overview shows several of these cut to three rows;
 *  a page dedicated to one queue passes the whole list. */
export function QueuePanel({
  title,
  href,
  linkLabel = "View all",
  icon,
  rows,
  emptyMessage,
  footer,
  onRowClick,
}: {
  title: string;
  href: string;
  linkLabel?: string;
  icon: IconType;
  rows: QueueRow[];
  emptyMessage: string;
  footer?: string;
  /** When given, each row becomes a button. The row IS the thing somebody came
   *  to look at, so opening it should not mean finding a link somewhere else on
   *  the card and then finding the row again in a longer list. */
  onRowClick?: (key: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Link href={href} className="text-xs text-primary hover:underline">
            {linkLabel}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <EmptyState icon={icon} message={emptyMessage} />
        ) : (
          <div className="divide-y">
            {rows.map((row) => {
              const body = (
                <>
                  <InitialsAvatar seed={row.seed} label={initials(row.title)} />
                  <div className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-sm font-medium">
                      {row.title}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.subtitle}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.meta}
                  </span>
                </>
              );

              return onRowClick ? (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => onRowClick(row.key)}
                  className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  {body}
                </button>
              ) : (
                <div key={row.key} className="flex items-center gap-3 px-6 py-3">
                  {body}
                </div>
              );
            })}
          </div>
        )}
        {footer && (
          <p className="border-t px-6 py-3 text-xs text-muted-foreground">
            {footer}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Search input ─────────────────────────────────────────────────────────────

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <HugeiconsIcon
        icon={Search01Icon}
        size={16}
        strokeWidth={1.5}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9"
      />
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

/** A segmented control over one query parameter. The queues are small and the
 *  API filters them server-side, so switching a tab is a fetch rather than a
 *  client-side slice — which is what keeps a second reviewer's decision from
 *  staying invisible in this tab. */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-muted p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
          {option.count != null && option.count > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold tabular-nums text-primary">
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  message,
}: {
  icon: IconType;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
      <HugeiconsIcon icon={icon} strokeWidth={1.5} className="size-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Table shell ──────────────────────────────────────────────────────────────

/** The queues are wide — a certificate row carries a person, a document and two
 *  dates — so the table scrolls inside the card rather than pushing the page
 *  sideways.
 *
 *  Padding is px-4 rather than the px-6 a marketing table would use, and the
 *  floor is 56rem rather than 48rem. Both are the same trade: these tables have
 *  six or seven columns ending in the buttons that make the decision, and a
 *  reviewer who has to scroll sideways to reach Verify is one who will
 *  eventually approve the wrong row. Width spent on gutters is width taken off
 *  the only column that does anything.
 *
 *  `table-fixed` so a long issuer name cannot widen its column past its share —
 *  cells truncate instead, which is why every one of them sets a width. */
export function TableShell({
  headers,
  widths,
  children,
}: {
  headers: React.ReactNode[];
  /** A width per column, e.g. `w-[22%]`. Under `table-fixed` the first row's
   *  widths are the whole of the column sizing — content cannot widen a column
   *  — so this is where a table decides what it is willing to spend on each. */
  widths?: string[];
  children: React.ReactNode;
}) {
  const last = headers.length - 1;

  return (
    <div className="overflow-x-auto">
      {/*
        min-w-5xl, not 3xl. Under `table-fixed` a cell whose content is wider
        than its column does not wrap the column — it SPILLS OVER the next one,
        which is how a status pill ended up underneath a Reject button. The
        percentages are only as good as the width they divide up, so the floor
        has to be wide enough for the narrowest real column (the buttons) to fit
        at its share of it. Below that the table scrolls, which is the honest
        outcome — a queue nobody can read is worse than one that scrolls.
      */}
      <table className="w-full min-w-5xl table-fixed text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            {headers.map((header, i) => (
              <th
                key={i}
                className={cn(
                  "px-4 py-2.5 font-medium",
                  // The last column is always the actions on every one of these
                  // queues, and it is right-aligned to match the buttons under
                  // it — a header sitting left of the thing it labels reads as
                  // belonging to the column before it.
                  i === last && "text-right",
                  widths?.[i],
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-4">
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-44 animate-pulse rounded bg-muted" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-8 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}
