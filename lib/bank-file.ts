import { addDays, byCandidate, saveBlob, today, type PayrollRow } from "./reports";

// The OCBC bulk-payment file (GIRO, salary). Fixed width, not a CSV.
//
// THE LAYOUT IS COPIED FROM A FILE THE BANK ALREADY ACCEPTED, not from a spec —
// every offset below is where that file had the field. Both record types are
// 1000 characters, a header and then one line per person:
//
//   header  0 created DDMMYYYY · 8 HHMMSS · 14 org id · 22 value date DDMMYYYY
//           30 our account (34) · 64 our name (140) · 238 batch text
//           278 'C' · 998 '01'
//   detail  0 '22' salary credit · 2 reference (35) · 37 SWIFT (35)
//           72 account (34) · 106 name (140) · 246 'SALA' · 250 'SGD'
//           253 amount in cents, 11 digits · 439 'N' · 998 '10'
//
// A field that runs long is cut, never allowed to push the next one along: one
// character out and the bank reads every later field from the wrong place.

/** Who is paying. From the accepted file — change here if the account moves. */
export const BANK_FILE_PAYER = {
  orgId: "MCICAS01",
  account: "0720093410",
  name: "MCI OUTSOURCING PTE LTD",
  batchText: "0000101. DSVR OT",
  /** Each line's reference is this plus a 4-digit sequence, e.g. DSVR0001. */
  referencePrefix: "DSVR",
};

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

const RECORD = 1000;

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
      skip("PayNow — pay by hand");
      continue;
    }

    const swift = SWIFT[payout.method];
    if (!swift) {
      skip(`Unknown bank "${payout.method}"`);
      continue;
    }

    lines.push({
      candidateId: person.candidateId,
      name: payout.holder ?? person.name,
      swift,
      // Digits only. People type '501-123456-001' and the bank wants the digits.
      account: payout.number.replace(/\D/g, ""),
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
    `ocbc-giro-${valueDate}.txt`,
    new Blob([bankFile(lines, valueDate)], { type: "text/plain" }),
  );
}

/** The next weekday after today — a sensible default value date. */
export function nextWorkingDay() {
  let day = addDays(today(), 1);
  const weekday = () => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  };
  while (weekday() === 0 || weekday() === 6) day = addDays(day, 1);
  return day;
}

/** The file itself. `valueDate` is 'YYYY-MM-DD', the day the money lands. */
export function bankFile(lines: BankFileLine[], valueDate: string) {
  const now = new Date();
  const sg = (options: Intl.DateTimeFormatOptions) =>
    now.toLocaleString("en-GB", { timeZone: "Asia/Singapore", hour12: false, ...options });

  const created =
    sg({ day: "2-digit" }) + sg({ month: "2-digit" }) + sg({ year: "numeric" });
  const time = sg({ hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\D/g, "");

  const header = record([
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
    record([
      [0, "22"],
      [2, `${BANK_FILE_PAYER.referencePrefix}${String(n + 1).padStart(4, "0")}`, 35],
      [37, line.swift, 35],
      [72, line.account, 34],
      [106, clean(line.name), 140],
      [246, "SALA"],
      [250, "SGD"],
      [253, String(line.cents).padStart(11, "0"), 11],
      [439, "N"],
      [998, "10"],
    ]),
  );

  return [header, ...details].join("\r\n") + "\r\n";
}

/** One record: spaces, with each field written at its offset and cut to width. */
function record(fields: [at: number, value: string, width?: number][]) {
  const chars = Array<string>(RECORD).fill(" ");
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
