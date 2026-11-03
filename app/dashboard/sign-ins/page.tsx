"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Login01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, FilterTabs, PageHeader, TableShell, TableSkeleton } from "@/components/dashboard/data-views";
import { FLAG_LABELS, flagLabel, listLogins, type LoginEntry } from "@/lib/logins";
import { dateTime } from "@/lib/format";

const PAGE_SIZE = 50;

type Filter = "flagged" | "all";

const ROLE_LABELS: Record<string, string> = { candidate: "Candidate", employer: "Employer", admin: "Admin" };

/** Every sign-in, newest first, with odd ones flagged. Click a name to see only that person. */
export default function SignInsPage() {
  const [filter, setFilter] = useState<Filter>("flagged");
  const [page, setPage] = useState(1);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);

  const logins = useQuery({
    queryKey: ["logins", filter, page, person?.id],
    queryFn: () =>
      listLogins({ page, limit: PAGE_SIZE, flagged: filter === "flagged" && !person, userId: person?.id }),
  });

  const entries = logins.data?.entries ?? [];
  const total = logins.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const choose = (next: Filter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Sign-ins"
        description="Who signed in, from where and on what device. Odd sign-ins are flagged. Kept for 90 days."
      />

      {logins.data?.note && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          {logins.data.note}
        </p>
      )}

      {person ? (
        <div className="flex items-center gap-3 text-sm">
          <span>
            Showing every sign-in for <span className="font-medium">{person.name}</span>
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              setPerson(null);
              setPage(1);
            }}
          >
            Show everyone
          </Button>
        </div>
      ) : (
        <FilterTabs
          options={[
            { value: "flagged", label: "Flagged", count: logins.data?.flaggedWeek },
            { value: "all", label: "All sign-ins" },
          ]}
          value={filter}
          onChange={choose}
          className="self-start"
        />
      )}

      <Card>
        <CardContent className="p-0">
          {logins.isLoading ? (
            <TableSkeleton />
          ) : logins.isError ? (
            <EmptyState icon={Login01Icon} message="Could not load sign-ins. Try again." />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Login01Icon}
              message={filter === "flagged" && !person ? "No flagged sign-ins." : "No sign-ins recorded yet."}
            />
          ) : (
            <TableShell
              headers={["When", "Person", "Device", "Network", "Flags"]}
              widths={["w-[18%]", "w-[24%]", "w-[18%]", "w-[16%]", "w-[24%]"]}
              exportName="sign-ins"
            >
              {entries.map((entry) => (
                <LoginRow
                  key={entry.id}
                  entry={entry}
                  onPerson={() => {
                    setPerson({ id: entry.userId, name: entry.name ?? "Unnamed account" });
                    setPage(1);
                  }}
                />
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

function LoginRow({ entry, onPerson }: { entry: LoginEntry; onPerson: () => void }) {
  return (
    <tr className="align-top">
      <td className="px-4 py-3 tabular-nums">{dateTime(entry.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col items-start">
          <button type="button" onClick={onPerson} className="truncate font-medium hover:underline">
            {entry.name ?? "Unnamed account"}
          </button>
          {entry.role && <span className="text-xs text-muted-foreground">{ROLE_LABELS[entry.role] ?? entry.role}</span>}
        </div>
      </td>
      <td className="px-4 py-3">{entry.device ?? <span className="text-muted-foreground">Checking…</span>}</td>
      <td className="px-4 py-3 font-mono text-xs">{entry.ip ?? "-"}</td>
      <td className="px-4 py-3">
        {entry.flags.length === 0 ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {entry.flags.map((flag) => (
              <span
                key={flag}
                title={FLAG_LABELS[flag]?.hint}
                className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300"
              >
                {flagLabel(flag)}
              </span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
