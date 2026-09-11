import { fetchWithAuth } from "./api";
import { getAccessToken } from "./auth";

// The two money reports.
//
// Shapes copied from gig-app-api's contract/reports.ts — the two repos share
// no package. Keep them in step.
//
// WHY THESE EXIST. Nothing in this system pays anybody: the wage-release sweep
// is a stub and there is no PayNow integration. Somebody transfers money by
// hand, once a month, out of a bank app. These reports are what tells them who
// and how much — so the figures here are not a dashboard, they are what gets
// typed into a transfer.

export type PayrollStatus = "awaiting_signoff" | "ready" | "paid";

export interface PayrollRow {
  applicationId: string;

  candidateId: string;
  candidateName: string | null;
  candidatePhone: string | null;

  companyId: string;
  companyName: string;
  gigTitle: string;
  roleName: string;

  /** 'YYYY-MM-DD'. */
  shiftOnDate: string;
  /** 'HH:MM' wall clock. */
  scheduledStart: string;
  scheduledEnd: string;

  minutes: number | null;
  amountCents: number | null;
  /** True while the employer has not signed off and the amount can still move.
   *  Never present an estimate as a figure somebody can transfer. */
  estimated: boolean;

  payoutKind: "paynow" | "bank" | null;
  /** Masked at the API. The full number never reaches this screen. */
  payoutNumberLast4: string | null;
  payoutBank: string | null;
  payoutHolderName: string | null;

  status: PayrollStatus;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface PayrollTotals {
  readyCents: number;
  readyCount: number;
  awaitingCents: number;
  awaitingCount: number;
  paidCents: number;
  paidCount: number;
}

export interface UnpayableCandidate {
  candidateId: string;
  candidateName: string | null;
  candidatePhone: string | null;
  amountCents: number;
  shifts: number;
}

export interface PayrollResponse {
  month: string;
  rows: PayrollRow[];
  totals: PayrollTotals;
  unpayable: UnpayableCandidate[];
  companies: { companyId: string; companyName: string }[];
}

export interface MarkPaidResponse {
  marked: number;
  month: string;
  totals: PayrollTotals;
}

export function listPayroll(month: string, company?: string) {
  const query = new URLSearchParams({ month });
  if (company) query.set("company", company);

  return fetchWithAuth<PayrollResponse>(`/admin/reports/payroll?${query}`);
}

/** Record a transfer that happened in a bank app. Creates no money and moves
 *  no balance — it stamps the shift so it cannot be paid twice next month. */
export function markPayrollPaid(applicationIds: string[], month: string) {
  return fetchWithAuth<MarkPaidResponse>("/admin/reports/payroll/mark-paid", {
    method: "PATCH",
    body: JSON.stringify({ applicationIds, month }),
  });
}

// --- money coming in ------------------------------------------------------------

export interface CompanyMoney {
  companyId: string;
  companyName: string;
  uen: string | null;

  invoicedCents: number;
  receivedCents: number;
  outstandingCents: number;
  cancelledCents: number;
  overdueCents: number;

  topupCoins: number;
  spendCoins: number;
  feeCoins: number;
  refundCoins: number;

  balanceCoins: number;
}

export interface PlatformMoneyTotals {
  invoicedCents: number;
  receivedCents: number;
  outstandingCents: number;
  cancelledCents: number;
  overdueCents: number;

  topupCoins: number;
  spendCoins: number;
  feeCoins: number;
  refundCoins: number;
  heldCoins: number;
}

export interface MoneyReportResponse {
  month: string;
  companies: CompanyMoney[];
  totals: PlatformMoneyTotals;
}

export function getMoneyReport(month: string) {
  return fetchWithAuth<MoneyReportResponse>(`/admin/reports/money?month=${month}`);
}

// --- shared helpers ---------------------------------------------------------------

/** 'YYYY-MM' for the month we are in, read in SINGAPORE time.
 *
 *  A browser in another timezone opening this at 1am on the 1st must not
 *  default to last month — the reports are about Singapore days. */
export function currentMonth() {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" })
    .slice(0, 7);
}

/** The last `count` months, newest first, as 'YYYY-MM'. */
export function recentMonths(count = 12) {
  const [year, month] = currentMonth().split("-").map(Number);

  return Array.from({ length: count }, (_, n) => {
    const date = new Date(Date.UTC(year, month - 1 - n, 1));
    return date.toISOString().slice(0, 7);
  });
}

/** '2026-09' -> 'September 2026'. */
export function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);

  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-SG", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** '8h 30m' from minutes. Matches formatHours in lib/attendance, which is the
 *  same shape the API writes into the sentence a candidate reads. */
export function hours(minutes: number | null) {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/** How to pay them, as one short line. */
export function payoutLabel(row: PayrollRow) {
  if (!row.payoutKind) return null;
  if (row.payoutKind === "paynow") return `PayNow ·${row.payoutNumberLast4 ?? "????"}`;
  return `${row.payoutBank ?? "Bank"} ·${row.payoutNumberLast4 ?? "????"}`;
}

/**
 * The payable rows as a CSV for a bank's bulk-transfer upload.
 *
 * ONE LINE PER PERSON, not per shift. A bank transfer is to a human being, and
 * uploading four rows for somebody who worked four shifts is four transfers,
 * four fees, and four lines on their statement to reconcile.
 *
 * Only `ready`. An estimate is not a figure to transfer, and a paid row would
 * pay somebody twice.
 */
export function payableCsv(rows: PayrollRow[], month: string) {
  const byCandidate = new Map<
    string,
    { row: PayrollRow; cents: number; shifts: number }
  >();

  for (const row of rows) {
    if (row.status !== "ready" || !row.payoutKind) continue;

    const existing = byCandidate.get(row.candidateId);

    if (existing) {
      existing.cents += row.amountCents ?? 0;
      existing.shifts += 1;
    } else {
      byCandidate.set(row.candidateId, {
        row,
        cents: row.amountCents ?? 0,
        shifts: 1,
      });
    }
  }

  // Quoted, because a company or a person's name can contain a comma and an
  // unquoted one silently shifts every later column by one.
  const cell = (value: string | number | null) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const lines = [
    ["Name", "Phone", "Method", "Bank", "Account (last 4)", "Shifts", "Amount SGD", "Reference"]
      .map(cell)
      .join(","),
  ];

  for (const { row, cents, shifts } of byCandidate.values()) {
    lines.push(
      [
        cell(row.candidateName),
        cell(row.candidatePhone),
        cell(row.payoutKind === "paynow" ? "PayNow" : "Bank"),
        cell(row.payoutBank),
        cell(row.payoutNumberLast4),
        cell(shifts),
        // Plain decimal, no currency symbol and no thousands separator — a
        // bank upload wants a number, not a rendered one.
        cell((cents / 100).toFixed(2)),
        cell(`adhoc ${month}`),
      ].join(","),
    );
  }

  return lines.join("\r\n");
}

/**
 * The same report as a real spreadsheet, built server-side.
 *
 * NOT `window.open` on the URL, which is the obvious thing and does not work:
 * this route is behind the admin gate and a tab opened by the browser carries
 * no Authorization header. So it is fetched with the token like any other
 * call, and the bytes are handed to the browser as a blob.
 *
 * Server-side rather than in the browser because the API already depends on
 * exceljs for the job-import template — the alternative was shipping a
 * spreadsheet library to every admin for one button.
 */
export async function downloadPayrollXlsx(month: string, company?: string) {
  const token = await getAccessToken();

  if (!token) throw new Error("Session ended");

  const query = new URLSearchParams({ month });
  if (company) query.set("company", company);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/admin/reports/payroll.xlsx?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error("Could not build the spreadsheet");

  saveBlob(`adhoc-payroll-${month}.xlsx`, await res.blob());
}

/** Hand the browser a file it already holds. */
function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

/** Hand the browser a file. No library — it is eight lines and a dependency
 *  here would be one shipped to every admin for one button. */
export function downloadCsv(filename: string, csv: string) {
  // The BOM is not decoration: without it Excel reads the file as the system
  // codepage and mangles any non-ASCII name in the first column.
  saveBlob(filename, new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" }));
}
