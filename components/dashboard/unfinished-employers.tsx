"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, BuildingIcon, Delete02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  EmptyState,
  InitialsAvatar,
  TableShell,
  TableSkeleton,
  initials,
} from "@/components/dashboard/data-views";
import { deleteUnfinishedEmployer, type UnfinishedEmployer } from "@/lib/employers";
import { relative } from "@/lib/format";

/** Employer logins with no company, so they show nowhere else. Staff can delete them here. */
export function UnfinishedEmployers({
  employers,
  isLoading,
  search,
}: {
  employers: UnfinishedEmployer[] | undefined;
  isLoading: boolean;
  search: string;
}) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<UnfinishedEmployer | null>(null);
  const [typed, setTyped] = useState("");

  const remove = useMutation({
    mutationFn: (employer: UnfinishedEmployer) => deleteUnfinishedEmployer(employer.userId),
    onSuccess: (_result, employer) => {
      queryClient.invalidateQueries({ queryKey: ["employers-unfinished"] });
      setDeleting(null);
      toast.success(`${employer.name ?? employer.email ?? "Login"} deleted`);
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete this login"),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = employers ?? [];
    if (!term) return all;
    return all.filter((row) =>
      [row.name ?? "", row.email ?? "", row.phone ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [employers, search]);

  const open = (employer: UnfinishedEmployer) => {
    setTyped("");
    setDeleting(employer);
  };

  return (
    <>
      <p className="-mt-2 text-sm text-muted-foreground">
        Logins with no company: people removed from a team, and sign-ups that stopped halfway.
        They can&apos;t post jobs or see any company.
      </p>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={BuildingIcon}
              message={search ? "No results match your search." : "No unfinished employers."}
            />
          ) : (
            <TableShell
              headers={["Person", "Contact", "Logged in", "Actions"]}
              widths={["w-[30%]", "w-[34%]", "w-[16%]", "w-[20%]"]}
            >
              {rows.map((row) => (
                <tr key={row.userId} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar
                        seed={row.userId}
                        label={initials(row.name ?? row.email ?? "?")}
                        className="size-8"
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{row.name ?? "Unnamed"}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          Created {relative(row.createdAt)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{row.email ?? "No email"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.phone ?? "No phone"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{row.hasLoggedIn ? "Yes" : "Never"}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => open(row)}>
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleting} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5 text-destructive" />
              Delete {deleting?.name ?? deleting?.email ?? "this login"}?
            </DialogTitle>
            <DialogDescription>
              Their login is closed for good and their email is freed, so it can be used again.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <FormField label="Type DELETE to confirm" htmlFor="delete-unfinished-confirm">
              <Input
                id="delete-unfinished-confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
              />
            </FormField>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={typed.trim() !== "DELETE" || remove.isPending}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              {remove.isPending ? "Deleting…" : "Delete login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
