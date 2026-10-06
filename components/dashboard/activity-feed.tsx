"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/data-views";
import { LOOKS, type SectionLook } from "@/components/dashboard/section-look";
import type { EmployerReview } from "@/lib/employers";
import type { CertificateReview } from "@/lib/certificates";
import type { AppealReview } from "@/lib/appeals";
import type { AdminInvoice } from "@/lib/invoices";
import { certName } from "@/lib/certs-catalogue";
import { money, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

// WHAT HAS BEEN HAPPENING, newest first.
//
// THERE IS NO ACTIVITY LOG behind this — the API keeps none. Every line is read
// off a timestamp the queues already carry: a sign-up's createdAt, a
// certificate's uploadedAt and reviewedAt, an invoice's paidAt. So it can only
// say what happened, never who on staff did it; a "by Jane" here would be
// invented. If the API grows an audit trail, this is the component to point at
// it.

export interface FeedEvent {
  key: string;
  at: string;
  text: string;
  detail: string;
  href: string;
  look: SectionLook;
  /** Tints the dot: something decided for, against, or simply arriving. */
  tone: "new" | "good" | "bad";
}

export function buildFeed(sources: {
  employers: EmployerReview[];
  certificates: CertificateReview[];
  appeals: AppealReview[];
  invoices: AdminInvoice[];
}): FeedEvent[] {
  const events: FeedEvent[] = [];

  for (const e of sources.employers) {
    const who = e.name ?? "Someone";
    events.push({
      key: `emp-new-${e.userId}`,
      at: e.createdAt,
      text: `${who} signed up`,
      detail: e.companyName,
      href: `/dashboard/employers/${e.userId}`,
      look: LOOKS.employers,
      tone: "new",
    });
    if (e.reviewedAt && e.status !== "pending") {
      events.push({
        key: `emp-done-${e.userId}`,
        at: e.reviewedAt,
        text: `${who} was ${e.status}`,
        detail: e.companyName,
        href: `/dashboard/employers/${e.userId}`,
        look: LOOKS.employers,
        tone: e.status === "approved" ? "good" : "bad",
      });
    }
  }

  for (const c of sources.certificates) {
    const who = c.candidateName ?? "A candidate";
    events.push({
      key: `cert-new-${c.candidateId}-${c.certId}`,
      at: c.uploadedAt,
      text: `${who} uploaded a certificate`,
      detail: certName(c.certId),
      href: "/dashboard/certificates",
      look: LOOKS.certificates,
      tone: "new",
    });
    if (c.reviewedAt && c.status !== "pending") {
      events.push({
        key: `cert-done-${c.candidateId}-${c.certId}`,
        at: c.reviewedAt,
        text: `${certName(c.certId)} ${c.status}`,
        detail: who,
        href: "/dashboard/certificates",
        look: LOOKS.certificates,
        tone: c.status === "verified" ? "good" : "bad",
      });
    }
  }

  for (const a of sources.appeals) {
    const who = a.candidateName ?? "A candidate";
    events.push({
      key: `appeal-new-${a.withdrawalId}`,
      at: a.submittedAt,
      text: `${who} appealed a penalty`,
      detail: a.companyName ?? "Shift penalty",
      href: "/dashboard/appeals",
      look: LOOKS.appeals,
      tone: "new",
    });
    if (a.reviewedAt && a.outcome !== "pending") {
      events.push({
        key: `appeal-done-${a.withdrawalId}`,
        at: a.reviewedAt,
        text: `Appeal ${a.outcome === "waived" ? "waived" : "upheld"}`,
        detail: who,
        href: "/dashboard/appeals",
        look: LOOKS.appeals,
        // Waived is the candidate's win; upheld keeps the penalty.
        tone: a.outcome === "waived" ? "good" : "bad",
      });
    }
  }

  for (const i of sources.invoices) {
    if (i.paymentProofAt) {
      events.push({
        key: `inv-proof-${i.id}`,
        at: i.paymentProofAt,
        text: `${i.companyName} sent a receipt`,
        detail: `${i.number} · ${money(i.totalCents)}`,
        href: "/dashboard/payments",
        look: LOOKS.invoices,
        tone: "new",
      });
    }
    if (i.paidAt) {
      events.push({
        key: `inv-paid-${i.id}`,
        at: i.paidAt,
        text: `${money(i.totalCents)} received`,
        detail: `${i.companyName} · ${i.number}`,
        href: "/dashboard/invoices",
        look: LOOKS.invoices,
        tone: "good",
      });
    }
  }

  return events
    .filter((event) => !Number.isNaN(new Date(event.at).getTime()))
    .sort((a, b) => b.at.localeCompare(a.at));
}

const TONE_DOT: Record<FeedEvent["tone"], string> = {
  new: "bg-sky-500",
  good: "bg-emerald-500",
  bad: "bg-red-500",
};

export function ActivityFeed({
  events,
  isLoading,
  limit = 12,
}: {
  events: FeedEvent[];
  isLoading: boolean;
  limit?: number;
}) {
  const shown = events.slice(0, limit);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Sign-ups, uploads, decisions and payments.</CardDescription>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {isLoading ? (
          <div className="flex flex-col gap-4 px-6 pb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={LOOKS.support.icon} message="Nothing has happened yet." />
        ) : (
          // A timeline: a thin rule down the left joining the icons, so the list
          // reads as a sequence of things that happened rather than a table.
          <ol className="relative px-6 pb-4 before:absolute before:top-2 before:bottom-6 before:left-10 before:w-px before:bg-border">
            {shown.map((event, index) => (
              <li
                key={event.key}
                className="animate-in fade-in slide-in-from-right-2 duration-500 [animation-fill-mode:both]"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <Link
                  href={event.href}
                  className="group relative -mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg ring-4 ring-card",
                      event.look.tint,
                    )}
                  >
                    <HugeiconsIcon icon={event.look.icon} strokeWidth={1.8} className="size-4" />
                    <span
                      className={cn(
                        "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card",
                        TONE_DOT[event.tone],
                      )}
                    />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium group-hover:text-primary">
                      {event.text}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {event.detail}
                    </span>
                  </div>
                  <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                    {relative(event.at)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
