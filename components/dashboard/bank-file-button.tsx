"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, BankIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bankFilePlan,
  downloadBankFile,
  exportedBefore,
  lastBankFileDownload,
  nextWorkingDay,
  rowIdsFor,
  stampBankExport,
  valueDateProblem,
} from "@/lib/bank-file";
import { selectClass } from "@/components/dashboard/form";
import { money } from "@/lib/format";
import type { PayrollRow } from "@/lib/reports";

/** "27 Oct, 5:11 pm" in Singapore time. */
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/** One name and amount in a list. */
function PersonRow({ name, note, cents }: { name: string; note?: string; cents: number }) {
  return (
    <li className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm">{name}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <span className="shrink-0 text-sm tabular-nums">{money(cents)}</span>
    </li>
  );
}

/** "Already exported by Siti at 18 Oct, 14:05" for one person's earlier rows. */
const exportedLine = (rows: PayrollRow[]) => {
  const latest = rows.reduce<PayrollRow | null>(
    (best, row) => (!best || (row.bankExportedAt ?? "") > (best.bankExportedAt ?? "") ? row : best),
    null,
  );
  const at = latest?.bankExportedAt
    ? new Date(latest.bankExportedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })
    : "an earlier time";
  return `Already exported by ${latest?.bankExportedByName ?? "another admin"} at ${at}`;
};

/** Earlier-exported rows, one entry per person. */
const exportedPeople = (rows: PayrollRow[]) => {
  const byPerson = new Map<string, PayrollRow[]>();
  for (const row of exportedBefore(rows)) {
    byPerson.set(row.candidateId, [...(byPerson.get(row.candidateId) ?? []), row]);
  }
  return [...byPerson.entries()].map(([candidateId, list]) => ({
    candidateId,
    name: list[0]?.candidateName ?? "Unnamed candidate",
    cents: list.reduce((sum, row) => sum + (row.amountCents ?? 0), 0),
    line: exportedLine(list),
  }));
};

/** THE BANK UPLOAD FILE, on both payroll pages. Behind a dialog so the value
 *  date and who is NOT in the file are seen before money moves. */
export function BankFileButton({ rows }: { rows: PayrollRow[] }) {
  const [open, setOpen] = useState(false);
  const [valueDate, setValueDate] = useState("");
  const [last, setLast] = useState<ReturnType<typeof lastBankFileDownload>>(null);
  const [understood, setUnderstood] = useState(false);
  const [again, setAgain] = useState(false);
  const [busy, setBusy] = useState(false);

  // Rows an earlier file had are left out unless "Export again" is ticked.
  const fresh = useMemo(() => rows.filter((row) => !row.bankExportedAt), [rows]);
  const earlier = useMemo(() => exportedPeople(rows), [rows]);
  const plan = useMemo(() => bankFilePlan(again ? rows : fresh), [again, rows, fresh]);
  const total = plan.lines.reduce((sum, line) => sum + line.cents, 0);
  const everyone = useMemo(() => bankFilePlan(rows), [rows]);
  const anyReady = everyone.lines.length + everyone.skipped.length > 0;
  const dateProblem = valueDate ? valueDateProblem(valueDate) : null;

  // The default date and the last download are read when the dialog opens, not when the page loads.
  const openDialog = () => {
    setValueDate(nextWorkingDay());
    setLast(lastBankFileDownload());
    setUnderstood(false);
    setAgain(false);
    setOpen(true);
  };

  // The server stamps the rows first and says which ones this file may pay.
  const download = async () => {
    setBusy(true);
    try {
      const ids = rowIdsFor(again ? rows : fresh, plan.lines);
      const answer = await stampBankExport(ids, again);
      const final = bankFilePlan(answer.rows);

      if (!again && answer.alreadyExported.length > 0) {
        toast.warning(
          `${exportedPeople(answer.alreadyExported).length} left out. Another admin exported them a moment ago.`,
        );
      }

      if (final.lines.length === 0) {
        toast.error("No one is left to include in the file. Reload the page to see who was exported.");
        return;
      }

      downloadBankFile(final.lines, valueDate);
      if (again) toast.warning("This file includes people from an earlier file. Upload only one of them.");
      setOpen(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not prepare the bank file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={openDialog} disabled={!anyReady}>
        <HugeiconsIcon icon={BankIcon} strokeWidth={1.5} className="size-4" />
        Download bank file
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Download bank file</DialogTitle>
            <DialogDescription>
              The OCBC file for everyone paid by bank transfer. Mark them as paid here once
              accounts confirm.
            </DialogDescription>
            <ol className="mt-3 grid grid-cols-3 gap-2 text-xs">
              {["Download the file", "Send it to accounts", "Accounts upload it to OCBC"].map((step, i) => (
                <li key={step} className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background font-medium">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 pb-6">
            <section className="rounded-lg border">
              <div className="flex items-end justify-between gap-4 border-b px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">In this file</p>
                  <p className="text-sm font-medium">{people(plan.lines.length)}</p>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{money(total)}</p>
              </div>
              {plan.lines.length > 0 ? (
                <ul className="divide-y px-4">
                  {plan.lines.map((line) => (
                    <PersonRow key={line.candidateId} name={line.name} cents={line.cents} />
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No one can go in the file right now.
                </p>
              )}
            </section>

            <div className="space-y-1.5">
              <label htmlFor="value-date" className="text-sm font-medium">
                Payment date
              </label>
              <input
                id="value-date"
                type="date"
                value={valueDate}
                onChange={(event) => setValueDate(event.target.value || nextWorkingDay())}
                className={selectClass}
              />
              <p className="text-xs text-muted-foreground">
                {dateProblem ?? "The day the money reaches their bank."}
              </p>
            </div>

            {plan.skipped.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-medium">Pay these yourself</h3>
                <p className="text-xs text-muted-foreground">
                  They can&apos;t go in the bank file. Pay them another way, then mark them as paid.
                </p>
                <ul className="divide-y rounded-lg border px-4">
                  {plan.skipped.map((person) => (
                    <PersonRow
                      key={person.candidateId}
                      name={person.name}
                      note={person.reason}
                      cents={person.cents}
                    />
                  ))}
                </ul>
              </section>
            )}

            {earlier.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-medium">Already in an earlier file</h3>
                <p className="text-xs text-muted-foreground">
                  {again
                    ? "They will be added to this file too."
                    : "Left out, so they aren't paid twice."}
                </p>
                <ul className="divide-y rounded-lg border px-4">
                  {earlier.map((person) => (
                    <PersonRow
                      key={person.candidateId}
                      name={person.name}
                      note={person.line}
                      cents={person.cents}
                    />
                  ))}
                </ul>
                <label className="flex items-start gap-2 pt-1 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={again}
                    onChange={(event) => setAgain(event.target.checked)}
                  />
                  Add them again. Only if that file was never sent to accounts.
                </label>
              </section>
            )}

            <section className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex gap-2">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  strokeWidth={1.8}
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Check you haven&apos;t paid them already</p>
                  <p className="text-muted-foreground">
                    {last
                      ? `You last downloaded a file on ${when(last.at)} (${people(last.people)}, ${money(last.cents)}). If it was sent to accounts, the same people could be paid twice.`
                      : "You haven't downloaded a file in this browser. Another admin may have, so check before you send it."}
                  </p>
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={understood}
                  onChange={(event) => setUnderstood(event.target.checked)}
                />
                I checked. No one in this file was in a file already sent to accounts.
              </label>
            </section>
          </div>

          <DialogFooter className="justify-between">
            <p className="text-xs text-muted-foreground">
              {plan.lines.length === 0
                ? "No one to put in the file."
                : !valueDate || dateProblem
                  ? "Pick a payment date."
                  : !understood
                    ? "Tick the check above to continue."
                    : ""}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={
                  busy ||
                  plan.lines.length === 0 ||
                  !valueDate ||
                  Boolean(dateProblem) ||
                  !understood
                }
                onClick={download}
              >
                <HugeiconsIcon icon={BankIcon} strokeWidth={1.5} className="size-4" />
                {busy ? "Preparing…" : again ? "Download again" : "Download file"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
