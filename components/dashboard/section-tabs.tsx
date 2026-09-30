"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface SectionTab {
  label: string;
  url: string;
  /** Other pages that also count as this tab. */
  match?: string[];
  /** Shown as a small amber count when above zero. */
  count?: number;
}

/** The section name and its tabs, at the top of every page in a section. Each
 *  tab is its own page; this bar ties them together. */
export function SectionTabs({ title, tabs }: { title: string; tabs: SectionTab[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label={title} className="flex flex-col gap-3">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => {
          const active = pathname === tab.url || Boolean(tab.match?.includes(pathname));
          const waiting = tab.count ?? 0;

          return (
            <Link
              key={tab.url}
              href={tab.url}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {tab.label}
              {waiting > 0 && (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-xs font-medium tabular-nums",
                    active ? "bg-primary-foreground/20" : "bg-amber-100 text-amber-900",
                  )}
                >
                  {waiting}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// --- the sections ---------------------------------------------------------------

export const INBOX_TABS: SectionTab[] = [
  { label: "Candidates", url: "/dashboard/inbox/candidates" },
  { label: "Employers", url: "/dashboard/inbox/employers" },
];

export const PEOPLE_TABS: SectionTab[] = [
  { label: "Candidates", url: "/dashboard/candidates" },
  { label: "Employers", url: "/dashboard/people/employers" },
  { label: "Reviews & blocks", url: "/dashboard/reputation" },
];

export const MONEY_TABS: SectionTab[] = [
  { label: "Overview", url: "/dashboard/money" },
  { label: "Payroll", url: "/dashboard/payroll", match: ["/dashboard/payroll/sheet"] },
  { label: "Invoices", url: "/dashboard/invoices" },
  { label: "Referrals", url: "/dashboard/referrals" },
];

/** Every page in a section, for highlighting it in the sidebar. */
export const urlsOf = (tabs: SectionTab[]) => tabs.flatMap((tab) => [tab.url, ...(tab.match ?? [])]);

/** The two views of payroll: one line per person to pay, or one per shift. */
export function PayrollSwitch() {
  const pathname = usePathname();
  const views = [
    { label: "By person", url: "/dashboard/payroll/sheet" },
    { label: "By shift", url: "/dashboard/payroll" },
  ];

  return (
    <div className="inline-flex self-start rounded-lg border border-border bg-muted/40 p-1">
      {views.map((view) => {
        const active = pathname === view.url;

        return (
          <Link
            key={view.url}
            href={view.url}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 text-sm transition-colors",
              active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}

export const InboxTabs = () => <SectionTabs title="Inbox" tabs={INBOX_TABS} />;
export const PeopleTabs = () => <SectionTabs title="People" tabs={PEOPLE_TABS} />;
export const MoneyTabs = () => <SectionTabs title="Money" tabs={MONEY_TABS} />;
