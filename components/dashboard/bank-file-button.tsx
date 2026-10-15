"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BankIcon } from "@hugeicons/core-free-icons";

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
  lastBankFileDownload,
  nextWorkingDay,
  valueDateProblem,
} from "@/lib/bank-file";
import { money } from "@/lib/format";
import type { PayrollRow } from "@/lib/reports";

/** THE BANK UPLOAD FILE, on both payroll pages. The filled button in the row,
 *  because it is the one export that ends in money moving.
 *
 *  Behind a dialog rather than straight off the button. Two things have to be
 *  seen before it downloads: the value date, which is in the file and decides
 *  when the money lands, and who is NOT in it — PayNow people and anyone
 *  without a usable bank still need paying by hand, and a file that silently
 *  drops them is how somebody gets missed. */
export function BankFileButton({ rows }: { rows: PayrollRow[] }) {
  const [open, setOpen] = useState(false);
  const [valueDate, setValueDate] = useState("");
  const [last, setLast] = useState<ReturnType<typeof lastBankFileDownload>>(null);
  const [understood, setUnderstood] = useState(false);

  const plan = useMemo(() => bankFilePlan(rows), [rows]);
  const total = plan.lines.reduce((sum, line) => sum + line.cents, 0);
  const anyReady = plan.lines.length + plan.skipped.length > 0;
  const dateProblem = valueDate ? valueDateProblem(valueDate) : null;

  // The default date and the last download are read when the dialog opens, not when the page loads.
  const openDialog = () => {
    setValueDate(nextWorkingDay());
    setLast(lastBankFileDownload());
    setUnderstood(false);
    setOpen(true);
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
              The OCBC bulk salary file for everyone ready to pay by bank transfer. Upload it,
              then mark them paid here once it has gone through.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="value-date" className="text-xs font-medium">
              Value date (the day the money lands)
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
              Downloading twice pays twice.
            </p>
            <p className="text-xs text-muted-foreground">
              Everyone ready goes in every file until you mark them paid. If you already
              uploaded a file, mark those people paid before you download another.
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
              disabled={plan.lines.length === 0 || !valueDate || Boolean(dateProblem) || !understood}
              onClick={() => {
                downloadBankFile(plan.lines, valueDate);
                setOpen(false);
              }}
            >
              <HugeiconsIcon icon={BankIcon} strokeWidth={1.5} className="size-4" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
