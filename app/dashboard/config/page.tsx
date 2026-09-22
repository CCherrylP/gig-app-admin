"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  Cancel01Icon,
  Clock01Icon,
  Coins01Icon,
} from "@hugeicons/core-free-icons";

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
  MIN_CAP_MINUTES,
  capLabel,
  getSettings,
  toHours,
  toMinutes,
  updateSettings,
  type PlatformSettings,
  type PlatformSettingsPatch,
} from "@/lib/settings";
import { dateTime, money } from "@/lib/format";
import { cn } from "@/lib/utils";

// The decisions that are not about one row.
//
// Everything else an admin decides on this platform is about a single thing —
// whether a certificate is real, whether a business exists — and belongs on the
// queue where that decision gets made. What is here is different: it applies to
// everybody at once, and every number on this page was once a constant compiled
// into two codebases, which meant changing one needed an App Store release and a
// week of two answers being live.
//
// TWO GROUPS, AND THEY ARE NOT THE SAME KIND OF SETTING, which is why the page
// says so rather than showing five boxes in a row:
//
//   money   prices the NEXT invoice and the NEXT shift posted. Nothing already
//           written down moves.
//   hours   refuses the NEXT booking anybody attempts. Nothing already booked
//           moves either — a cap that cancelled somebody's Saturday would be a
//           worse outcome than the week it was meant to prevent.

/** The plain integer settings. `roleTypeCaps` is deliberately NOT one of these:
 *  it is a map, it is edited as rows, and folding it into the same loop would
 *  mean a field whose "value" is an object pretending to be a number. */
type NumericKey = Exclude<keyof PlatformSettingsPatch, "roleTypeCaps">;

const FIELDS: {
  key: NumericKey;
  group: "money" | "hours";
  label: string;
  help: string;
  /** What sits beside the box. The unit somebody TYPES, which for the caps is
   *  hours even though the wire and the database are in minutes. */
  unit: string;
  /** Typed → stored. Identity for the money fields; hours to minutes for the
   *  caps, which is the only conversion on this page. */
  toStored: (typed: number) => number;
  /** Stored → typed, the same conversion backwards. */
  toTyped: (stored: number) => number;
  /** How the stored value reads back as a sentence. */
  format: (stored: number) => string;
  /** The API's own rule, repeated so the form can refuse before a round trip
   *  rather than after one. Returns the sentence to show, or null. The API is
   *  the authority — this exists to explain the rule, not to be it. */
  invalid: (stored: number) => string | null;
  /** For the number input. Hours are typed in halves; cents are not. */
  step?: string;
}[] = [
  {
    key: "coinPriceCents",
    group: "money",
    label: "Coin price",
    help: "What one coin costs, in cents. The same for every company. There are no packs, no bonus coins and no negotiated rates. It is also what a coin buys: a shift's wages are converted into coins through this number, so changing it changes both at once, and balances companies have already paid for do not move with it.",
    unit: "cents",
    toStored: (typed) => typed,
    toTyped: (stored) => stored,
    format: (value) => `${money(value)} per coin`,
    invalid: (value) => boundsError("coinPriceCents", value),
  },
  {
    key: "placementFeeCents",
    group: "money",
    label: "Platform fee",
    help: "Charged per hour of every shift created, flat. In money rather than coins, so it stays the same price when the coin price moves. Flat rather than a percentage of wages on purpose: a percentage would earn more when an employer pays better.",
    unit: "cents / hour",
    toStored: (typed) => typed,
    toTyped: (stored) => stored,
    format: (value) =>
      value === 0
        ? "No platform fee, free to post"
        : `${money(value)} per hour of shift`,
    invalid: (value) => boundsError("placementFeeCents", value),
  },
  {
    key: "invoiceTermsDays",
    group: "money",
    label: "Invoice terms",
    help: "Days a company has to settle an invoiced top-up. Not credit, the coins wait for the payment, so this is the date they are asked to pay by.",
    unit: "days",
    toStored: (typed) => typed,
    toTyped: (stored) => stored,
    format: (value) => `Due ${value} day${value === 1 ? "" : "s"} after issue`,
    invalid: (value) => boundsError("invoiceTermsDays", value),
  },
  {
    key: "maxDailyMinutes",
    group: "hours",
    label: "Most hours in a day",
    help: "Counted on one calendar day, against the PAID hours of everything somebody holds — the booked window minus any unpaid break. An overnight shift counts entirely on the day it starts. 12 hours is the Employment Act's figure and the default here.",
    unit: "hours a day",
    toStored: toMinutes,
    toTyped: toHours,
    format: (minutes) =>
      minutes === 0
        ? "No daily limit — any length of day is bookable"
        : `${capLabel(minutes)} in one day`,
    invalid: (minutes) => capError("maxDailyMinutes", minutes),
    step: "0.5",
  },
  {
    key: "maxWeeklyMinutes",
    group: "hours",
    label: "Most hours in a week",
    help: "Monday to Sunday, in Singapore. This is the one that catches the long grind no single day would fail: six back-to-back twelve-hour shifts overlap at no point, so nothing else on this platform would refuse them. 44 hours is the Employment Act's figure and the default here.",
    unit: "hours a week",
    toStored: toMinutes,
    toTyped: toHours,
    format: (minutes) =>
      minutes === 0
        ? "No weekly limit — this is not enforced"
        : `${capLabel(minutes)} in one week`,
    invalid: (minutes) => capError("maxWeeklyMinutes", minutes),
    step: "0.5",
  },
];

/** Hours-as-typed for a per-kind cap row, keyed by industry id. */
type CapDraft = Record<string, string>;

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Only the fields somebody has actually typed in. Sending the whole row back
  // would mean a reviewer changing the terms could silently revert a coin price
  // another admin set while this page was open.
  const [draft, setDraft] = useState<Partial<Record<NumericKey, string>>>({});

  // NULL MEANS UNTOUCHED, which an empty object cannot say: `{}` is a real
  // instruction here — "no per-kind caps at all" — and the API takes the whole
  // map rather than merging, so the two have to be told apart or opening this
  // page and saving something else would delete every per-kind cap.
  const [caps, setCaps] = useState<CapDraft | null>(null);

  const mutation = useMutation({
    mutationFn: (patch: PlatformSettingsPatch) => updateSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(["settings"], settings);
      setDraft({});
      setCaps(null);
      toast.success("Platform settings updated");
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

  const patch = buildPatch(draft, caps, data);
  const errors = FIELDS.map((field) => storedFrom(draft, field))
    .map((value, i) => (value === null ? null : FIELDS[i].invalid(value)))
    .filter(Boolean);

  const capErrors = caps
    ? Object.values(caps).filter((typed) => {
        if (typed.trim() === "") return true;
        const minutes = toMinutes(Number(typed));
        return !Number.isFinite(minutes) || capError("maxWeeklyMinutes", minutes) !== null;
      })
    : [];

  const dirty = Object.keys(patch).length > 0;
  const blocked = errors.length > 0 || capErrors.length > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Platform config"
        description="What a coin costs, what the platform fee costs, how long a company has to pay — and how much one person is allowed to work."
      />

      {/* --- money ------------------------------------------------------- */}

      <SectionHeading
        title="Money"
        description="Prices the next invoice and the next shift posted."
      />

      {/* The one thing a reviewer has to understand before touching these. */}
      <Note tone="amber">
        These price the <span className="font-medium">next</span> invoice and the{" "}
        <span className="font-medium">next</span> shift posted. Nothing already
        written down moves: an invoice keeps the amount and due date it was raised
        with, and a ledger entry keeps its coins.
      </Note>

      <div className="grid gap-4 lg:grid-cols-3">
        {FIELDS.filter((field) => field.group === "money").map((field) => (
          <SettingCard
            key={field.key}
            field={field}
            data={data}
            draft={draft}
            onChange={(value) =>
              setDraft((d) => ({ ...d, [field.key]: value }))
            }
          />
        ))}
      </div>

      {/* --- hours ------------------------------------------------------- */}

      <SectionHeading
        title="Hours limits"
        description="How much one person may work, so volume stops being unlimited."
      />

      <Note tone="amber">
        <span className="font-medium">Nothing else on this platform caps this.</span>{" "}
        A candidate cannot be in two places at once — overlapping shifts are
        refused — but six back-to-back twelve-hour shifts overlap at no point, and
        without these numbers all six are bookable. A limit here refuses the{" "}
        <span className="font-medium">next</span> booking anybody attempts and
        unbooks nobody: shifts people already hold are theirs. Set a limit to{" "}
        <span className="font-medium">0</span> to switch it off.
      </Note>

      <div className="grid gap-4 lg:grid-cols-2">
        {FIELDS.filter((field) => field.group === "hours").map((field) => (
          <SettingCard
            key={field.key}
            field={field}
            data={data}
            draft={draft}
            onChange={(value) =>
              setDraft((d) => ({ ...d, [field.key]: value }))
            }
          />
        ))}
      </div>

      <RoleTypeCaps
        settings={data}
        caps={caps ?? toCapDraft(data.roleTypeCaps)}
        onChange={setCaps}
      />

      {/* --- saving ------------------------------------------------------ */}

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
            onClick={() => {
              setDraft({});
              setCaps(null);
            }}
          >
            Discard
          </Button>
          <Button
            size="sm"
            disabled={!dirty || blocked || mutation.isPending}
            onClick={() => mutation.mutate(patch)}
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-t pt-5">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Note({
  tone,
  children,
}: {
  tone: "amber";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-sm",
        tone === "amber" &&
          "border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-900/15 dark:text-amber-200",
      )}
    >
      <HugeiconsIcon
        icon={Alert02Icon}
        strokeWidth={2}
        className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <p>{children}</p>
    </div>
  );
}

function SettingCard({
  field,
  data,
  draft,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  data: PlatformSettings;
  draft: Partial<Record<NumericKey, string>>;
  onChange: (value: string) => void;
}) {
  const current = data[field.key];
  const typed = draft[field.key];
  const value = typed ?? String(field.toTyped(current));

  const stored = storedFrom(draft, field);
  const error = stored === null ? null : field.invalid(stored);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{field.label}</CardDescription>
          <HugeiconsIcon
            icon={field.group === "hours" ? Clock01Icon : Coins01Icon}
            strokeWidth={1.5}
            className={cn(
              "size-5",
              field.group === "hours" ? "text-amber-600 dark:text-amber-400" : "text-primary",
            )}
          />
        </div>
        <CardTitle className="text-lg font-semibold">
          {field.format(current)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs leading-5 text-muted-foreground">{field.help}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            value={value}
            step={field.step}
            aria-invalid={!!error}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-32 tabular-nums"
          />
          <span className="text-xs text-muted-foreground">{field.unit}</span>
        </div>
        <p
          className={
            error
              ? "text-xs font-medium text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {error ?? allowedText(field)}
        </p>
      </CardContent>
    </Card>
  );
}

/** Weekly caps for one kind of work.
 *
 *  THE KEYS COME FROM THE BOARD, never a text box, and that is the whole design
 *  of this control. `roleTypeCaps` is keyed on the industry id a role carries,
 *  and a cap filed under 'warehouse' when every role says 'warehouse-logistics'
 *  enforces nothing while looking exactly like one that works — the kind of
 *  mistake nobody finds for months. So the picker offers the ids the roles
 *  themselves report, with their counts. */
function RoleTypeCaps({
  settings,
  caps,
  onChange,
}: {
  settings: PlatformSettings;
  caps: CapDraft;
  onChange: (caps: CapDraft) => void;
}) {
  const [adding, setAdding] = useState("");

  const capped = Object.keys(caps);
  const available = settings.roleTypes.filter(
    (type) => !capped.includes(type.industryId),
  );

  const rolesFor = (industryId: string) =>
    settings.roleTypes.find((type) => type.industryId === industryId)?.roles ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Weekly limit per kind of work</CardTitle>
          <HugeiconsIcon
            icon={Clock01Icon}
            strokeWidth={1.5}
            className="size-5 text-amber-600 dark:text-amber-400"
          />
        </div>
        <CardDescription>
          Optional, and on top of the weekly total above — whichever is tighter
          refuses first. It exists because the totals cannot say the thing that
          matters about demanding work: 44 hours of cashier shifts and 44 hours of
          warehouse picking are the same number and not the same week.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {capped.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No limits per kind of work. Every kind counts only against the two
            totals above.
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {capped.map((industryId) => {
              const typed = caps[industryId];
              const minutes = typed.trim() === "" ? null : toMinutes(Number(typed));
              const error =
                minutes === null
                  ? "Say how many hours"
                  : capError("maxWeeklyMinutes", minutes);
              const roles = rolesFor(industryId);

              return (
                <div
                  key={industryId}
                  className="flex flex-wrap items-center gap-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {industryId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {roles === 0
                        ? // A cap on a kind the board has no roles for. Not an
                          // error — a listing of that kind may be posted
                          // tomorrow — but worth saying, because it is what a
                          // typo looks like from here.
                          "No roles on the board are filed under this — check the spelling"
                        : `${roles} role${roles === 1 ? "" : "s"} on the board`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={typed}
                      aria-invalid={!!error}
                      onChange={(e) =>
                        onChange({ ...caps, [industryId]: e.target.value })
                      }
                      className="h-9 w-24 tabular-nums"
                    />
                    <span className="w-24 text-xs text-muted-foreground">
                      hours a week
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove the limit on ${industryId}`}
                      onClick={() => {
                        const next = { ...caps };
                        delete next[industryId];
                        onChange(next);
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                    </Button>
                  </div>
                  {error && (
                    <p className="w-full text-xs font-medium text-destructive">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <select
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            disabled={available.length === 0}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm disabled:opacity-50"
          >
            <option value="">
              {available.length === 0
                ? "Every kind of work already has a limit"
                : "Add a kind of work…"}
            </option>
            {available.map((type) => (
              <option key={type.industryId} value={type.industryId}>
                {type.industryId} ({type.roles})
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={!adding}
            onClick={() => {
              // Seeded from the weekly total rather than blank, so the row
              // starts at a number that is already legal and the only edit
              // needed is downwards.
              onChange({
                ...caps,
                [adding]: String(toHours(settings.maxWeeklyMinutes || 2640)),
              });
              setAdding("");
            }}
          >
            Add limit
          </Button>
          {settings.roleTypes.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No roles on the board carry an industry yet, so there is nothing to
              cap by kind. Roles posted before that field existed do not have one
              and are only ever counted against the two totals.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- the arithmetic -----------------------------------------------------------

function boundsError(key: keyof typeof BOUNDS, value: number) {
  if (!Number.isInteger(value)) return "Whole numbers only";
  const bound = BOUNDS[key];
  if (value < bound.min || value > bound.max) {
    return `Allowed: ${bound.min}–${bound.max}`;
  }
  return null;
}

/** The cap rule, which is not a plain range: 0 is allowed and means "no limit",
 *  and everything between 1 and 59 minutes is refused — a cap shorter than any
 *  real shift would refuse every booking on the platform and read as an
 *  outage. */
function capError(key: "maxDailyMinutes" | "maxWeeklyMinutes", minutes: number) {
  if (!Number.isInteger(minutes)) return "Use whole or half hours";
  if (minutes === 0) return null;
  if (minutes < MIN_CAP_MINUTES) return "An hour at least, or 0 for no limit";
  if (minutes > BOUNDS[key].max) {
    return key === "maxDailyMinutes" ? "A day is 24 hours" : "A week is 168 hours";
  }
  return null;
}

/** What a field's typed value means in the unit the API stores, or null when
 *  nothing has been typed into it. NaN when what was typed is not a number,
 *  which every caller treats as invalid rather than as empty. */
function storedFrom(
  draft: Partial<Record<NumericKey, string>>,
  field: (typeof FIELDS)[number],
): number | null {
  const typed = draft[field.key];
  if (typed === undefined || typed.trim() === "") return null;

  const value = Number(typed);
  if (!Number.isFinite(value)) return NaN;

  return field.toStored(value);
}

function allowedText(field: (typeof FIELDS)[number]) {
  const bound = BOUNDS[field.key];

  if (field.group === "money") return `Allowed: ${bound.min}–${bound.max}`;

  return `An hour at least, or 0 for no limit. Up to ${toHours(bound.max)}.`;
}

/** The stored map as hours-per-kind, for the form. */
function toCapDraft(caps: Record<string, number>): CapDraft {
  return Object.fromEntries(
    Object.entries(caps).map(([industryId, minutes]) => [
      industryId,
      String(toHours(minutes)),
    ]),
  );
}

/** Only what was typed AND actually differs from what is stored. A field
 *  somebody clicked into and left alone is not a change. */
function buildPatch(
  draft: Partial<Record<NumericKey, string>>,
  caps: CapDraft | null,
  current: PlatformSettings,
): PlatformSettingsPatch {
  const patch: PlatformSettingsPatch = {};

  for (const field of FIELDS) {
    const stored = storedFrom(draft, field);
    if (stored === null || !Number.isInteger(stored)) continue;
    if (stored === current[field.key]) continue;

    patch[field.key] = stored;
  }

  // THE WHOLE MAP or nothing, because that is what the API takes — it does not
  // merge, so a partial send would be read as "these are the only caps" and
  // would delete the rest. Null here is "nobody touched this control".
  if (caps !== null) {
    const next: Record<string, number> = {};

    for (const [industryId, typed] of Object.entries(caps)) {
      if (typed.trim() === "") continue;
      const minutes = toMinutes(Number(typed));
      if (!Number.isInteger(minutes) || minutes < MIN_CAP_MINUTES) continue;
      next[industryId] = minutes;
    }

    if (!sameCaps(next, current.roleTypeCaps)) patch.roleTypeCaps = next;
  }

  return patch;
}

/** Two maps, same caps? Compared on sorted entries rather than by reference, so
 *  adding a cap and removing it again is correctly no change at all. */
function sameCaps(a: Record<string, number>, b: Record<string, number>) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}
