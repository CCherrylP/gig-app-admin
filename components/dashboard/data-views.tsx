"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Download04Icon,
  GridViewIcon,
  Menu01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { lookForPath } from "@/components/dashboard/section-look";

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
        // w-fit so a pill stacked in a flex column keeps its own width instead
        // of being stretched across the cell.
        "inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
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
  hint,
}: {
  label: string;
  count: React.ReactNode;
  icon: IconType;
  cls?: string;
  /** A short line under the number. */
  hint?: React.ReactNode;
}) {
  return (
    // The icon sits on a wash of its own colour (bg-current/10), and the card
    // lifts on hover — a row of these is the first thing on most pages, and a
    // row of grey boxes was most of why the dashboard read as lifeless.
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg bg-current/10",
              cls,
            )}
          >
            <HugeiconsIcon icon={icon} strokeWidth={1.8} className="size-4.5" />
          </span>
        </div>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {count}
        </CardTitle>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
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
  /** How long this one has waited, in hours. When given, the meta becomes a
   *  chip that warms from grey to amber at a day and red at three — the oldest
   *  row on a panel should not look as calm as the newest. */
  waitedHours?: number;
};

function waitTone(hours: number) {
  if (hours >= 72) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (hours >= 24) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

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
  accent,
}: {
  title: string;
  href: string;
  linkLabel?: string;
  icon: IconType;
  /** Tint classes for an icon tile beside the title, e.g. the queue's colour on
   *  Home. Left out, the header is the plain title it always was. */
  accent?: string;
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {accent && (
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  accent,
                )}
              >
                <HugeiconsIcon icon={icon} strokeWidth={1.8} className="size-4" />
              </span>
            )}
            <CardTitle className="truncate">{title}</CardTitle>
          </div>
          <Link href={href} className="shrink-0 text-xs text-primary hover:underline">
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
                  {row.waitedHours == null ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {row.meta}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        waitTone(row.waitedHours),
                      )}
                    >
                      {row.meta}
                    </span>
                  )}
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
  // The section's own colour and icon, picked by address so no page has to
  // pass it — see section-look.
  const look = lookForPath(usePathname());

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {look && (
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl animate-in fade-in zoom-in-90 duration-300",
              look.tint,
            )}
          >
            <HugeiconsIcon icon={look.icon} strokeWidth={1.8} className="size-5.5" />
          </span>
        )}
        <div>
          <h1 className="font-heading text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
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
  exportName,
  exportable = true,
  cardView = true,
}: {
  headers: React.ReactNode[];
  /** A width per column, e.g. `w-[22%]`. Under `table-fixed` the first row's
   *  widths are the whole of the column sizing — content cannot widen a column
   *  — so this is where a table decides what it is willing to spend on each. */
  widths?: string[];
  children: React.ReactNode;
  /** The file name for Export to Excel. Defaults to the page's address. */
  exportName?: string;
  /** False on pages with their own, fuller export. */
  exportable?: boolean;
  /** False where a row only makes sense as a line in a ledger. */
  cardView?: boolean;
}) {
  const last = headers.length - 1;
  const table = React.useRef<HTMLTableElement>(null);
  const body = React.useRef<HTMLTableSectionElement>(null);
  const pathname = usePathname();
  const [exporting, setExporting] = React.useState(false);
  const [view, setView] = useTableView(pathname);
  const cards = cardView && view === "cards";

  // Plain text of each header, for the label above each cell in cards view. A
  // header can be a node (a right-aligned span), so its text is dug out.
  useRowDecoration(
    body,
    headers.map((header) => (typeof header === "string" ? header : textOf(header))),
  );

  const exportTable = async () => {
    if (!table.current || exporting) return;
    setExporting(true);

    try {
      const name = exportName ?? (pathname.replace(/^\/dashboard\/?/, "").replace(/\//g, "-") || "home");
      await exportTableToExcel(table.current, `adhoc-${name}-${todayStamp()}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={cards ? undefined : "overflow-x-auto"}>
      {(exportable || cardView) && (
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          {cardView ? <ViewToggle view={view} onChange={setView} /> : <span />}
          {/* Exports the rows on screen, with the current tab, filter and search. */}
          {exportable && (
            <Button variant="outline" size="sm" onClick={exportTable} disabled={exporting}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} />
              {exporting ? "Exporting…" : "Export to Excel"}
            </Button>
          )}
        </div>
      )}
      {/*
        min-w-5xl, not 3xl. Under `table-fixed` a cell whose content is wider
        than its column does not wrap the column — it SPILLS OVER the next one,
        which is how a status pill ended up underneath a Reject button. The
        percentages are only as good as the width they divide up, so the floor
        has to be wide enough for the narrowest real column (the buttons) to fit
        at its share of it. Below that the table scrolls, which is the honest
        outcome — a queue nobody can read is worse than one that scrolls.
      */}
      <table
        ref={table}
        className={cn("w-full text-sm", cards ? "block" : "min-w-5xl table-fixed")}
      >
        <thead className={cards ? "hidden" : undefined}>
          <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
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
        {/* The hover lives here rather than on each row so every table answers
            the pointer the same way — it was only the employers queue that did,
            which made the others feel inert beside it. */}
        <tbody ref={body} className={cn(ROW_MOTION, cards ? CARD_BODY : TABLE_BODY)}>
          {children}
        </tbody>
      </table>
    </div>
  );
}

// ─── Table / cards ────────────────────────────────────────────────────────────
//
// THE SAME ROWS, RESTYLED — not a second rendering of them.
//
// Every page builds its rows once, as <tr>s. Cards view keeps that markup and
// lays it out differently: the body becomes a grid, each row a card, each cell a
// block with its column's name above it. The alternative was a card component
// per page, fourteen of them, each free to drift from its table — and a card
// that forgot the Reject button would be a worse bug than any layout. Export to
// Excel reads the same DOM in both views, so it does not care which is showing.

type TableView = "table" | "cards";

/** The text inside a header node: `<span className="text-right">Amount</span>`
 *  is "Amount". */
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
}

const ROW_MOTION =
  "[&>tr]:animate-in [&>tr]:fade-in [&>tr]:slide-in-from-bottom-2 [&>tr]:duration-500 [&>tr]:[animation-fill-mode:both]";

const TABLE_BODY = "divide-y [&>tr]:transition-colors [&>tr:hover]:bg-muted/40";

const CARD_BODY = cn(
  "grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3",
  // the row as a card
  "[&>tr]:flex [&>tr]:flex-col [&>tr]:gap-3 [&>tr]:rounded-xl [&>tr]:border [&>tr]:bg-card [&>tr]:p-4 [&>tr]:shadow-xs",
  "[&>tr]:transition-[box-shadow,border-color] [&>tr:hover]:border-primary/30 [&>tr:hover]:shadow-md",
  // rows that span the table (expanded detail, subtotals) span the grid too
  "[&>tr[data-span]]:col-span-full",
  // each cell as a block, its column's name above it
  "[&>tr>td]:block [&>tr>td]:w-full [&>tr>td]:p-0! [&>tr>td]:text-left!",
  "[&>tr>td[data-label]]:before:mb-1 [&>tr>td[data-label]]:before:block [&>tr>td[data-label]]:before:text-[10px] [&>tr>td[data-label]]:before:font-medium [&>tr>td[data-label]]:before:uppercase [&>tr>td[data-label]]:before:tracking-wide [&>tr>td[data-label]]:before:text-muted-foreground [&>tr>td[data-label]]:before:content-[attr(data-label)]",
  // the actions sit along the bottom edge, whatever height the card is
  "[&>tr>td:last-child:not(:first-child)]:mt-auto [&>tr>td:last-child:not(:first-child)]:border-t [&>tr>td:last-child:not(:first-child)]:pt-3!",
);

/** Remembered per page, in this browser only. Wrapped, because storage can be
 *  blocked and a view preference is never worth an error. */
function useTableView(pathname: string): [TableView, (view: TableView) => void] {
  const key = `adhoc:view:${pathname}`;
  const [view, setView] = React.useState<TableView>("table");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      // Read after mount, not in the initializer, so the server render and the
      // first client render agree and nothing flashes a hydration warning.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "cards" || saved === "table") setView(saved);
    } catch {}
  }, [key]);

  const choose = (next: TableView) => {
    setView(next);
    try {
      localStorage.setItem(key, next);
    } catch {}
  };

  return [view, choose];
}

/** Writes each cell's column name onto it (for the label above it in cards
 *  view), marks rows that do not line up with the columns, and staggers the
 *  rows' entrance. Watches the body rather than running once, because some rows
 *  re-render on their own — an expanded payroll row adds its detail lines
 *  without the table around it rendering at all. */
function useRowDecoration(
  body: React.RefObject<HTMLTableSectionElement | null>,
  headers: string[],
) {
  const labels = headers.join("\u0000");

  React.useLayoutEffect(() => {
    const tbody = body.current;
    if (!tbody) return;
    const names = labels.split("\u0000");

    const decorate = () => {
      Array.from(tbody.rows).forEach((row, index) => {
        // Only a row's first appearance is staggered. Setting a delay on a row
        // that has already arrived would replay it from invisible.
        if (!row.dataset.arrived) {
          row.dataset.arrived = "1";
          row.style.animationDelay = `${Math.min(index, 12) * 35}ms`;
        }

        if (row.cells.length !== names.length) {
          row.dataset.span = "1";
          return;
        }
        delete row.dataset.span;

        Array.from(row.cells).forEach((cell, i) => {
          const name = names[i];
          // Not on the first column — the name or company IS the card's title
          // — and not on an unlabelled or Actions column.
          if (i === 0 || !name || name === "Actions") delete cell.dataset.label;
          else cell.dataset.label = name;
        });
      });
    };

    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(tbody, { childList: true });
    return () => observer.disconnect();
  }, [body, labels]);
}

function ViewToggle({
  view,
  onChange,
}: {
  view: TableView;
  onChange: (view: TableView) => void;
}) {
  const options: { value: TableView; label: string; icon: IconType }[] = [
    { value: "table", label: "Table", icon: Menu01Icon },
    { value: "cards", label: "Cards", icon: GridViewIcon },
  ];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            view === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <HugeiconsIcon icon={option.icon} strokeWidth={2} className="size-3.5" />
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ─── Export to Excel ──────────────────────────────────────────────────────────

/** 2026-09-30, in Singapore time. */
const todayStamp = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });

/** A cell's text without its buttons and form controls, one line per block. */
function cellText(cell: HTMLElement) {
  let text = cell.innerText;

  for (const control of cell.querySelectorAll<HTMLElement>("button, select, input, [role='button']")) {
    const own = control.innerText?.trim();
    if (own) text = text.replace(own, "");
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" · ");
}

/** "$1,234.50" and "1,234" become numbers so Excel can add them up. Long runs
 *  of bare digits (phone numbers, IDs) stay as text. */
function toCell(text: string) {
  const money = /^-?\$-?[\d,]+(\.\d+)?$/.test(text);
  const plain = /^-?[\d,]+(\.\d+)?$/.test(text) && (/[,.]/.test(text) || text.replace("-", "").length <= 6);

  if (!money && !plain) return { value: text };

  const value = Number(text.replace(/[$,]/g, ""));
  if (!Number.isFinite(value)) return { value: text };

  return { value, type: Number, format: money ? '"$"#,##0.00' : "#,##0.##" };
}

/** Writes the rows on screen to an .xlsx file. Columns with no header or no
 *  text (checkboxes, action buttons) are left out. */
async function exportTableToExcel(table: HTMLTableElement, fileName: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const headers = [...table.querySelectorAll<HTMLElement>("thead th")].map((th) => th.innerText.trim());

  // Detail rows that span the whole table are skipped; they do not fit the columns.
  const rows = [...table.querySelectorAll<HTMLTableRowElement>("tbody > tr")]
    .map((row) => [...row.cells])
    .filter((cells) => cells.length === headers.length)
    .map((cells) => cells.map(cellText));

  const keep = headers
    .map((header, i) => i)
    .filter((i) => headers[i] !== "" && rows.some((row) => row[i] !== ""));

  const data = [
    keep.map((i) => ({ value: headers[i], fontWeight: "bold" as const })),
    ...rows.map((row) => keep.map((i) => toCell(row[i]))),
  ];

  const columns = keep.map((i) => ({
    width: Math.min(50, Math.max(10, headers[i].length, ...rows.map((row) => row[i].length)) + 2),
  }));

  await writeXlsxFile(data, { columns, stickyRowsCount: 1 }).toFile(fileName);
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
