"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartLineData01Icon } from "@hugeicons/core-free-icons";

import { MoneyTabs } from "@/components/dashboard/section-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, TableShell, TableSkeleton } from "@/components/dashboard/data-views";
import { currentMonth, monthLabel, recentMonths } from "@/lib/reports";
import { getSalesReport, type SalesRow } from "@/lib/sales";
import { money } from "@/lib/format";

// Every signed-off shift: what it billed, the fee we kept, and who earned a
// referral on it. Filter by company and sort by any money column.

type SortKey = "company" | "date" | "bill" | "gross" | "net";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "company", label: "Company, then date" },
  { value: "date", label: "Date" },
  { value: "bill", label: "Bill, highest first" },
  { value: "gross", label: "Gross profit, highest first" },
  { value: "net", label: "Net profit, highest first" },
];

const sorters: Record<SortKey, (a: SalesRow, b: SalesRow) => number> = {
  company: (a, b) =>
    a.companyName.localeCompare(b.companyName) || a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  date: (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  bill: (a, b) => b.billCents - a.billCents,
  gross: (a, b) => b.grossCents - a.grossCents,
  net: (a, b) => b.netCents - a.netCents,
};

const hours = (minutes: number) => (Math.round((minutes / 60) * 100) / 100).toString();

/** '7 Oct' from 'YYYY-MM-DD'. */
const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "UTC" });

const right = (label: string) => (
  <span key={label} className="block text-right">
    {label}
  </span>
);

const selectClass = "h-9 rounded-md border border-border bg-background px-3 text-sm";

export default function SalesPage() {
  const [month, setMonth] = useState(currentMonth());
  const [company, setCompany] = useState("");
  const [sort, setSort] = useState<SortKey>("company");

  const { data, isLoading } = useQuery({
    queryKey: ["sales-report", month, company],
    queryFn: () => getSalesReport(month, company || null),
  });

  const rows = useMemo(() => [...(data?.rows ?? [])].sort(sorters[sort]), [data, sort]);
  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-6 p-6">
      <MoneyTabs />
      <PageHeader
        title="Sales"
        description="Every signed-off shift: the bill, the fee we kept, and who earned a referral. 10% goes to accounts only where an agency referral paid."
      />

      <div className="flex flex-wrap items-center gap-3">
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" className={selectClass}>
          {recentMonths().map((value) => (
            <option key={value} value={value}>
              {monthLabel(value)}
            </option>
          ))}
        </select>

        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          aria-label="Company"
          className={selectClass}
        >
          <option value="">All companies</option>
          {(data?.companies ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort"
          className={selectClass}
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              Sort: {option.label}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState icon={ChartLineData01Icon} message={`No signed-off shifts in ${monthLabel(month)}.`} />
          ) : (
            <TableShell
              exportName={`sales-${month}`}
              cardView={false}
              headers={[
                "Date",
                "Company",
                "Worker",
                right("Bill"),
                right("Pay/h"),
                right("Hours"),
                right("Gross profit"),
                right("10% accounts"),
                right("Net profit"),
                "TA (50%)",
                "BD (50%)",
              ]}
              widths={[
                "w-[6%]",
                "w-[13%]",
                "w-[11%]",
                "w-[8%]",
                "w-[7%]",
                "w-[6%]",
                "w-[8%]",
                "w-[8%]",
                "w-[8%]",
                "w-[12.5%]",
                "w-[12.5%]",
              ]}
            >
              {rows.map((row) => (
                <tr key={row.applicationId} className="align-top">
                  <td className="px-3 py-2.5 tabular-nums">
                    {day(row.date)}
                    <span className="block text-xs text-muted-foreground">
                      {row.start}–{row.end}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block truncate font-medium">{row.companyName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.companyIsAgency ? "Agency · " : ""}
                      {row.jobTitle}
                    </span>
                  </td>
                  <td className="truncate px-3 py-2.5">{row.workerName ?? "Unnamed"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(row.billCents)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(row.payPerHourCents)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{hours(row.minutes)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(row.grossCents)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(row.accountsCents)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{money(row.netCents)}</td>
                  <td className="px-3 py-2.5">
                    <Share share={row.ta} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Share share={row.bd} />
                  </td>
                </tr>
              ))}

              {totals && (
                <tr className="border-t-2 font-semibold">
                  <td className="px-3 py-2.5">Total</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.billCents)}</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right tabular-nums">{hours(totals.minutes)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.grossCents)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.accountsCents)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.netCents)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{money(totals.taCents)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{money(totals.bdCents)}</td>
                </tr>
              )}
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Who earned one side, and how much. A dash when nobody did. */
function Share({ share }: { share: { name: string; amountCents: number } | null }) {
  if (!share) return <span className="text-muted-foreground">—</span>;

  return (
    <>
      <span className="block truncate">{share.name}</span>
      <span className="block text-xs tabular-nums text-muted-foreground">{money(share.amountCents)}</span>
    </>
  );
}
