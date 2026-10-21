"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, UserShield01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  InitialsAvatar,
  PageHeader,
  TableShell,
  TableSkeleton,
  initials,
} from "@/components/dashboard/data-views";
import { createAdmin, listAdmins, passwordProblem, removeAdmin, type AdminAccount } from "@/lib/admins";
import { dateTime } from "@/lib/format";

const KEY = ["admins"];

/** Who can sign in to this dashboard, and adding or removing them. */
export default function AdminsPage() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AdminAccount | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: KEY, queryFn: listAdmins });
  const admins = data?.admins ?? [];

  const remove = useMutation({
    mutationFn: (admin: AdminAccount) => removeAdmin(admin.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      setRemoving(null);
      toast.success("Admin removed. They can no longer sign in.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not remove that admin."),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Admins"
        description="People who can sign in to this dashboard. Each one sets up an authenticator app on their first sign-in."
      >
        <Button size="sm" onClick={() => setAdding(true)}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          Add admin
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <EmptyState icon={UserShield01Icon} message="Could not load the admins. Try again." />
          ) : admins.length === 0 ? (
            <EmptyState icon={UserShield01Icon} message="No admins found." />
          ) : (
            <TableShell
              headers={["Admin", "Two-factor", "Last sign-in", "Added", ""]}
              widths={["w-[34%]", "w-[16%]", "w-[20%]", "w-[18%]", "w-[12%]"]}
              exportable={false}
            >
              {admins.map((admin) => (
                <tr key={admin.id} className="align-middle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar seed={admin.id} label={initials(admin.name ?? "")} className="size-8" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {admin.name ?? "Unnamed"}
                          {admin.isYou && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{admin.email ?? "-"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {admin.hasTwoFactor ? (
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">Set up</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Not yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    {admin.lastSignInAt ? dateTime(admin.lastSignInAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">{dateTime(admin.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {!admin.isYou && (
                      <Button variant="destructive" size="xs" onClick={() => setRemoving(admin)}>
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <AddAdminDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => queryClient.invalidateQueries({ queryKey: KEY })}
      />

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this admin?</DialogTitle>
            <DialogDescription>
              {removing?.name ?? "They"} will lose access to this dashboard straight away and can no longer sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" size="sm" onClick={() => setRemoving(null)} disabled={remove.isPending}>
              Keep
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() => removing && remove.mutate(removing)}
            >
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddAdminDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ email: string } | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setTried(false);
    setError("");
    setDone(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const add = useMutation({
    mutationFn: () => createAdmin({ name: name.trim(), email: email.trim(), password }),
    onSuccess: (admin) => {
      onAdded();
      setDone({ email: admin.email ?? email.trim() });
      setPassword("");
    },
    onError: (cause: Error) => setError(cause.message || "Could not add them. Try again."),
  });

  const nameProblem = name.trim().length < 2 ? "Enter their name." : null;
  const emailProblem = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : "Use email format, e.g. jane@adhoc.admin.";
  const passProblem = passwordProblem(password);

  const submit = () => {
    setTried(true);
    setError("");
    if (nameProblem || emailProblem || passProblem) return;
    add.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{done ? "Admin added" : "Add an admin"}</DialogTitle>
          <DialogDescription>
            {done
              ? "Give them the login and password in person or by direct message."
              : "They can sign in straight away. The login doesn't need to be a real email."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col gap-3 px-6 pb-4 text-sm">
            <p>
              Login: <span className="font-medium">{done.email}</span>
            </p>
            <p className="text-muted-foreground">
              On their first sign-in they scan a QR code with an authenticator app, such as Google
              Authenticator or Microsoft Authenticator.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-6 pb-4">
            <Field label="Name" problem={tried ? nameProblem : null}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Tan" autoFocus />
            </Field>
            <Field label="Login" problem={tried ? emailProblem : null}>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@adhoc.admin"
                autoComplete="off"
              />
            </Field>
            <Field label="Password" problem={tried ? passProblem : null} hint="At least 12 characters, with a letter and a number.">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          {done ? (
            <Button size="sm" onClick={close}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={close} disabled={add.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={add.isPending}>
                {add.isPending ? "Adding…" : "Add admin"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  problem,
  hint,
  children,
}: {
  label: string;
  problem: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {problem ? (
        <span className="text-xs text-red-600 dark:text-red-400">{problem}</span>
      ) : (
        hint && <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}
