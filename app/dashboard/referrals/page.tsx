"use client";

import { useMemo, useState, type ReactNode } from "react";
import { MoneyTabs } from "@/components/dashboard/section-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  Delete02Icon,
  Download04Icon,
  MoneyBag02Icon,
  UserAdd01Icon,
  UserMultipleIcon,
  WalletDone02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  FilterTabs,
  InitialsAvatar,
  PageHeader,
  StatCard,
  StatusPill,
  TableShell,
  initials,
} from "@/components/dashboard/data-views";
import {
  KIND_LABEL,
  TEAM_LABEL,
  byReferrerCsv,
  createReferral,
  deleteReferral,
  listCommissions,
  listReferralStaff,
  listReferrals,
  markCommissionsPaid,
  rewardLabel,
  setReferralStaff,
  type AdminReferral,
  type CommissionStatus,
  type ReferralStaff,
  type StaffTeam,
} from "@/lib/referrals";
import { currentMonth, downloadCsv, monthLabel, recentMonths } from "@/lib/reports";
import { date, money } from "@/lib/format";

type Section = "staff" | "referrals" | "commissions";

const SECTIONS: { value: Section; label: string }[] = [
  { value: "staff", label: "Staff" },
  { value: "referrals", label: "Referrals" },
  { value: "commissions", label: "Commissions" },
];

const PILL_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  ENDED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  MANUAL: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  PAID: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
};

const SELECT_CLASS = "h-9 rounded-md border border-border bg-background px-3 text-sm";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** A day in Singapore time, e.g. 30 Sep 2026. */
function sgDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ReferralsPage() {
  const [section, setSection] = useState<Section>("staff");

  return (
    <div className="flex flex-col gap-6 p-6">
      <MoneyTabs />
      <PageHeader
        title="Referrals"
        description="Who referred whom, and what they earn from our fee."
      >
        <FilterTabs options={SECTIONS} value={section} onChange={setSection} />
      </PageHeader>

      {section === "staff" && <StaffSection />}
      {section === "referrals" && <ReferralsSection />}
      {section === "commissions" && <CommissionsSection />}
    </div>
  );
}

// --- staff ----------------------------------------------------------------------

function StaffSection() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState<StaffTeam>("bd");
  const [removing, setRemoving] = useState<ReferralStaff | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["referrals", "staff"],
    queryFn: listReferralStaff,
  });

  const save = useMutation({
    mutationFn: setReferralStaff,
    onSuccess: (_, body) => {
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      if (body.team === null) {
        setRemoving(null);
        toast.success("Removed from referral staff");
      } else {
        setEmail("");
        toast.success(`Saved as ${TEAM_LABEL[body.team]} staff`);
      }
    },
    onError: (error) => toast.error(errorText(error, "Could not save that")),
  });

  const trimmed = email.trim();
  const staff = data ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add or change staff</CardTitle>
          <CardDescription>
            BD and TA staff need a candidate account. Enter the email of their
            candidate account. Saving an existing person changes their team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (trimmed) save.mutate({ email: trimmed, team });
            }}
          >
            <Input
              type="email"
              placeholder="Candidate account email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-72"
            />
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value as StaffTeam)}
              className={SELECT_CLASS}
            >
              <option value="bd">BD (businesses)</option>
              <option value="ta">TA (workers)</option>
            </select>
            <Button type="submit" disabled={!trimmed || save.isPending}>
              <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={1.5} className="size-4" />
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingRows />
          ) : staff.length === 0 ? (
            <EmptyState icon={UserMultipleIcon} message="No referral staff yet." />
          ) : (
            <TableShell
              // Team and Code moved under the name. Both are facts about the
              // person rather than things anybody compares down a column, and
              // two narrow columns of "BD" and a short code were most of what
              // made this table look crowded. The counts and money stay as
              // columns of their own, because those ARE added up across rows.
              headers={["Staff", "Referrals", "Active", "Pending", "Cashed out", "Actions"]}
              widths={["w-[34%]", "w-[12%]", "w-[12%]", "w-[14%]", "w-[14%]", "w-[14%]"]}
            >
              {staff.map((person) => {
                const name = person.name ?? "Unnamed";
                return (
                  <tr key={person.userId} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar
                          seed={person.userId}
                          label={initials(name)}
                          className="size-8"
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {person.email ?? "No email"}
                          </span>
                          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                            <span className="shrink-0">{TEAM_LABEL[person.team]} ·</span>
                            <CodeCell code={person.code} />
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{person.referrals}</td>
                    <td className="px-4 py-3 tabular-nums">{person.activeReferrals}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {money(person.pendingCents)}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {money(person.paidCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={!person.email}
                          onClick={() => setRemoving(person)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!removing}
        title="Remove from referral staff"
        description={
          <>
            <span className="font-medium text-foreground">
              {removing?.name ?? removing?.email}
            </span>{" "}
            will stop earning as staff. Commissions already recorded stay.
          </>
        }
        confirmLabel="Remove"
        isPending={save.isPending}
        onOpenChange={(open) => !open && setRemoving(null)}
        onConfirm={() =>
          removing?.email && save.mutate({ email: removing.email, team: null })
        }
      />
    </>
  );
}

function CodeCell({ code }: { code: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Could not copy the code");
    }
  };

  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="truncate font-mono text-xs select-all">{code}</span>
      <Button variant="ghost" size="icon-xs" aria-label={`Copy ${code}`} onClick={copy}>
        <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
      </Button>
    </span>
  );
}

// --- referrals ------------------------------------------------------------------

function ReferralsSection() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [target, setTarget] = useState<"company" | "candidate">("company");
  const [who, setWho] = useState("");
  const [deleting, setDeleting] = useState<AdminReferral | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["referrals", "list"],
    queryFn: listReferrals,
  });

  const create = useMutation({
    mutationFn: createReferral,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      setCode("");
      setWho("");
      toast.success("Referrer set");
    },
    onError: (error) => toast.error(errorText(error, "Could not set the referrer")),
  });

  const remove = useMutation({
    mutationFn: deleteReferral,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      setDeleting(null);
      toast.success("Referral deleted");
    },
    onError: (error) => toast.error(errorText(error, "Could not delete that referral")),
  });

  const codeValue = code.trim();
  const whoValue = who.trim();
  const referrals = data ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set referrer by hand</CardTitle>
          <CardDescription>
            For someone who signed up without a code. This replaces any
            referrer they already have. Any candidate&apos;s code works for a
            company or a candidate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!codeValue || !whoValue) return;
              create.mutate(
                target === "company"
                  ? { code: codeValue, companyUen: whoValue }
                  : { code: codeValue, candidateEmail: whoValue },
              );
            }}
          >
            <Input
              placeholder="Referrer code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-9 w-40 font-mono"
            />
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as "company" | "candidate")}
              className={SELECT_CLASS}
            >
              <option value="company">Company UEN</option>
              <option value="candidate">Candidate email</option>
            </select>
            <Input
              type={target === "candidate" ? "email" : "text"}
              placeholder={target === "company" ? "e.g. 201912345A" : "Candidate email"}
              value={who}
              onChange={(e) => setWho(e.target.value)}
              className="h-9 w-64"
            />
            <Button type="submit" disabled={!codeValue || !whoValue || create.isPending}>
              {create.isPending ? "Saving…" : "Set referrer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingRows />
          ) : referrals.length === 0 ? (
            <EmptyState icon={UserMultipleIcon} message="No referrals yet." />
          ) : (
            <TableShell
              // Six columns, down from nine. A referral is a pair of people, so
              // it reads as two identity cells side by side; Kind went under the
              // referred account it describes, and Started/Ends became one
              // "from → to" line under the status, since the window is what
              // decides whether the row is Active at all. Shifts and Earned keep
              // their own columns because those get added up.
              headers={["Referrer", "Referred", "Status", "Shifts", "Earned", "Actions"]}
              widths={["w-[24%]", "w-[24%]", "w-[22%]", "w-[8%]", "w-[12%]", "w-[10%]"]}
            >
              {referrals.map((row) => {
                const referrerName = row.referrer.name ?? "Unnamed";
                const referredName = row.referred.name ?? "Unnamed";
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar
                          seed={row.referrer.id}
                          label={initials(referrerName)}
                          className="size-8"
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{referrerName}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            <span className="font-mono">{row.referrer.code ?? "No code"}</span>
                            {row.referrer.team ? ` · ${TEAM_LABEL[row.referrer.team]}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar
                          seed={row.referred.id}
                          label={initials(referredName)}
                          className="size-8"
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{referredName}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {row.referred.type === "company" ? "Company" : "Candidate"} ·{" "}
                            {KIND_LABEL[row.kind]}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <StatusPill
                          status={row.active ? "active" : "ended"}
                          label={row.active ? "Active" : "Ended"}
                          styles={PILL_STYLES}
                        />
                        {row.manual && (
                          <span className="truncate text-[11px] font-medium text-violet-600 dark:text-violet-400">
                            Manual
                          </span>
                        )}
                        <span className="truncate text-xs text-muted-foreground">
                          {sgDay(row.startedAt)} → {sgDay(row.endsAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.shifts}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {money(row.earnedCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="xs"
                          aria-label="Delete this referral"
                          onClick={() => setDeleting(row)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this referral"
        description={
          deleting && (
            <>
              <span className="font-medium text-foreground">
                {deleting.referrer.name ?? "The referrer"}
              </span>{" "}
              will stop earning on{" "}
              <span className="font-medium text-foreground">
                {deleting.referred.name ?? "this account"}
              </span>
              . Commissions already recorded stay.
            </>
          )
        }
        confirmLabel="Delete"
        isPending={remove.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}

// --- commissions ----------------------------------------------------------------

const STATUS_TABS: { value: CommissionStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Cashed out" },
  { value: "all", label: "All" },
];

function CommissionsSection() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState<CommissionStatus>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["referrals", "commissions", month, status],
    queryFn: () => listCommissions(month, status),
  });

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const byReferrer = data?.byReferrer ?? [];

  const selectable = useMemo(() => rows.filter((row) => !row.paidAt), [rows]);
  const chosen = useMemo(
    () => selectable.filter((row) => selected.has(row.id)),
    [selectable, selected],
  );
  const chosenCents = chosen.reduce((sum, row) => sum + row.amountCents, 0);
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;

  const totalCents = byReferrer.reduce((sum, line) => sum + line.amountCents, 0);
  const pendingCents = byReferrer.reduce((sum, line) => sum + line.pendingCents, 0);

  const markPaid = useMutation({
    mutationFn: markCommissionsPaid,
    onSuccess: (_, ids) => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      toast.success(
        ids.length === 1
          ? "1 commission marked as cashed out"
          : `${ids.length} commissions marked as cashed out`,
      );
    },
    onError: (error) => toast.error(errorText(error, "Could not save that")),
  });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allChosen ? new Set() : new Set(selectable.map((row) => row.id)));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setSelected(new Set());
            }}
            className={SELECT_CLASS}
          >
            {recentMonths().map((value) => (
              <option key={value} value={value}>
                {monthLabel(value)}
              </option>
            ))}
          </select>
          <FilterTabs
            options={STATUS_TABS}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setSelected(new Set());
            }}
          />
        </div>
        <Button
          variant="outline"
          disabled={byReferrer.length === 0}
          onClick={() =>
            downloadCsv(`adhoc-referrals-${month}.csv`, byReferrerCsv(byReferrer))
          }
        >
          <HugeiconsIcon icon={Download04Icon} strokeWidth={1.5} className="size-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={`Not cashed out · ${monthLabel(month)}`}
          count={money(pendingCents)}
          icon={Clock01Icon}
          cls="text-amber-600"
        />
        <StatCard
          label={`Total earned · ${monthLabel(month)}`}
          count={money(totalCents)}
          icon={WalletDone02Icon}
          cls="text-emerald-600"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By referrer</CardTitle>
          <CardDescription>One line per person. Payouts also show in Payroll.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingRows />
          ) : byReferrer.length === 0 ? (
            <EmptyState icon={MoneyBag02Icon} message="No commissions for this month." />
          ) : (
            <TableShell
              // Team went under the name: it says which kind of referrer this
              // is, which is a fact about the person, not a figure to total.
              headers={["Referrer", "Shifts", "Total", "Not cashed out"]}
              widths={["w-[46%]", "w-[14%]", "w-[20%]", "w-[20%]"]}
            >
              {byReferrer.map((line) => {
                const name = line.name ?? "Unnamed";
                return (
                  <tr key={line.referrerId} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar
                          seed={line.referrerId}
                          label={initials(name)}
                          className="size-8"
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {line.team ? TEAM_LABEL[line.team] : "Candidate"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{line.shifts}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {money(line.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {money(line.pendingCents)}
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Commissions</CardTitle>
            {chosen.length > 0 && (
              <Button
                onClick={() => markPaid.mutate(chosen.map((row) => row.id))}
                disabled={markPaid.isPending}
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  strokeWidth={1.5}
                  className="size-4"
                />
                Mark {chosen.length} cashed out · {money(chosenCents)}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingRows />
          ) : rows.length === 0 ? (
            <EmptyState icon={MoneyBag02Icon} message="Nothing here for this month." />
          ) : (
            <TableShell
              headers={[
                <input
                  key="all"
                  type="checkbox"
                  aria-label="Select every row not cashed out"
                  checked={allChosen}
                  onChange={toggleAll}
                  disabled={selectable.length === 0}
                  className="size-4 align-middle accent-primary"
                />,
                "Referrer",
                "Shift",
                "Fee",
                "Amount",
                "Status",
              ]}
              // Referred and Rate went under the referrer. Who was referred is
              // the other half of the same pairing, and the rate belongs to the
              // kind of referral sitting on that line — it explains the Amount,
              // it is not something anybody totals. Fee stays its own column so
              // it still exports as a number.
              widths={["w-[4%]", "w-[30%]", "w-[24%]", "w-[11%]", "w-[17%]", "w-[14%]"]}
            >
              {rows.map((row) => {
                const name = row.referrer.name ?? "Unnamed";
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select commission for ${row.referrer.name ?? "this referrer"}`}
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        disabled={!!row.paidAt}
                        className="size-4 accent-primary disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar
                          seed={row.referrer.id}
                          label={initials(name)}
                          className="size-8"
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            Referred {row.referredName ?? "Unnamed"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {KIND_LABEL[row.kind]} · {row.ratePct}% of fee
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{row.companyName}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {row.roleName} · {date(row.shiftDate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {money(row.feeCents)}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {rewardLabel(row)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusPill
                        status={row.paidAt ? "paid" : "pending"}
                        label={row.paidAt ? `Cashed out ${sgDay(row.paidAt)}` : "Pending"}
                        styles={PILL_STYLES}
                      />
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// --- shared ---------------------------------------------------------------------

function LoadingRows() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }, (_, n) => (
        <Skeleton key={n} className="h-10 w-full" />
      ))}
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Back
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Saving…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
