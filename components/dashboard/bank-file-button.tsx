"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BankIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { money } from "@/lib/format";
import type { PayrollRow } from "@/lib/reports";

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download bank file</DialogTitle>
            <DialogDescription>
              The OCBC bulk salary file for everyone ready to be paid by bank transfer. Upload
              it, then mark them as paid here once the transfer has gone through.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="value-date" className="text-xs font-medium">
              Value date (the day the payment arrives)
            </label>
            <input
              id="value-date"
              type="date"
              value={valueDate}
              onChange={(event) => setValueDate(event.target.value || nextWorkingDay())}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            />
            {dateProblem && <p className="text-xs text-destructive">{dateProblem}</p>}
          </div>

          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>
                {plan.lines.length} {plan.lines.length === 1 ? "person" : "people"} in the file
              </span>
              <span className="font-medium tabular-nums">{money(total)}</span>
            </div>
          </div>

          {earlier.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-destructive/40 p-3 text-sm">
              <div className="font-medium text-destructive">
                {earlier.length} already in an earlier file{again ? "" : ", left out"}.
              </div>
              {earlier.map((person) => (
                <div
                  key={person.candidateId}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <span>
                    {person.name}
                    <span className="text-muted-foreground"> · {person.line}</span>
                  </span>
                  <span className="tabular-nums">{money(person.cents)}</span>
                </div>
              ))}
              <label className="flex items-center gap-2 pt-1 text-xs">
                <input
                  type="checkbox"
                  checked={again}
                  onChange={(event) => setAgain(event.target.checked)}
                />
                Export again. Only if the earlier file was never uploaded.
              </label>
            </div>
          )}

          {plan.skipped.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-amber-300 p-3 text-sm dark:border-amber-800">
              <div className="font-medium text-amber-700 dark:text-amber-300">
                {plan.skipped.length} not in the file. Pay these separately.
              </div>
              {plan.skipped.map((person) => (
                <div
                  key={person.candidateId}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <span>
                    {person.name}
                    <span className="text-muted-foreground"> · {person.reason}</span>
                  </span>
                  <span className="tabular-nums">{money(person.cents)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
            <p className="font-medium text-destructive">
              Downloading twice can pay people twice.
            </p>
            <p className="text-xs text-muted-foreground">
              Each person should be in one file only. Mark them as paid once the upload has gone through.
            </p>
            <p className="text-xs">
              {last
                ? `Last downloaded in this browser: ${new Date(last.at).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}, ${last.people} ${last.people === 1 ? "person" : "people"}, ${money(last.cents)}.`
                : "No bank file downloaded in this browser yet. Other admins may have downloaded one."}
            </p>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
              />
              No one in this file has been paid by an earlier file.
            </label>
          </div>

          <div className="flex justify-end gap-2">
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
              {busy ? "Preparing…" : again ? "Export again" : "Download"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
