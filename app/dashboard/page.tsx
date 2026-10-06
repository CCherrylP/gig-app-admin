"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { QueuePanel } from "@/components/dashboard/data-views";
import {
  WORK_QUEUES,
  firstWaiting,
  workTotal,
  type WorkQueue,
} from "@/components/dashboard/work-queues";
import { LOOKS, type SectionLook } from "@/components/dashboard/section-look";
import { CountUp } from "@/components/dashboard/count-up";
import { MoneyChart, ShiftsChart } from "@/components/dashboard/home-charts";
import { ActivityFeed, buildFeed } from "@/components/dashboard/activity-feed";
import { useAdminCounts } from "@/hooks/use-admin-counts";
import { getCachedUser } from "@/lib/auth";
import { listCertificates } from "@/lib/certificates";
import { listAppeals, groundLabel } from "@/lib/appeals";
import { listEmployers } from "@/lib/employers";
import { listInvoices } from "@/lib/invoices";
import { certName } from "@/lib/certs-catalogue";
import { date, greeting, hoursSince, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

// Home: what is waiting on staff, how the next fortnight and the money look,
// what has been happening, and who has waited longest.
//
// THE LIST OF QUEUES IS SHARED with the bell in the header — see
// components/dashboard/work-queues. It used to be written out here as well, and
// two copies of "what is waiting" is a bell that says 4 above a list that says 5.
//
// WHY IT HAS COLOUR, CHARTS AND MOTION NOW. It was a correct page that read as a
// dead one: one grey list in which a queue of twelve and a queue of none looked
// nearly alike, and nothing on it ever moved. Each queue keeps one colour and
// icon everywhere (components/dashboard/section-look), so the eye learns "violet
// is certificates" once and stops reading labels.

const lookOf = (queue: WorkQueue): SectionLook =>
  (LOOKS as Record<string, SectionLook>)[queue.count] ?? LOOKS.support;

/** The first word of a name, for a greeting rather than a form letter. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const { data: counts, isLoading, dataUpdatedAt } = useAdminCounts();
  // Read once on mount: the clock and localStorage are both impure, and a
  // greeting that changes under somebody's cursor helps nobody.
  const [{ part, day }] = useState(greeting);
  const [user] = useState(getCachedUser);

  const waiting = workTotal(counts);
  const clear = WORK_QUEUES.filter((q) => !(counts?.[q.count] ?? 0)).length;
  const busy = WORK_QUEUES.length - clear;
  const next = WORK_QUEUES.find((q) => (counts?.[q.count] ?? 0) > 0);
  const allClear = !isLoading && waiting === 0;
  const name = firstName(user.name);

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-6 animate-in fade-in slide-in-from-top-2 duration-500",
        allClear
          ? "bg-linear-to-br from-emerald-100/80 via-card to-card dark:from-emerald-950/50"
          : "bg-linear-to-br from-primary/15 via-violet-50/40 to-card dark:via-violet-950/20",
      )}
    >
      {/* Two soft blobs of colour behind the greeting. Decoration, and the only
          decoration on the page — everything else that is coloured means a
          queue. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-1/3 size-56 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10"
      />

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">{day}</p>
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
            {part}
            {name && `, ${name}`} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Checking what came in…"
              : allClear
                ? "Every queue is clear. Nothing is waiting on you."
                : `${waiting} ${waiting === 1 ? "thing is" : "things are"} waiting across ${busy} ${
                    busy === 1 ? "queue" : "queues"
                  }.`}
          </p>
          {/* The counts poll every thirty seconds; saying so is what makes a
              quiet page read as watched rather than stale. */}
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live
            {dataUpdatedAt > 0 &&
              ` · updated ${new Date(dataUpdatedAt).toLocaleTimeString("en-SG", {
                timeZone: "Asia/Singapore",
                hour: "numeric",
                minute: "2-digit",
              })}`}
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-16 w-40 rounded-xl" />
        ) : allClear ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-100/80 px-4 py-3 text-emerald-800 animate-in zoom-in-95 dark:bg-emerald-900/40 dark:text-emerald-200">
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={1.8} className="size-6" />
            <span className="text-sm font-medium">All clear. Nice work.</span>
          </div>
        ) : (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="font-heading text-5xl font-semibold leading-none">
                <CountUp value={waiting} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">waiting on you</p>
            </div>
            <Button size="lg" render={<Link href={firstWaiting(counts)} />}>
              Start with {next?.label ?? "the queue"}
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Button>
          </div>
        )}
      </div>

      {/* One segment per queue, in to-do order: amber where something waits,
          green where it is done. How far through the day is, at a glance. */}
      <div className="relative mt-6 flex flex-col gap-2">
        <div className="flex gap-1">
          {WORK_QUEUES.map((queue) => {
            const count = counts?.[queue.count] ?? 0;
            return (
              <Link
                key={queue.url + queue.count}
                href={queue.url}
                title={`${queue.label}: ${count ? `${count} waiting` : "clear"}`}
                className={cn(
                  "h-2 flex-1 rounded-full transition-all duration-500 hover:scale-y-150",
                  isLoading
                    ? "animate-pulse bg-muted"
                    : count > 0
                      ? "bg-amber-400 dark:bg-amber-500"
                      : "bg-emerald-400 dark:bg-emerald-500",
                )}
              />
            );
          })}
        </div>
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {clear} of {WORK_QUEUES.length} queues clear
          </p>
        )}
      </div>
    </Card>
  );
}

// ─── Queue tiles ──────────────────────────────────────────────────────────────

function QueueTiles() {
  const { data: counts, isLoading } = useAdminCounts();

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {WORK_QUEUES.map((queue, index) => {
        const count = counts?.[queue.count] ?? 0;
        const look = lookOf(queue);
        const live = count > 0;

        return (
          <Link
            key={queue.url + queue.count}
            href={queue.url}
            style={{ animationDelay: `${index * 50}ms` }}
            className={cn(
              "group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
              "animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-fill-mode:both]",
              live ? "border-amber-300/70 dark:border-amber-700/60" : "border-border",
            )}
          >
            {/* A strip of the queue's colour along the top edge, only while it
                has work — a full queue reads as lit, an empty one as resting. */}
            {live && (
              <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", look.tint)} />
            )}
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6",
                  live ? look.tint : "bg-muted text-muted-foreground",
                )}
              >
                <HugeiconsIcon icon={look.icon} strokeWidth={1.8} className="size-5" />
              </span>
              {isLoading ? (
                <Skeleton className="h-7 w-8" />
              ) : live ? (
                <span className="font-heading text-3xl font-semibold leading-none">
                  {count > 99 ? "99+" : <CountUp value={count} />}
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5" />
                  Clear
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-medium">
                {queue.label}
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className="size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                />
              </p>
              <p className="truncate text-xs text-muted-foreground">{queue.note}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Oldest first — the order a queue is worked in. */
const oldestFirst = <T,>(rows: T[], at: (row: T) => string) =>
  [...rows].sort((a, b) => at(a).localeCompare(at(b)));

export default function DashboardPage() {
  // The WHOLE of each list rather than its pending slice, because the activity
  // feed needs the decided rows too — and the panels below take their pending
  // rows out of the same response rather than asking a second time. The keys
  // match the queue pages' own "all" tabs, so opening one is already cached.
  const employers = useQuery({
    queryKey: ["employers", "all"],
    queryFn: () => listEmployers("all"),
  });
  const certificates = useQuery({
    queryKey: ["certificates", "all"],
    queryFn: () => listCertificates("all"),
  });
  const appeals = useQuery({
    queryKey: ["appeals", "all"],
    queryFn: () => listAppeals("all"),
  });
  const invoices = useQuery({
    queryKey: ["invoices", "all"],
    queryFn: () => listInvoices("all"),
  });

  const loading =
    employers.isLoading || certificates.isLoading || appeals.isLoading || invoices.isLoading;

  const feed = buildFeed({
    employers: employers.data?.employers ?? [],
    certificates: certificates.data?.reviews ?? [],
    appeals: appeals.data?.appeals ?? [],
    invoices: invoices.data?.invoices ?? [],
  });

  const pendingEmployers = oldestFirst(
    (employers.data?.employers ?? []).filter((e) => e.status === "pending"),
    (e) => e.createdAt,
  );
  const pendingCerts = oldestFirst(
    (certificates.data?.reviews ?? []).filter((c) => c.status === "pending"),
    (c) => c.uploadedAt,
  );
  const pendingAppeals = oldestFirst(
    (appeals.data?.appeals ?? []).filter((a) => a.outcome === "pending"),
    (a) => a.submittedAt,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <Hero />

      <QueueTiles />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ShiftsChart />
          <MoneyChart />
        </div>
        <ActivityFeed events={feed} isLoading={loading} limit={14} />
      </div>

      <div>
        <h2 className="text-lg font-semibold">Waiting longest</h2>
        <p className="text-sm text-muted-foreground">
          Oldest first. Amber after a day, red after three.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <QueuePanel
            title="Employers to verify"
            href="/dashboard/employers"
            icon={LOOKS.employers.icon}
            accent={LOOKS.employers.tint}
            emptyMessage="Nobody waiting on a call."
            rows={pendingEmployers.slice(0, 3).map((employer) => ({
              key: employer.userId,
              seed: employer.userId,
              title: employer.name ?? "Unnamed",
              subtitle: `${employer.companyName} · UEN ${employer.companyUen}`,
              meta: relative(employer.createdAt),
              waitedHours: hoursSince(employer.createdAt),
            }))}
          />

          <QueuePanel
            title="Certificates"
            href="/dashboard/certificates"
            icon={LOOKS.certificates.icon}
            accent={LOOKS.certificates.tint}
            emptyMessage="Nothing awaiting a decision."
            rows={pendingCerts.slice(0, 3).map((review) => ({
              key: `${review.candidateId}-${review.certId}`,
              seed: review.candidateId,
              title: review.candidateName ?? "Unnamed candidate",
              subtitle: certName(review.certId),
              meta: relative(review.uploadedAt),
              waitedHours: hoursSince(review.uploadedAt),
            }))}
          />

          <QueuePanel
            title="Appeals"
            href="/dashboard/appeals"
            icon={LOOKS.appeals.icon}
            accent={LOOKS.appeals.tint}
            emptyMessage="No appeals to decide."
            rows={pendingAppeals.slice(0, 3).map((appeal) => ({
              key: appeal.withdrawalId,
              seed: appeal.candidateId,
              title: appeal.candidateName ?? "Unnamed candidate",
              subtitle: `${groundLabel(appeal.ground)} · shift on ${
                appeal.shiftOnDate ? date(appeal.shiftOnDate) : "an unknown date"
              }`,
              meta: relative(appeal.submittedAt),
              waitedHours: hoursSince(appeal.submittedAt),
            }))}
          />
        </div>
      )}
    </div>
  );
}
