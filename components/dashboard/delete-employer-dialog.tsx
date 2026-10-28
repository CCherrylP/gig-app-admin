"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Delete02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogBody, FormField } from "@/components/dashboard/form";

/** The warning before deleting an employer. Typing DELETE, because there is no undo. */
export function DeleteEmployerDialog({
  employer,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  employer: { userId: string; name: string | null; companyName: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [prevId, setPrevId] = useState<string | null>(null);

  // A different employer, or the dialog closing, starts with an empty box.
  if ((employer?.userId ?? null) !== prevId) {
    setPrevId(employer?.userId ?? null);
    setTyped("");
  }

  const close = () => {
    setTyped("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={!!employer}
      onOpenChange={(open) => {
        if (!open) close();
        else onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5 text-destructive" />
            Delete {employer?.name ?? "this employer"}?
          </DialogTitle>
          <DialogDescription>
            Their login is closed and they are removed from {employer?.companyName ?? "the company"}.
            Their name, phone and photo are wiped. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>The company stays, with its jobs, coins and invoices.</li>
            <li>Jobs they posted keep running. The company admin manages them.</li>
            <li>Not allowed if they are the company&apos;s only admin. Make someone else admin first.</li>
          </ul>

          <FormField label="Type DELETE to confirm" htmlFor="delete-employer-confirm">
            <Input
              id="delete-employer-confirm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </FormField>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={typed.trim() !== "DELETE" || isPending}
            onClick={onConfirm}
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            {isPending ? "Deleting…" : "Delete employer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
