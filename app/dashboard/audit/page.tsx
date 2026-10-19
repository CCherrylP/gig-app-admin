"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSecurityIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, TableShell, TableSkeleton } from "@/components/dashboard/data-views";
import { actionLabel, listAudit, type AuditEntry } from "@/lib/audit";
import { dateTime } from "@/lib/format";

const PAGE_SIZE = 50;

/** Read-only list of what staff opened or decided, newest first. */
export default function AuditPage() {
  const [page, setPage] = useState(1);

  const audit = useQuery({
    queryKey: ["audit", page],
    queryFn: () => listAudit(page, PAGE_SIZE),
  });

  const entries = audit.data?.entries ?? [];
  const total = audit.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Audit log"
        description="Who opened ID photos, bank details and attendance photos, and who made key decisions."
      />

      {audit.data?.note && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          {audit.data.note}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {audit.isLoading ? (
            <TableSkeleton />
          ) : audit.isError ? (
            <EmptyState icon={FileSecurityIcon} message="Could not load the audit log. Try again." />
          ) : entries.length === 0 ? (
            <EmptyState icon={FileSecurityIcon} message="Nothing recorded yet." />
          ) : (
            <TableShell
              headers={["When", "Staff", "Action", "About"]}
              widths={["w-[20%]", "w-[22%]", "w-[26%]", "w-[32%]"]}
              exportName="audit-log"
            >
              {entries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const about = entry.targetUserId ? (entry.targetName ?? "Unnamed account") : null;

  return (
    <tr className="align-top">
      <td className="px-4 py-3 tabular-nums">{dateTime(entry.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{entry.adminName ?? "Unknown staff"}</span>
          {entry.ip && <span className="truncate text-xs text-muted-foreground">{entry.ip}</span>}
        </div>
      </td>
      <td className="px-4 py-3">{actionLabel(entry.action)}</td>
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          {about && <span className="truncate">{about}</span>}
          {entry.targetId && <span className="truncate text-xs text-muted-foreground">{entry.targetId}</span>}
          {!about && !entry.targetId && <span className="text-muted-foreground">-</span>}
        </div>
      </td>
    </tr>
  );
}
