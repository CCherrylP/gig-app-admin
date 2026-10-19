import { fetchWithAuth } from "./api";
import {
  addDays,
  byCandidate,
  saveBlob,
  today,
  type PayoutVerification,
  type PayrollRow,
} from "./reports";

/** What the server says the file may pay. Shapes match gig-app-api contract/reports.ts. */
export interface BankExportResponse {
  /** The rows to build the file from. Only newly stamped ones, unless `again`. */
  rows: PayrollRow[];
  /** Ready rows an earlier file already had. */
  alreadyExported: PayrollRow[];
}

/** Stamp these rows as exported on the server, and get back the ones this file may pay. */
export function stampBankExport(applicationIds: string[], again = false) {
  return fetchWithAuth<BankExportResponse>("/admin/reports/payroll/bank-export", {
    method: "POST",
    body: JSON.stringify({ applicationIds, again }),
  });
}

/** Ready rows that an earlier bank file already had. */
export const exportedBefore = (rows: PayrollRow[]) =>
  rows.filter((row) => row.status === "ready" && Boolean(row.bankExportedAt));

/** The ready rows behind the people in a file, which is what the server stamps. */
export const rowIdsFor = (rows: PayrollRow[], lines: BankFileLine[]) => {
  const people = new Set(lines.map((line) => line.candidateId));
  return rows
    .filter((row) => row.status === "ready" && people.has(row.candidateId))
    .map((row) => row.applicationId);
};

/** Why an unchecked account is left out of the file. */
const NOT_VERIFIED: Partial<Record<PayoutVerification, string>> = {
  pending: "Account not checked yet",
  rejected: "Account did not match, fix it first",
  unverified: "No account proof sent",
};

// The OCBC bulk-payment file (GIRO, salary). Fixed width, not a CSV.
//
// THE LAYOUT IS COPIED FROM A FILE THE BANK ALREADY ACCEPTED, not from a spec —
// every offset below is where that file had the field, and the output matches
// it character for character. A header of 1000 characters, then one line of
// 1004 per person:
//
//   header  0 created DDMMYYYY · 8 HHMMSS · 14 org id · 22 value date DDMMYYYY
//           30 our account (34) · 64 our name (140) · 238 batch text
//           278 'C' · 998 '01'
//   detail  0 '22' salary credit · 2 reference (35) · 37 bank SWIFT code (35)
//           72 account (34) · 106 name (144) · 250 'SALA' · 254 'SGD'
//           257 amount in cents, 11 digits · 443 'N' · 1002 '10'
//
// A field that runs long is cut, never allowed to push the next one along: one
// character out and the bank reads every later field from the wrong place.

/** Who is paying. From the accepted file — change here if the account moves. */
export const BANK_FILE_PAYER = {
  orgId: "MCICAS01",
  account: "0720093410",
  name: "MCI OUTSOURCING PTE LTD",
  batchText: "0000101. DSVR OT",
  /** Each reference is this, the file's SGT time, then a sequence, e.g. DSVR2610161430050001. */
  referencePrefix: "DSVR",
};

/** One line's reference. 20 characters, inside the 35 the field allows. */
export const bankReference = (stamp: string, n: number) =>
  `${BANK_FILE_PAYER.referencePrefix}${stamp}${String(n + 1).padStart(4, "0")}`;

/** The banks the app offers (gig-app PayoutDetails) to their SWIFT codes. Retail
 *  codes where a bank has two — these are personal accounts. */
const SWIFT: Record<string, string> = {
  "DBS / POSB": "DBSSSGSGXXX",
  OCBC: "OCBCSGSGXXX",
  UOB: "UOVBSGSGXXX",
  Maybank: "MBBESGS2XXX",
  "Standard Chartered": "SCBLSG22XXX",
  HSBC: "HSBCSGS2XXX",
  CIMB: "CIBBSGSGXXX",
  Trust: "TRUTSGSGXXX",
};

const HEADER_LENGTH = 1000;
const DETAIL_LENGTH = 1004;

export interface BankFileLine {
  candidateId: string;
  name: string;
  swift: string;
  account: string;
  cents: number;
}

export interface BankFileSkip {
  candidateId: string;
  name: string;
  cents: number;
  reason: string;
}

/** Who goes in the file and who cannot, from the payroll rows on screen.
 *
 *  Ready money only, one line per person — the same rule as every other
 *  export here. PayNow people are left out rather than guessed at: this file
 *  pays account numbers, and a mobile in the account field pays nobody. */
export function bankFilePlan(rows: PayrollRow[]) {
  const lines: BankFileLine[] = [];
  const skipped: BankFileSkip[] = [];

  for (const person of byCandidate(rows)) {
    if (person.readyCents <= 0) continue;

    const skip = (reason: string) =>
      skipped.push({
        candidateId: person.candidateId,
        name: person.name,
        cents: person.readyCents,
        reason,
      });

    const payout = person.payout;

    if (!payout) {
      skip("No account");
      continue;
    }
    if (payout.kind === "paynow") {
      skip("PayNow, pay by hand");
      continue;
    }
    // Only accounts an admin has checked go in a file that moves money.
    if (payout.verification !== "verified") {
      skip(NOT_VERIFIED[payout.verification] ?? "Account not checked yet");
      continue;
    }

    const swift = SWIFT[payout.method];
    if (!swift) {
      skip(`Unknown bank "${payout.method}"`);
      continue;
    }

    // Digits only. People type '501-123456-001' and the bank wants the digits.
    const account = payout.number.replace(/\D/g, "");
    if (!account) {
      skip("Account number has no digits");
      continue;
    }

    const name = clean(payout.holder || person.name);
    if (!name) {
      skip("Account name can't be written in the bank file");
      continue;
    }

    lines.push({
      candidateId: person.candidateId,
      name,
      swift,
      account,
      cents: person.readyCents,
    });
  }

  return { lines, skipped };
}

/** Download the file. Plain ASCII through `saveBlob`, NOT `downloadCsv` — that
 *  puts a byte-order mark in front for Excel, and here it would sit in the
 *  first column and shift the whole header by three bytes. */
export function downloadBankFile(lines: BankFileLine[], valueDate: string) {
  saveBlob(
    `bank-payroll-${valueDate}.csv`,
    new Blob([bankFile(lines, valueDate)], { type: "text/csv" }),
  );
  rememberBankFileDownload(
    lines.length,
    lines.reduce((sum, line) => sum + line.cents, 0),
  );
}

/** 0 is Sunday, 6 is Saturday, for a 'YYYY-MM-DD' day. */
const weekdayOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** The next weekday after today — a sensible default value date. */
export function nextWorkingDay(from = today()) {
  let day = addDays(from, 1);
  while (weekdayOf(day) === 0 || weekdayOf(day) === 6) day = addDays(day, 1);
  return day;
}

/** Why a value date can't be used, or null when it is fine. Public holidays are not checked. */
export function valueDateProblem(day: string, now = today()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "Pick a value date.";
  if (day < now) return "The value date is in the past.";
  if (weekdayOf(day) === 0 || weekdayOf(day) === 6) return "The value date is a weekend. Banks don't pay on weekends.";
  return null;
}

const LAST_DOWNLOAD_KEY = "adhoc.bankFile.lastDownload";

/** When this browser last downloaded a bank file, or null. */
export function lastBankFileDownload(): { at: string; people: number; cents: number } | null {
  try {
    const raw = window.localStorage.getItem(LAST_DOWNLOAD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function rememberBankFileDownload(people: number, cents: number) {
  try {
    window.localStorage.setItem(
      LAST_DOWNLOAD_KEY,
      JSON.stringify({ at: new Date().toISOString(), people, cents }),
    );
  } catch {
    // Storage blocked. The warning in the dialog still shows.
  }
}

/** The file itself. `valueDate` is 'YYYY-MM-DD', the day the money lands. */
export function bankFile(lines: BankFileLine[], valueDate: string, now = new Date()) {
  const sg = (options: Intl.DateTimeFormatOptions) =>
    now.toLocaleString("en-GB", { timeZone: "Asia/Singapore", hour12: false, ...options });

  const created =
    sg({ day: "2-digit" }) + sg({ month: "2-digit" }) + sg({ year: "numeric" });
  const time = sg({ hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\D/g, "");
  // References are unique per file: prefix, YYMMDDHHMMSS (SGT), then a 4-digit line number.
  const stamp = created.slice(6, 8) + created.slice(2, 4) + created.slice(0, 2) + time;

  const header = record(HEADER_LENGTH, [
    [0, created],
    [8, time],
    [14, BANK_FILE_PAYER.orgId],
    [22, ddmmyyyy(valueDate)],
    [30, BANK_FILE_PAYER.account, 34],
    [64, clean(BANK_FILE_PAYER.name), 140],
    [238, BANK_FILE_PAYER.batchText, 40],
    [278, "C"],
    [998, "01"],
  ]);

  const details = lines.map((line, n) =>
    record(DETAIL_LENGTH, [
      [0, "22"],
      [2, bankReference(stamp, n), 35],
      [37, line.swift, 35],
      [72, line.account, 34],
      [106, clean(line.name), 144],
      [250, "SALA"],
      [254, "SGD"],
      [257, String(line.cents).padStart(11, "0"), 11],
      [443, "N"],
      [1002, "10"],
    ]),
  );

  return [header, ...details].join("\r\n") + "\r\n";
}

/** One record: spaces, with each field written at its offset and cut to width. */
function record(length: number, fields: [at: number, value: string, width?: number][]) {
  const chars = Array<string>(length).fill(" ");
  for (const [at, value, width] of fields) {
    const text = value.slice(0, width ?? value.length);
    for (let i = 0; i < text.length; i++) chars[at + i] = text[i];
  }
  return chars.join("");
}

/** 'YYYY-MM-DD' -> 'DDMMYYYY'. */
const ddmmyyyy = (day: string) => day.split("-").reverse().join("");

/** Upper case, and only what GIRO takes in a name — anything else is rejected
 *  by the bank, or worse, turned into a character in the wrong column. */
const clean = (name: string) =>
  name
    .normalize("NFKD")
    .toUpperCase()
    .replace(/[^A-Z0-9 /\-?:().,'+]/g, "")
    .replace(/\s+/g, " ")
    .trim();
