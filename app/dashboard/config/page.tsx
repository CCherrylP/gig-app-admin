"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Coins01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/data-views";
import {
  BOUNDS,
  getSettings,
  updateSettings,
  type PlatformSettings,
  type PlatformSettingsPatch,
} from "@/lib/settings";
import { dateTime, money } from "@/lib/format";

// The coin numbers, and only the coin numbers.
//
// Everything else an admin decides on this platform is about one row — whether
// a certificate is real, whether a business exists — and belongs on the queue
// where that decision gets made. These three are different: they price the
// platform, they were constants compiled into two codebases, and a price
// compiled into an app bundle cannot be changed for anybody on an old build.

type FieldKey = keyof PlatformSettingsPatch;

const FIELDS: {
  key: FieldKey;
  label: string;
  help: string;
  unit: string;
  /** How the stored integer reads to a person. Cents are edited as cents on
   *  purpose — the API stores cents, and a form that converted to dollars would
   *  be a rounding step between what staff type and what a company is charged. */
  format: (value: number) => string;
}[] = [
  {
    key: "coinPriceCents",
    label: "Coin price",
    help: "What one coin costs, in cents. 100 is the one-coin-to-one-dollar model the app is built around — there are no packs and no bonus coins, so this is the whole of the pricing.",
    unit: "cents",
    format: (value) => `${money(value)} per coin`,
  },
  {
    key: "placementCoinsPerHour",
    label: "Placement fee",
    help: "Coins charged per hour of every shift created, flat. Flat rather than a percentage of wages on purpose: a percentage would earn more when an employer pays better.",
    unit: "coins / hour",
    format: (value) =>
      value === 0
        ? "No placement fee — free to post"
        : `${value} coin${value === 1 ? "" : "s"} per hour of shift`,
  },
  {
    key: "invoiceTermsDays",
    label: "Invoice terms",
    help: "Days a company has to settle an invoiced top-up. Not credit — the coins wait for the payment, so this is the date they are asked to pay by.",
    unit: "days",
    format: (value) => `Due ${value} day${value === 1 ? "" : "s"} after issue`,
  },
];

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Only the fields somebody has actually typed in. Sending the whole row back
  // would mean a reviewer changing the terms could silently revert a coin price
  // another admin set while this page was open.
  const [draft, setDraft] = useState<Partial<Record<FieldKey, string>>>({});

  const mutation = useMutation({
    mutationFn: (patch: PlatformSettingsPatch) => updateSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(["settings"], settings);
      setDraft({});
      toast.success("Coin settings updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not save those settings");
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const patch = buildPatch(draft, data);
  const invalid = FIELDS.filter((field) => {
    const typed = draft[field.key];
    if (typed === undefined || typed === "") return false;
    return outOfBounds(field.key, Number(typed));
  });
  const dirty = Object.keys(patch).length > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Placement config"
        description="What a coin costs, what a placement costs, and how long a company has to pay."
      />

      {/* The one thing a reviewer has to understand before touching this page. */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm dark:bg-amber-900/15">
        <HugeiconsIcon
          icon={Alert02Icon}
          strokeWidth={2}
          className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <p className="text-amber-900 dark:text-amber-200">
          These price the <span className="font-medium">next</span> invoice and
          the <span className="font-medium">next</span> shift posted. Nothing
          already written down moves: an invoice keeps the amount and due date it
          was raised with, and a ledger entry keeps its coins.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {FIELDS.map((field) => {
          const current = data[field.key];
          const typed = draft[field.key];
          const value = typed ?? String(current);
          const bad = typed !== undefined && typed !== "" && outOfBounds(field.key, Number(typed));

          return (
            <Card key={field.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardDescription>{field.label}</CardDescription>
                  <HugeiconsIcon
                    icon={Coins01Icon}
                    strokeWidth={1.5}
                    className="size-5 text-primary"
                  />
                </div>
                <CardTitle className="text-lg font-semibold">
                  {field.format(current)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-xs leading-5 text-muted-foreground">
                  {field.help}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={value}
                    min={BOUNDS[field.key].min}
                    max={BOUNDS[field.key].max}
                    aria-invalid={bad}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [field.key]: e.target.value }))
                    }
                    className="h-9 w-32 tabular-nums"
                  />
                  <span className="text-xs text-muted-foreground">
                    {field.unit}
                  </span>
                </div>
                <p
                  className={
                    bad
                      ? "text-xs font-medium text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  Allowed: {BOUNDS[field.key].min}–{BOUNDS[field.key].max}
                  {bad && " — outside that range"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Last changed {dateTime(data.updatedAt)}
          {data.updatedById ? "" : " — never edited from this dashboard"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => setDraft({})}
          >
            Discard
          </Button>
          <Button
            size="sm"
            disabled={!dirty || invalid.length > 0 || mutation.isPending}
            onClick={() => mutation.mutate(patch)}
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function outOfBounds(key: FieldKey, value: number) {
  if (!Number.isInteger(value)) return true;
  return value < BOUNDS[key].min || value > BOUNDS[key].max;
}

/** Only the fields that were typed AND actually differ from what is stored. A
 *  field somebody clicked into and left alone is not a change. */
function buildPatch(
  draft: Partial<Record<FieldKey, string>>,
  current: PlatformSettings,
): PlatformSettingsPatch {
  const patch: PlatformSettingsPatch = {};

  for (const field of FIELDS) {
    const typed = draft[field.key];
    if (typed === undefined || typed === "") continue;

    const value = Number(typed);
    if (!Number.isInteger(value) || value === current[field.key]) continue;

    patch[field.key] = value;
  }

  return patch;
}
