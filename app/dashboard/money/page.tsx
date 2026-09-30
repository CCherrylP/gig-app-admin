"use client";

import { useState } from "react";
import Link from "next/link";
import { MoneyTabs } from "@/components/dashboard/section-tabs";
import { useQuery } from "@tanstack/react-query";
import {
  Alert02Icon,
  Coins01Icon,
  Invoice01Icon,
  MoneyReceive02Icon,
  MoneySend02Icon,
} from "@hugeicons/core-free-icons";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  PageHeader,
  StatCard,
  TableShell,
} from "@/components/dashboard/data-views";
import {
  currentMonth,
  getMoneyReport,
  monthLabel,
  recentMonths,
  type AllTimeMoney,
  type CompanyMoney,
  type FeeBreakdown,
} from "@/lib/reports";
import { coins as formatCoins, money } from "@/lib/format";

// Money coming IN, a month at a time.
//
// Everything is in dollars. Coin figures come from the API already priced at
// each row's own coin rate, because a month can straddle a redenomination and
// old and new coins cannot be added as counts. Invoice cash and coin movements
// are still shown apart, never summed into one revenue number.
//
// Invoiced = received + outstanding + cancelled, so all three are shown.
//
// Nothing here can be acted on. Confirming a transfer is the only act that
// creates coins and it belongs next to the invoice's own receipt and PDF —
// that is Invoices. This is where you find out how the month went.

export default function MoneyPage() {
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading } = useQuery({
    queryKey: ["money-report", month],
    queryFn: () => getMoneyReport(month),
  });

  const totals = data?.totals;
  const companies = data?.companies ?? [];
  const allTime = data?.allTime;

  return (
    // p-6 and gap-6, matching every other page on this dashboard.
    <div className="flex flex-col gap-6 p-6">
      <MoneyTabs />
      <PageHeader
        title="Overview"
        description="What companies paid us, what we earned, and what is still owed."
      />

      {allTime && <AllTime data={allTime} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">By month</h2>
        <select
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          aria-label="Month"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          {recentMonths().map((value) => (
            <option key={value} value={value}>
              {monthLabel(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Received"
          count={money(totals?.receivedCents ?? 0)}
          icon={MoneyReceive02Icon}
          cls="text-emerald-600"
        />
        <StatCard
          label="Outstanding"
          count={money(totals?.outstandingCents ?? 0)}
          icon={Invoice01Icon}
          cls="text-amber-600"
        />
        <StatCard
          label="Overdue"
          count={money(totals?.overdueCents ?? 0)}
          icon={Alert02Icon}
          cls="text-rose-600"
        />
        <StatCard
          label="Placement fees taken"
          count={money(totals?.feeCents ?? 0)}
          icon={Coins01Icon}
          cls="text-primary"
          hint="Taken when jobs are posted. Not all earned yet."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cancelled invoices"
          count={money(totals?.cancelledCents ?? 0)}
          icon={Invoice01Icon}
          cls="text-muted-foreground"
        />
        <StatCard
          label="Coins topped up"
          count={money(totals?.topupCents ?? 0)}
          icon={Coins01Icon}
        />
        <StatCard
          label="Wages held"
          count={money(totals?.heldCents ?? 0)}
          icon={MoneySend02Icon}
          cls="text-muted-foreground"
        />
        <StatCard
          label="Refunded to employers"
          count={money(totals?.refundCents ?? 0)}
          icon={MoneyReceive02Icon}
          cls="text-muted-foreground"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By company · {monthLabel(month)}</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }, (_, n) => (
                <Skeleton key={n} className="h-10 w-full" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <EmptyState
              icon={Invoice01Icon}
              message="No invoices raised and no coins moved this month."
            />
          ) : (
            <TableShell
              headers={[
                "Company",
                "Invoiced",
                "Received",
                "Outstanding",
                "Cancelled",
                "Fees taken",
                "Balance left",
              ]}
              widths={["w-[26%]", "w-[12%]", "w-[12%]", "w-[13%]", "w-[12%]", "w-[12%]", "w-[13%]"]}
            >
              {companies.map((row) => (
                <CompanyRow key={row.companyId} row={row} />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** "3h 20m" from minutes. */
const hoursLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

/** The two numbers that matter most: cash paid for coins and revenue, since the start. */
function AllTime({ data }: { data: AllTimeMoney }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">All time</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Companies paid for coins"
          count={money(data.paidCents)}
          icon={MoneyReceive02Icon}
          cls="text-emerald-600"
          hint="Every paid invoice."
        />
        <StatCard
          label="Your revenue"
          count={money(data.revenueCents)}
          icon={Coins01Icon}
          cls="text-primary"
          hint={`$2 an hour × ${hoursLabel(data.minutesWorked)} worked${
            data.referralCents > 0 ? `, minus ${money(data.referralCents)} in referrals` : ""
          }.`}
        />
      </div>

      <FeesHeld fees={data.fees} />
    </section>
  );
}

/** The four parts of a fee we hold. Colours are shared by the bar and the list. */
const FEE_PARTS = [
  {
    key: "earnedCents",
    label: "Earned",
    note: "$2 an hour for hours actually worked. This is ours.",
    colour: "bg-emerald-500",
  },
  {
    key: "upcomingCents",
    label: "Upcoming jobs",
    note: "Paid in advance for shifts that have not happened yet.",
    colour: "bg-sky-500",
  },
  {
    key: "toRefundCents",
    label: "To give back",
    note: "Jobs that are over, for seats nobody filled. Goes back to the company when the job closes.",
    colour: "bg-amber-500",
  },
  {
    key: "deletedCents",
    label: "Deleted jobs",
    note: "Fees still held on jobs that were deleted. Mostly test data.",
    colour: "bg-slate-400",
  },
] as const;

/** Every fee we took at posting, as one bar split by what it really is. */
function FeesHeld({ fees }: { fees: FeeBreakdown }) {
  const total = Math.max(1, fees.totalCents);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>Placement fees we hold</CardTitle>
          <span className="text-2xl font-semibold tabular-nums">{money(fees.totalCents)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          The fee is taken in full when a job is posted. Only the part for hours worked is earned.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
          {FEE_PARTS.map((part) =>
            fees[part.key] > 0 ? (
              <div
                key={part.key}
                className={part.colour}
                style={{ width: `${(fees[part.key] / total) * 100}%` }}
                title={`${part.label}: ${money(fees[part.key])}`}
              />
            ) : null,
          )}
        </div>

        <ul className="divide-y">
          {FEE_PARTS.map((part) => (
            <li key={part.key} className="flex items-start gap-3 py-3">
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${part.colour}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{part.label}</p>
                <p className="text-sm text-muted-foreground">{part.note}</p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-medium">{money(fees[part.key])}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round((fees[part.key] / total) * 100)}%
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CompanyRow({ row }: { row: CompanyMoney }) {
  const overdue = row.overdueCents > 0;

  return (
    <tr className="border-b last:border-0">
      <td className="truncate px-4 py-3">
        {/*
          Straight through to that company's unpaid invoices. Somebody reading
          "outstanding $2,000" wants to act on it, and the act lives on another
          screen — the payments queue already takes ?company=<uen>.
        */}
        <Link
          href={`/dashboard/payments?company=${encodeURIComponent(row.uen ?? "")}`}
          className="truncate font-medium hover:underline"
        >
          {row.companyName}
        </Link>
        <div className="truncate text-xs text-muted-foreground">{row.uen ?? "—"}</div>
      </td>

      <td className="px-4 py-3 tabular-nums">{money(row.invoicedCents)}</td>
      <td className="px-4 py-3 tabular-nums">{money(row.receivedCents)}</td>

      <td className="px-4 py-3 tabular-nums">
        <span className={overdue ? "font-medium text-rose-600" : undefined}>
          {money(row.outstandingCents)}
        </span>
        {overdue && (
          <div className="text-xs text-rose-600">
            {money(row.overdueCents)} overdue
          </div>
        )}
      </td>

      <td className="px-4 py-3 tabular-nums text-muted-foreground">
        {row.cancelledCents > 0 ? money(row.cancelledCents) : "—"}
      </td>

      <td className="px-4 py-3 tabular-nums">{money(row.feeCents)}</td>
      <td className="px-4 py-3 tabular-nums">
        {money(row.balanceCents)}
        <div className="text-xs text-muted-foreground">{formatCoins(row.balanceCoins)} coins</div>
      </td>
    </tr>
  );
}
