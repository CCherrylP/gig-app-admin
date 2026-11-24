"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createReferral, listReferrals, TEAM_LABEL } from "@/lib/referrals";
import { date } from "@/lib/format";

type Target =
  | { type: "candidate"; id: string; email: string | null }
  | { type: "company"; id: string; uen: string };

/** Who referred this candidate or company, and a code box to set it if they forgot. */
export function ReferredBy({ target }: { target: Target }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");

  // Same cache as the Referrals page, so both stay in step.
  const { data, isLoading } = useQuery({ queryKey: ["referrals", "list"], queryFn: listReferrals });

  const current = (data ?? []).find(
    (row) => row.referred.type === target.type && row.referred.id === target.id,
  );

  const save = useMutation({
    mutationFn: () =>
      createReferral(
        target.type === "company"
          ? { code: code.trim(), companyUen: target.uen }
          : { code: code.trim(), candidateEmail: target.email ?? "" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      setCode("");
      toast.success("Referrer set");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not set the referrer"),
  });

  const noEmail = target.type === "candidate" && !target.email;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-muted-foreground">Referred by</span>

      {isLoading ? (
        <span className="text-muted-foreground">Loading…</span>
      ) : current ? (
        <span>
          <span className="font-medium">{current.referrer.name ?? "Unnamed"}</span>
          {current.referrer.code && (
            <span className="font-mono text-xs text-muted-foreground"> · {current.referrer.code}</span>
          )}
          {current.referrer.team && ` · ${TEAM_LABEL[current.referrer.team]}`}
          <span className="text-muted-foreground">
            {" "}
            · {current.active ? `until ${date(current.endsAt)}` : "ended"}
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground">No referrer yet.</span>
      )}

      {noEmail ? (
        <span className="text-xs text-muted-foreground">
          No email on this account, so a referrer can&apos;t be set here.
        </span>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) save.mutate();
          }}
        >
          <Input
            placeholder="Referrer code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="h-9 w-40 font-mono"
          />
          <Button type="submit" size="sm" disabled={!code.trim() || save.isPending}>
            {save.isPending ? "Saving…" : current ? "Change referrer" : "Set referrer"}
          </Button>
        </form>
      )}

      {current && (
        <span className="text-xs text-muted-foreground">
          Changing it replaces the current referrer. Rewards count from today.
        </span>
      )}
    </div>
  );
}
