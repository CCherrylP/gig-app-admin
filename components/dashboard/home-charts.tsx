"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { listShifts } from "@/lib/shifts";
import { addDays, getMoneyReport, recentMonths, today } from "@/lib/reports";

// TWO CHARTS, each answering one question staff actually ask on a Monday.
//
//   The next fortnight — are the shifts coming up filled? Booked seats against
//   empty ones, per day, so a thin Saturday shows up as a tall pale bar a week
//   before it becomes a phone call from an employer.
//
//   The last six months — is the money arriving? Invoiced against received, per
//   month. Two bars of one measure on one axis; the gap between them is the
//   story.
//
// Both use the kit's own chart ramp (--chart-1 light, --chart-3 deep): one hue,
// two steps far apart in lightness, so the pair stays distinct for every kind
// of colour vision and in grayscale. The legend names them; colour is never the
// only label.

const LIGHT = "var(--chart-1)";
const DEEP = "var(--chart-3)";

// ─── Shifts, next 14 days ─────────────────────────────────────────────────────

const shiftsConfig = {
  booked: { label: "Booked seats", color: DEEP },
  open: { label: "Empty seats", color: LIGHT },
} satisfies ChartConfig;

/** 'Mon 6' from a plain calendar day, read as written rather than converted. */
function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-SG", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
  });
}

export function ShiftsChart() {
  const from = today();
  const to = addDays(from, 13);

  const { data, isLoading } = useQuery({
    queryKey: ["shifts", "home-fortnight", from],
    queryFn: () => listShifts({ from, to }),
  });

  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i)).map((day) => {
    const onDay = (data?.shifts ?? []).filter((shift) => shift.onDate === day);
    const booked = onDay.reduce((sum, shift) => sum + shift.filled, 0);
    const seats = onDay.reduce((sum, shift) => sum + shift.headcount, 0);
    return { day: dayLabel(day), booked, open: Math.max(0, seats - booked) };
  });

  const booked = days.reduce((sum, d) => sum + d.booked, 0);
  const seats = booked + days.reduce((sum, d) => sum + d.open, 0);
  const filled = seats ? Math.round((booked / seats) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>The next two weeks</CardTitle>
            <CardDescription>
              {isLoading
                ? "Counting seats…"
                : seats === 0
                  ? "Nothing on the calendar yet."
                  : `${booked} of ${seats} seats booked · ${filled}% filled`}
            </CardDescription>
          </div>
          <Link href="/dashboard/shifts" className="shrink-0 text-xs text-primary hover:underline">
            Open shifts
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : (
          <ChartContainer config={shiftsConfig} className="aspect-auto h-56 w-full">
            <BarChart data={days} margin={{ left: -16, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="booked"
                stackId="seats"
                fill="var(--color-booked)"
                stroke="var(--card)"
                strokeWidth={2}
                maxBarSize={24}
                animationDuration={700}
              />
              <Bar
                dataKey="open"
                stackId="seats"
                fill="var(--color-open)"
                stroke="var(--card)"
                strokeWidth={2}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                animationDuration={700}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Money, last 6 months ─────────────────────────────────────────────────────

const moneyConfig = {
  invoiced: { label: "Invoiced (S$)", color: LIGHT },
  received: { label: "Received (S$)", color: DEEP },
} satisfies ChartConfig;

/** 'Sep' from '2026-09'. */
function monthShort(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-SG", {
    timeZone: "UTC",
    month: "short",
  });
}

/** 12K, 1.2M — for an axis, never for a figure somebody acts on. */
const compact = (value: number) =>
  new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export function MoneyChart() {
  const months = recentMonths(6).reverse();

  // Six small requests rather than a new endpoint. Each is one month of the
  // same report the Money page reads, so they share its cache.
  const reports = useQueries({
    queries: months.map((month) => ({
      queryKey: ["money-report", month],
      queryFn: () => getMoneyReport(month),
    })),
  });

  const isLoading = reports.some((report) => report.isLoading);

  const rows = months.map((month, i) => {
    const totals = reports[i]?.data?.totals;
    return {
      month: monthShort(month),
      invoiced: Math.round((totals?.invoicedCents ?? 0) / 100),
      received: Math.round((totals?.receivedCents ?? 0) / 100),
    };
  });

  const thisMonth = rows[rows.length - 1];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Money in</CardTitle>
            <CardDescription>
              {isLoading
                ? "Adding it up…"
                : `This month: S$${thisMonth.received.toLocaleString("en-SG")} received of S$${thisMonth.invoiced.toLocaleString("en-SG")} invoiced`}
            </CardDescription>
          </div>
          <Link href="/dashboard/money" className="shrink-0 text-xs text-primary hover:underline">
            Open money
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : (
          <ChartContainer config={moneyConfig} className="aspect-auto h-56 w-full">
            <BarChart data={rows} margin={{ left: -8, right: 4, top: 4 }} barGap={2}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="invoiced"
                fill="var(--color-invoiced)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                animationDuration={700}
              />
              <Bar
                dataKey="received"
                fill="var(--color-received)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                animationDuration={700}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
