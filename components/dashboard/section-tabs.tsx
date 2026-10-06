"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAdminCounts } from "@/hooks/use-admin-counts";
import { CountBadge } from "@/components/dashboard/count-badge";
import type { AdminCounts } from "@/lib/counts";
import { cn } from "@/lib/utils";

export interface SectionTab {
  label: string;
  url: string;
  /** Other pages that also count as this tab. */
  match?: string[];
  /** Shown as a small amber count when above zero. */
  count?: number;
  /** Which number on /admin/counts this tab shows, when it is one of them.
   *
   *  DECLARED RATHER THAN RESOLVED BY THE CALLER, so a tab bar gets a live count
   *  by naming one — the bar reads them itself, off the same polled request the
   *  sidebar and the header bell use. `count` still wins where it is given, for
   *  a number that is not one of these. */
  countKey?: keyof AdminCounts;
}

/** The section name and its tabs, at the top of every page in a section. Each
 *  tab is its own page; this bar ties them together. */
export function SectionTabs({
  title,
  tabs,
  hideEmpty = false,
}: {
  title: string;
  tabs: SectionTab[];
  /** Drop the tabs with nothing waiting. For a bar over QUEUES, where an empty
   *  one is not work and reading past it to find the three that matter is the
   *  whole cost. Off everywhere else: People and Money are places, not piles,
   *  and a zero there means "none yet" rather than "nothing to do". */
  hideEmpty?: boolean;
}) {
  const pathname = usePathname();
  // Same query as everything else that badges a number, so it is one request
  // however many of these are on screen — and it polls, so a tab's count rises
  // while somebody is working the tab next to it.
  const { data: counts } = useAdminCounts();

  const isActive = (tab: SectionTab) =>
    pathname === tab.url || Boolean(tab.match?.includes(pathname));
  const waitingOn = (tab: SectionTab) =>
    tab.count ?? (tab.countKey ? (counts?.[tab.countKey] ?? 0) : 0);

  // THE ACTIVE TAB ALWAYS SURVIVES THE FILTER, even at zero. Working a queue
  // down to empty must not delete the tab out from under the page somebody is
  // standing on — the bar would lose its highlight and read as though they had
  // wandered somewhere outside the section.
  //
  // Counts load as undefined, and while they do nothing is hidden: a bar that
  // draws complete and then drops three tabs a moment later is worse than one
  // that starts narrow.
  const visible =
    hideEmpty && counts !== undefined
      ? tabs.filter((tab) => waitingOn(tab) > 0 || isActive(tab))
      : tabs;

  return (
    <nav aria-label={title} className="flex flex-col gap-3">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {visible.map((tab) => {
          const active = isActive(tab);
          const waiting = waitingOn(tab);

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
              {/* AMBER, not the red mark — a tab bar is somewhere the eye is
                  already looking, and eight red pills in a row would make none of
                  them read as the alarm. On the ACTIVE tab it goes translucent
                  instead: amber on a filled primary pill is unreadable, and the
                  tab you are already on does not need shouting at.
                  See components/dashboard/count-badge. */}
              {waiting > 0 && (
                <CountBadge
                  count={waiting}
                  tone="amber"
                  className={cn(
                    active && "bg-primary-foreground/20 text-primary-foreground dark:bg-primary-foreground/20 dark:text-primary-foreground",
                  )}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// --- the sections ---------------------------------------------------------------

// THE TWO INBOXES CARRY THEIR OWN NUMBERS, where the sidebar's badge is their
// sum. It has to be both: the badge answers "is anybody waiting" from any page,
// and these answer "which of the two", which the sum cannot — a 3 on the section
// sends somebody into the candidate queue to find it empty, and after that they
// stop believing the number.
export const INBOX_TABS: SectionTab[] = [
  {
    label: "Candidates",
    url: "/dashboard/inbox/candidates",
    countKey: "supportCandidates",
  },
  {
    label: "Employers",
    url: "/dashboard/inbox/employers",
    countKey: "supportEmployers",
  },
];

export const PEOPLE_TABS: SectionTab[] = [
  { label: "Candidates", url: "/dashboard/candidates" },
  { label: "Employers", url: "/dashboard/people/employers" },
  { label: "Reviews & blocks", url: "/dashboard/reputation" },
];

export const MONEY_TABS: SectionTab[] = [
  { label: "Overview", url: "/dashboard/money" },
  // Opens on one line per person, the view you pay from.
  { label: "Payroll", url: "/dashboard/payroll/sheet", match: ["/dashboard/payroll"] },
  { label: "Invoices", url: "/dashboard/invoices" },
  { label: "Referrals", url: "/dashboard/referrals" },
  { label: "Sales", url: "/dashboard/sales" },
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
