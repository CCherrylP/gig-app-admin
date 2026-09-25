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
  /** The role's posted rate. CONTEXT, NOT THE FIGURE — `amountCents` is what
   *  settlement wrote down and the only number anybody transfers. This is here
   *  so a sheet can show "8h × $13.50" beside the total without dividing one by
   *  the other, which disagrees by a cent on awkward durations and disagrees
   *  entirely on a shift paid by a manual release. */
  payPerHourCents: number;
  /** True while the employer has not signed off and the amount can still move.
   *  Never present an estimate as a figure somebody can transfer. */
  estimated: boolean;

  /** PayNow or a bank transfer. Both are paid by hand out of a bank app, and
   *  they need different things typed in — PayNow wants the mobile, a bank
   *  wants bank + account + the name on it. */
  payoutKind: "paynow" | "bank" | null;
  /** THE FULL NUMBER — the mobile on PayNow, the account number on a bank
   *  transfer. Not masked: this screen exists so somebody can make the
   *  transfer, and nobody can pay `·4821`. See the note in the API contract. */
  payoutNumber: string | null;
  /** Bank transfers only. Null on PayNow, where the bank is looked up from the
   *  number rather than chosen. */
  payoutBank: string | null;
  /** The name the account is in — a bank checks it against the number. Usually
   *  the candidate's own, so the screen falls back to that. */
  payoutHolderName: string | null;

  /** WHETHER ANYBODY HAS CHECKED THAT THE NUMBER IS THEIRS. The number and the
   *  holder above are both typed by the candidate into one form, so they agree
   *  with each other whatever the truth is — and a PayNow transfer clears at
   *  once and cannot be pulled back. It does not stop a payment; it is here so
   *  the person about to make one can see it. */
  payoutVerification: PayoutVerification;
  /** Whether there is a screenshot to open. */
  payoutHasProof: boolean;

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
  /** The month `from` falls in — a LABEL, not the range. A week crossing the
   *  1st has to report one of the two months it touches. Read `from`/`to`. */
  month: string;
  /** The range actually read, 'YYYY-MM-DD', inclusive at both ends. Always
   *  present, including on a month request. */
  from: string;
  to: string;
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

/** A period somebody picked, 'YYYY-MM-DD', INCLUSIVE at both ends — which is
 *  what a date picker means and what the API takes. */
export interface DateRange {
  from: string;
  to: string;
}

export function listPayroll(range: DateRange, company?: string) {
  const query = new URLSearchParams({ from: range.from, to: range.to });
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

// --- picking a period ---------------------------------------------------------------
//
// Wages are chased daily and transferred weekly, so a month is the wrong unit
// for the person doing the work. These build the three ranges worth a button,
// all of them in SINGAPORE time — a browser open at 1am on the 1st must not
// offer yesterday's week because UTC has not caught up.

/** Today in Singapore, 'YYYY-MM-DD'. 'en-CA' because it formats as ISO. */
export function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

/** 'YYYY-MM-DD' shifted by whole days. Built from UTC parts, so it cannot pick
 *  up the reader's timezone or a daylight-saving hour on the way through. */
export function addDays(day: string, delta: number) {
  const [year, month, date] = day.split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, date + delta));
  return at.toISOString().slice(0, 10);
}

/** The one day, as a range. */
export const dayRange = (day: string): DateRange => ({ from: day, to: day });

/** The MONDAY-to-SUNDAY week a day falls in.
 *
 *  Monday rather than Sunday because that is the week a Singapore roster is
 *  written to, and a week boundary that splits a weekend would cut most of the
 *  shifts on this platform in half. */
export function weekRange(day: string): DateRange {
  const [year, month, date] = day.split("-").map(Number);
  // getUTCDay: 0 is Sunday, so Sunday is 6 days into a Monday-led week.
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  const from = addDays(day, -((weekday + 6) % 7));
  return { from, to: addDays(from, 6) };
}

/** A whole calendar month, from 'YYYY-MM'. */
export function monthRange(month: string): DateRange {
  const [year, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  // Day 0 of the next month is the last day of this one, so February needs no
  // special case and neither does a leap year.
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** What to call a range in a filename: the month's short name when it is
 *  exactly a month, the two days otherwise. A file called 'september' holding
 *  one week is how the wrong week gets paid. */
export function rangeLabel(range: DateRange) {
  const asMonth = monthRange(range.from.slice(0, 7));
  const whole = range.from === asMonth.from && range.to === asMonth.to;
  return whole ? range.from.slice(0, 7) : `${range.from}_${range.to}`;
}

/** The same range in a sentence. */
export function rangeText(range: DateRange) {
  const asMonth = monthRange(range.from.slice(0, 7));
  if (range.from === asMonth.from && range.to === asMonth.to) {
    return monthLabel(range.from.slice(0, 7));
  }
  if (range.from === range.to) return dateOf(range.from);
  return `${dateOf(range.from)} – ${dateOf(range.to)}`;
}

/** '12 Sep 2026' from a plain calendar day. Read rather than converted — parsed
 *  as UTC a 'YYYY-MM-DD' slides a day backwards west of London. */
function dateOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-SG", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
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

/** Everything needed to make the transfer, split into the lines a screen shows.
 *
 *  THE TWO KINDS NEED DIFFERENT THINGS TYPED IN. PayNow is a mobile number and
 *  the bank is resolved from it; a bank transfer needs the bank, the account
 *  number and the name on the account, and gets rejected if the name does not
 *  match. So a single "pay to" string cannot serve both, and this returns the
 *  parts instead of pretending it can. */
export interface Payout {
  kind: "paynow" | "bank";
  /** 'PayNow' or the bank's name. */
  method: string;
  /** The mobile, or the account number. Full. */
  number: string;
  /** Who the account is in the name of. */
  holder: string | null;
  /** Whether anybody has checked the number is theirs. */
  verification: PayoutVerification;
  /** Whether there is a screenshot to open. */
  hasProof: boolean;
}

export type PayoutVerification = "unverified" | "pending" | "verified" | "rejected";

/** What each state means to somebody about to make a transfer.
 *
 *  Worded about THE TRANSFER rather than about the paperwork: what changes
 *  their next move is whether anybody has checked, not what our queue calls it. */
export const VERIFICATION_LABEL: Record<PayoutVerification, string> = {
  verified: "Checked",
  pending: "Not checked yet",
  rejected: "Did not match",
  unverified: "No proof sent",
};

export function payoutOf(row: PayrollRow): Payout | null {
  if (!row.payoutKind || !row.payoutNumber) return null;

  return {
    kind: row.payoutKind,
    method: row.payoutKind === "paynow" ? "PayNow" : (row.payoutBank ?? "Bank"),
    number: row.payoutNumber,
    // The holder is only asked for on the bank route, and it is the candidate's
    // own name for all but the handful paying into somebody else's account.
    holder: row.payoutHolderName ?? row.candidateName,
    verification: row.payoutVerification ?? "unverified",
    hasProof: Boolean(row.payoutHasProof),
  };
}

/** The same thing on one line, for somewhere too narrow to show the parts. */
export function payoutLabel(row: PayrollRow) {
  const payout = payoutOf(row);
  return payout ? `${payout.method} ${payout.number}` : null;
}

// --- the attendance sheet -----------------------------------------------------------

/** One person, every shift behind them, and the three totals kept apart. */
export interface CandidateSheet {
  candidateId: string;
  name: string;
  phone: string | null;
  /** How to pay them, in parts — null when they have set nothing up, which is
   *  the one thing that stops a transfer. */
  payout: Payout | null;
  shifts: PayrollRow[];
  minutes: number;
  /** Signed off and not yet sent. THE ONLY ONE THAT IS MONEY TO TRANSFER. */
  readyCents: number;
  /** Gone already. */
  paidCents: number;
  /** An estimate against hours no employer has confirmed. */
  awaitingCents: number;
}

/**
 * Every candidate with a shift in the range, and what makes up their total.
 *
 * DISTINCT PER PERSON, because that is what a transfer is: somebody who worked
 * four shifts is one payment, not four. The shifts travel with them rather than
 * being summed away, so "why is this the figure" is answerable on the spot.
 *
 * THE THREE TOTALS ARE NEVER ADDED TOGETHER. Only `readyCents` is money to
 * send — `paidCents` has gone and `awaitingCents` is an estimate that can still
 * move. A single "total owed" column would be the number somebody types into a
 * bank, and it would be wrong twice over.
 */
export function byCandidate(rows: PayrollRow[]): CandidateSheet[] {
  const people = new Map<string, CandidateSheet>();

  for (const row of rows) {
    let person = people.get(row.candidateId);

    if (!person) {
      person = {
        candidateId: row.candidateId,
        name: row.candidateName ?? "Unnamed candidate",
        phone: row.candidatePhone,
        payout: payoutOf(row),
        shifts: [],
        minutes: 0,
        readyCents: 0,
        paidCents: 0,
        awaitingCents: 0,
      };
      people.set(row.candidateId, person);
    }

    person.shifts.push(row);
    person.minutes += row.minutes ?? 0;

    const cents = row.amountCents ?? 0;

    if (row.status === "ready") person.readyCents += cents;
    else if (row.status === "paid") person.paidCents += cents;
    else person.awaitingCents += cents;
  }

  for (const person of people.values()) {
    person.shifts.sort((a, b) => a.shiftOnDate.localeCompare(b.shiftOnDate));
  }

  // Most owed first. The sheet is worked top-down and the biggest transfer is
  // the one worth getting right while somebody is still paying attention.
  return [...people.values()].sort(
    (a, b) => b.readyCents - a.readyCents || a.name.localeCompare(b.name),
  );
}

/** The sheet as a CSV: a line per person, then a line per shift beneath them.
 *
 *  Same shape as the screen rather than a flat table, because this is the file
 *  that gets sent to whoever is making the transfers — the question it answers
 *  is "what is this person owed and why", and the answer should survive being
 *  opened in Excel without anybody sorting it first. */
export function sheetCsv(people: CandidateSheet[], range: DateRange) {
  const cell = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const amount = (cents: number) => (cents / 100).toFixed(2);

  const lines = [
    [`Attendance and payout sheet — ${rangeText(range)}`].map(cell).join(","),
    [
      "Candidate / shift",
      "Phone / role",
      "Method",
      "Account number",
      "Account name",
      "Date",
      "Hours",
      "Rate SGD",
      "Ready SGD",
      "Paid SGD",
      "Waiting SGD",
    ]
      .map(cell)
      .join(","),
  ];

  for (const person of people) {
    lines.push(
      [
        cell(person.name),
        cell(person.phone),
        cell(person.payout?.method ?? "NO ACCOUNT"),
        cell(person.payout?.number),
        cell(person.payout?.holder),
        cell(`${person.shifts.length} shifts`),
        cell(hours(person.minutes)),
        cell(""),
        cell(amount(person.readyCents)),
        cell(amount(person.paidCents)),
        cell(amount(person.awaitingCents)),
      ].join(","),
    );

    for (const shift of person.shifts) {
      const cents = shift.amountCents ?? 0;

      lines.push(
        [
          cell(`    ${shift.companyName}`),
          cell(shift.roleName),
          cell(""),
          cell(""),
          cell(""),
          cell(shift.shiftOnDate),
          cell(hours(shift.minutes)),
          cell(amount(shift.payPerHourCents)),
          cell(shift.status === "ready" ? amount(cents) : ""),
          cell(shift.status === "paid" ? amount(cents) : ""),
          cell(shift.status === "awaiting_signoff" ? amount(cents) : ""),
        ].join(","),
      );
    }
  }

  const sum = (pick: (person: CandidateSheet) => number) =>
    people.reduce((total, person) => total + pick(person), 0);

  lines.push(
    [
      cell(`TOTAL — ${people.length} candidates`),
      cell(""),
      cell(""),
      cell(""),
      cell(""),
      cell(`${people.reduce((n, p) => n + p.shifts.length, 0)} shifts`),
      cell(hours(sum((person) => person.minutes))),
      cell(""),
      cell(amount(sum((person) => person.readyCents))),
      cell(amount(sum((person) => person.paidCents))),
      cell(amount(sum((person) => person.awaitingCents))),
    ].join(","),
  );

  return lines.join("\r\n");
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
  const cell = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const lines = [
    [
      "Name",
      "Phone",
      "Method",
      "Bank",
      "Account number",
      "Account name",
      "Shifts",
      "Amount SGD",
      "Reference",
    ]
      .map(cell)
      .join(","),
  ];

  for (const { row, cents, shifts } of byCandidate.values()) {
    const payout = payoutOf(row);

    lines.push(
      [
        cell(row.candidateName),
        cell(row.candidatePhone),
        // PayNow or the bank's own name — a bulk-upload form asks for different
        // fields depending which, so the two are never flattened to "Bank".
        cell(payout?.kind === "paynow" ? "PayNow" : "Bank"),
        cell(row.payoutBank),
        // THE FULL NUMBER. This file is uploaded to a bank, and four digits was
        // never something it could transfer to.
        cell(payout?.number),
        cell(payout?.holder),
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
export async function downloadPayrollXlsx(range: DateRange, company?: string) {
  const token = await getAccessToken();

  if (!token) throw new Error("Session ended");

  const query = new URLSearchParams({ from: range.from, to: range.to });
  if (company) query.set("company", company);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/admin/reports/payroll.xlsx?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error("Could not build the spreadsheet");

  saveBlob(`adhoc-payroll-${rangeLabel(range)}.xlsx`, await res.blob());
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
