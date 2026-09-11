"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
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
  type CompanyMoney,
} from "@/lib/reports";
import { coins as formatCoins, money } from "@/lib/format";

// Money coming IN, a month at a time.
//
// COINS AND CASH ARE REPORTED SEPARATELY AND DELIBERATELY NOT ADDED TOGETHER.
// A coin is worth S$1 of wages or fee to every company alike, but what a
// company PAID for one is negotiable — so "fees earned" is in coins at face
// value, and "received" is what actually landed in the bank. Blending the two
// into a single revenue figure would be wrong for anybody on a negotiated
// rate, on a screen somebody makes decisions from.
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

  return (
    // p-6 and gap-6, matching every other page on this dashboard.
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Money"
        description="What was billed, what landed, what is still owed, and what the platform earned."
      >
        <select
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          {recentMonths().map((value) => (
            <option key={value} value={value}>
              {monthLabel(value)}
            </option>
          ))}
        </select>
      </PageHeader>

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
        {/*
          THE REVENUE LINE, and the reason it is in coins rather than dollars
          is in the header of this file.
        */}
        <StatCard
          label="Placement fees earned"
          count={`${formatCoins(totals?.feeCoins ?? 0)} coins`}
          icon={Coins01Icon}
          cls="text-primary"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Coins bought"
          count={formatCoins(totals?.topupCoins ?? 0)}
          icon={Coins01Icon}
        />
        <StatCard
          label="Wages held"
          count={formatCoins(totals?.heldCoins ?? 0)}
          icon={MoneySend02Icon}
          cls="text-muted-foreground"
        />
        <StatCard
          label="Refunded to employers"
          count={formatCoins(totals?.refundCoins ?? 0)}
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
                "Fees earned",
                "Balance left",
              ]}
              widths={["w-[30%]", "w-[14%]", "w-[14%]", "w-[16%]", "w-[13%]", "w-[13%]"]}
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

      <td className="px-4 py-3 tabular-nums">{formatCoins(row.feeCoins)}</td>
      <td className="px-4 py-3 tabular-nums">{formatCoins(row.balanceCoins)}</td>
    </tr>
  );
}
