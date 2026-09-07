"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  BuildingIcon,
  CallIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Invoice01Icon,
  Mail01Icon,
  ReceiptIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  InitialsAvatar,
  StatusPill,
  initials,
} from "@/components/dashboard/data-views";
import {
  createTopUp,
  setCoinPrice,
  decideEmployer,
  listEmployers,
  updateEmployerDetails,
  MAX_TOPUP_COINS,
  MIN_TOPUP_COINS,
  QUICK_TOPUP_COINS,
  COIN_PRICE_BOUNDS,
  type EmployerReview,
} from "@/lib/employers";
import { getSettings } from "@/lib/settings";
import { dateTime, money, relative } from "@/lib/format";

// One employer, whole.
//
// The queue answers "who is waiting"; this answers "who is this". It is reached
// by clicking a row, and it exists because the phone call the queue exists for is
// not decidable from a table cell — the person on the other end has a company
// with an address that may be wrong, a job title somebody typed in a hurry, and a
// coin balance that is the reason they are ringing at all.
//
// TWO DIFFERENT ACTS ON ONE PAGE, kept visually apart on purpose:
//
//   · CORRECTING what somebody typed — the Business card. Saves quietly, changes
//     nothing about what anyone is allowed to do.
//   · DECIDING whether this person may act for the business — the band at the
//     bottom. Reversible, unlike a certificate, but it is what stands between a
//     stranger and a company's float.
//
// The fields that are NOT inputs are the load-bearing part. Name and phone come
// from Singpass, email from Supabase auth, company name and UEN from ACRA — an
// admin retyping any of them would leave a "verified" tick standing over a value
// nobody checked. See UpdateEmployerDetailsBody in the API's contract.

const COMPANY_STYLES: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  UNVERIFIED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function EmployerDetailPage() {
  // `useParams`, not the `params` promise — this whole dashboard is client-side
  // behind the auth guard, so there is no server render to await anything for.
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // The `all` list rather than a route of its own: the API has no
  // GET /admin/employers/:userId, and adding one to draw a page that the list
  // already contains would be a second shape to keep in step for nothing. It
  // also means arriving from the queue is free — the row is usually cached.
  const { data, isLoading } = useQuery({
    queryKey: ["employers", "all"],
    queryFn: () => listEmployers("all"),
  });

  const employer = data?.employers.find((row) => row.userId === userId);

  if (isLoading) return <DetailSkeleton />;

  if (!employer) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <BackLink />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <HugeiconsIcon
              icon={BuildingIcon}
              strokeWidth={1.5}
              className="size-10 text-muted-foreground/30"
            />
            <p className="text-sm font-medium">No such employer</p>
            <p className="text-xs text-muted-foreground">
              The seat may have been removed since this link was made.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Detail
      key={employer.userId}
      employer={employer}
      onDecided={() => {
        queryClient.invalidateQueries({ queryKey: ["employers"] });
        router.push("/dashboard/employers");
      }}
    />
  );
}

function Detail({
  employer,
  onDecided,
}: {
  employer: EmployerReview;
  onDecided: () => void;
}) {
  const queryClient = useQueryClient();
  const name = employer.name ?? "Unnamed";

  // Seeded once per employer — the `key` on this component is what makes that
  // true, rather than an effect that would have to guess when to re-seed.
  const [jobTitle, setJobTitle] = useState(employer.jobTitle ?? "");
  const [industry, setIndustry] = useState(employer.companyIndustry ?? "");
  const [address, setAddress] = useState(employer.companyAddress ?? "");
  // Two pieces of state for one column, because the tick and the text are not
  // derivable from each other. "Same as the outlet address" saves null, and null
  // and "" both render as an empty box — so a single string could not tell a
  // freshly unticked field from a ticked one, and unticking would immediately
  // re-tick itself. Keeping the text alive behind the tick also means ticking by
  // accident does not throw away what somebody just typed.
  const [sameAsOutlet, setSameAsOutlet] = useState(
    !employer.companyBillingAddress,
  );
  const [billing, setBilling] = useState(employer.companyBillingAddress ?? "");

  // What actually gets sent. Empty is stored as null by the API, which is the
  // fallback — see the note on the section below for why that is not a copy of
  // the outlet address.
  const effectiveBilling = sameAsOutlet ? "" : billing;

  // Only what actually moved. Sending every field each time would write null over
  // one a colleague filled in between this page loading and Save being pressed,
  // which is the quiet kind of data loss nobody reports.
  const changed = {
    ...(jobTitle !== (employer.jobTitle ?? "") ? { jobTitle } : {}),
    ...(industry !== (employer.companyIndustry ?? "")
      ? { companyIndustry: industry }
      : {}),
    ...(address !== (employer.companyAddress ?? "")
      ? { companyAddress: address }
      : {}),
    ...(effectiveBilling !== (employer.companyBillingAddress ?? "")
      ? { companyBillingAddress: effectiveBilling }
      : {}),
  };
  const dirty = Object.keys(changed).length > 0;

  const save = useMutation({
    mutationFn: () => updateEmployerDetails(employer.userId, changed),
    onSuccess: (result) => {
      // The route answers with the whole `all` list, which is the query this
      // page reads — so it goes straight into the cache rather than triggering
      // a refetch of what we were just handed.
      queryClient.setQueryData(["employers", "all"], result);
      queryClient.invalidateQueries({ queryKey: ["employers"] });
      toast.success("Details saved");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not save those details"),
  });

  const decide = useMutation({
    mutationFn: ({
      status,
      companyVerified,
    }: {
      status: "approved" | "rejected";
      companyVerified?: boolean;
    }) => decideEmployer(employer.userId, status, companyVerified),
    onSuccess: (_result, { status }) => {
      toast.success(
        status === "approved" ? "Employer approved" : "Employer rejected",
      );
      onDecided();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not record that decision"),
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-3">
        <BackLink />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <InitialsAvatar
              seed={employer.userId}
              label={initials(name)}
              className="size-11"
            />
            <div>
              <h1 className="font-heading text-2xl font-semibold">{name}</h1>
              <p className="text-sm text-muted-foreground">
                {employer.jobTitle ?? "No job title"} at{" "}
                <span className="font-medium text-foreground">
                  {employer.companyName}
                </span>{" "}
                · UEN{" "}
                <span className="tabular-nums">{employer.companyUen}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusPill status={employer.status} />
            <StatusPill
              status={employer.companyVerificationStatus}
              styles={COMPANY_STYLES}
              label={`Business ${employer.companyVerificationStatus}`}
            />
          </div>
        </div>

        {/* The careerhop header strip: the few dates that frame the call. */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <Meta label="Signed up" value={dateTime(employer.createdAt)} />
          <Meta
            label="Last decided"
            value={
              employer.reviewedAt
                ? `${dateTime(employer.reviewedAt)} (${relative(employer.reviewedAt)})`
                : "Never"
            }
          />
          <Meta
            label="Seats at this UEN"
            value={`${employer.companySeats}`}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Read-only, every field. Not an oversight — see the header. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={UserIcon} size={16} strokeWidth={2} />
              Person
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ReadOnly label="Name" value={employer.name} />
            <ReadOnly
              label="Email"
              value={employer.email}
              icon={Mail01Icon}
            />
            <ReadOnly
              label="Phone"
              value={employer.phone}
              icon={CallIcon}
              hint="The number to ring — this queue IS a phone call."
            />
            <ReadOnly
              label="Singpass"
              value={employer.personVerified ? "Verified" : "Not verified"}
            />
            <p className="text-xs text-muted-foreground">
              Read-only. Name and phone come from Singpass and the email from the
              sign-in account — editing one here would leave the verified tick
              standing over a value nobody checked.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={BuildingIcon} size={16} strokeWidth={2} />
              Business
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnly label="Company" value={employer.companyName} />
              <ReadOnly
                label="UEN"
                value={employer.companyUen}
                hint="ACRA's answer, and the identity joining by UEN rests on."
              />
            </div>

            <TextField
              id="jobTitle"
              label="Job title"
              value={jobTitle}
              onChange={setJobTitle}
              placeholder="Operations Manager"
            />
            <TextField
              id="industry"
              label="Industry"
              value={industry}
              onChange={setIndustry}
              placeholder="Food & Beverage"
            />
            <TextField
              id="address"
              label="Outlet address"
              value={address}
              onChange={setAddress}
              placeholder="12 River Road #02-14, Singapore 179024"
              hint="Where the work is. Autofilled from ACRA and shown to candidates judging the commute."
            />

            {/* Its own section, because it answers a different question from the
                address above and only matches it for a business with one
                location.

                THE TICK IS THE DEFAULT, and it saves NULL rather than a copy of
                the outlet address. Those are different states: a company on the
                fallback follows an outlet move, while a copy would silently go
                on billing a shop they have left. It also means the ordinary case
                — nothing collects this at sign-up — reads as a deliberate answer
                rather than a blank box somebody takes for "the invoices were
                going nowhere". */}
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label>Billing address</Label>

              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sameAsOutlet}
                  onChange={(e) => setSameAsOutlet(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-border accent-primary"
                />
                <span>Same as the outlet address</span>
              </label>

              {sameAsOutlet ? (
                <p className="text-xs text-muted-foreground">
                  {employer.companyAddress ? (
                    <>
                      Invoices for {employer.companyName} go to{" "}
                      <span className="font-medium text-foreground">
                        {employer.companyAddress}
                      </span>
                      , and follow it if the outlet ever moves.
                    </>
                  ) : (
                    <>
                      There is no outlet address either, so invoices for{" "}
                      {employer.companyName} print with no address on them at
                      all. Untick this to give the bill somewhere to go.
                    </>
                  )}
                </p>
              ) : (
                <>
                  <Input
                    id="billing"
                    value={billing}
                    onChange={(e) => setBilling(e.target.value)}
                    placeholder="Head office, where the bill goes"
                  />
                  <p className="text-xs text-muted-foreground">
                    Where invoices are addressed when the finance office is not
                    the outlet — a chain bills a head office, not a shop floor.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {dirty
                  ? "Unsaved changes."
                  : "Descriptive fields only — saving changes nothing about what anyone may do."}
              </p>
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={!dirty || save.isPending}
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <CoinsAndPayments employer={employer} />

      <DecisionBand employer={employer} decide={decide} />
    </div>
  );
}

// --- coins and payments -------------------------------------------------------

/** Presetting a top-up, and the way through to the money side for this business.
 *
 *  RAISING A BILL IS NOT CREATING COINS, and the card says so where somebody is
 *  about to press the button. The invoice is raised unpaid; the coins appear only
 *  when a transfer is confirmed against a bank statement on the payments screen.
 *  Keeping those two on different screens is what stops the person who raised a
 *  bill from also being the person who credits it.
 *
 *  No balance is shown, deliberately: the admin employer DTO carries none, and a
 *  figure inferred here from a list of invoices would disagree with the company's
 *  real float the moment a shift is posted.
 *
 *  Both links carry `?company=` — the payments and invoice screens read it into
 *  their own visible search, so arriving from here lands on this company's rows
 *  with the narrowing removable rather than hidden. */
function CoinsAndPayments({ employer }: { employer: EmployerReview }) {
  // The UEN rather than the name: it is unique, it is what a bank transfer
  // reference quotes, and two outlets of the same brand share a name.
  const filter = `?company=${encodeURIComponent(employer.companyUen)}`;
  const canBill = employer.companyVerificationStatus === "verified";

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const [coins, setCoins] = useState(String(MIN_TOPUP_COINS));
  const parsed = Number(coins);
  const valid =
    Number.isInteger(parsed) &&
    parsed >= MIN_TOPUP_COINS &&
    parsed <= MAX_TOPUP_COINS;

  // ONE rate, and it is the company's. There is no per-bill override: a price
  // with two homes is two answers to what a customer pays, and the agreed rate
  // below already prices their own top-ups in the app as well as this one.
  const listPrice = settings?.coinPriceCents ?? null;
  const standing = employer.companyCoinPriceCents;
  const priceCents = standing ?? listPrice;
  const isDiscounted =
    priceCents !== null && listPrice !== null && priceCents !== listPrice;

  // Priced from the rate actually being used, not a constant. Shown rather than
  // left to the invoice, so nobody raises a $100,000 bill from a trailing zero
  // they could not see.
  const preview =
    valid && priceCents !== null ? money(parsed * priceCents) : null;

  // The standing rate, edited separately from the bill. Seeded from the company
  // and reset whenever the server answers, so two admins editing do not leave a
  // stale number in the box.
  const [standingDraft, setStandingDraft] = useState(
    standing === null ? "" : String(standing),
  );
  const standingParsed = standingDraft.trim() === "" ? null : Number(standingDraft);
  const standingValid =
    standingParsed === null ||
    (Number.isInteger(standingParsed) &&
      standingParsed >= COIN_PRICE_BOUNDS.min &&
      standingParsed <= COIN_PRICE_BOUNDS.max);
  const standingDirty = standingParsed !== standing;

  const queryClient = useQueryClient();

  const price = useMutation({
    mutationFn: (cents: number | null) => setCoinPrice(employer.userId, cents),
    onSuccess: (_r, cents) => {
      queryClient.invalidateQueries({ queryKey: ["employers"] });
      toast.success(
        cents === null
          ? `${employer.companyName} is back on the list price`
          : `${employer.companyName} now pays ${money(cents)} a coin`,
      );
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not save that rate"),
  });

  // The bill the API refused to duplicate. Held so the dialog can name it —
  // "raise another anyway" is not a question anybody can answer without being
  // told which one already exists.
  const [duplicate, setDuplicate] = useState<string | null>(null);

  const raise = useMutation({
    mutationFn: (allowDuplicate: boolean) =>
      createTopUp(employer.userId, parsed, allowDuplicate),
    onSuccess: (invoice) => {
      setDuplicate(null);
      toast.success(
        invoice.emailedTo
          ? `${invoice.number} raised and emailed to ${invoice.emailedTo}`
          : `${invoice.number} raised — no email on this account, so send it yourself`,
      );
      setCoins(String(MIN_TOPUP_COINS));
    },
    onError: (error: Error) => {
      // Matched on the CODE, not the wording — see ApiError. A 409 here is the
      // duplicate guard asking a question, not a failure to report.
      if (error instanceof ApiError && error.code === "DUPLICATE_TOPUP") {
        setDuplicate(error.message);
        return;
      }
      toast.error(error.message || "Could not raise that top-up");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={ReceiptIcon} size={16} strokeWidth={2} />
          Coins &amp; payments
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="coins">Preset a top-up</Label>

          {/* The same four shortcuts the app's own top-up sheet offers, so staff
              on the phone and the employer in the app are looking at the same
              numbers. They are amounts, not packs — 10,000 is ten times 1,000
              and buys nothing extra. */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TOPUP_COINS.map((amount) => (
              <Button
                key={amount}
                type="button"
                variant={parsed === amount ? "default" : "outline"}
                size="sm"
                onClick={() => setCoins(String(amount))}
                className="tabular-nums"
              >
                {amount.toLocaleString("en-SG")}
              </Button>
            ))}
          </div>
        </div>

        {/* "Other" on its own line under the shortcuts, rather than a fifth box
            in the row pretending to be one of them. The presets are the common
            amounts; this is the one somebody types. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coins">Other — how much</Label>
            <div className="flex items-center gap-2">
              <Input
                id="coins"
                inputMode="numeric"
                value={coins}
                onChange={(e) => setCoins(e.target.value)}
                aria-invalid={!valid}
                className="h-8 w-32 tabular-nums"
              />
              <span className="text-xs text-muted-foreground">coins</span>
            </div>
          </div>

          {/* Only the AMOUNT is gated now, not the business's state. Raising the
              bill is staff's own work, and the finance call and the ACRA check
              are very often the same phone call — see the API, which no longer
              refuses an unverified company either. What that refusal protected
              is protected downstream: this creates no coins, and the float
              appears only when somebody confirms the transfer landed. */}
          <Button
            size="sm"
            onClick={() => raise.mutate(false)}
            disabled={!valid || raise.isPending}
          >
            <HugeiconsIcon icon={Invoice01Icon} strokeWidth={2} />
            {raise.isPending ? "Raising…" : "Raise invoice"}
          </Button>
        </div>

        <p className="max-w-prose text-xs text-muted-foreground">
          {!valid ? (
            <>
              Between {MIN_TOPUP_COINS.toLocaleString("en-SG")} and{" "}
              {MAX_TOPUP_COINS.toLocaleString("en-SG")} whole coins. Anything less
              buys less than a single shift.
            </>
          ) : (
            <>
              {preview ? (
                <>
                  <span className="font-medium text-foreground">
                    {preview}
                  </span>{" "}
                  at {priceCents !== null ? money(priceCents) : "—"} a coin
                  {isDiscounted ? " (agreed rate)" : ""}, due in{" "}
                  {settings?.invoiceTermsDays ?? "—"} days.{" "}
                </>
              ) : null}
              Raises the bill for {employer.companyName} and emails it. It creates
              no coins — those appear only when the transfer is confirmed against
              a bank statement.
            </>
          )}
        </p>

        {/* The duplicate guard, asking rather than refusing. The API returns a
            409 naming the unpaid bill that already exists; raising a second one
            is occasionally right, so there is a way through — but it takes
            reading which bill it is and saying so. */}
        <Dialog
          open={!!duplicate}
          onOpenChange={(open) => {
            if (!open) setDuplicate(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>That top-up already exists</DialogTitle>
              <DialogDescription>{duplicate}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDuplicate(null)}
                disabled={raise.isPending}
              >
                Keep the one bill
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => raise.mutate(true)}
                disabled={raise.isPending}
              >
                {raise.isPending ? "Raising…" : "Raise a second one"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Said, not enforced. Billing an unverified business is allowed — it is
            staff's own work, and the finance call and the ACRA check are usually
            the same conversation — but whoever presses the button should know
            which of the two they have actually done. */}
        {!canBill && (
          <p className="max-w-prose rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/15 dark:text-amber-200">
            <span className="font-medium">
              This business is {employer.companyVerificationStatus}.
            </span>{" "}
            The invoice will still go out. Nobody here can post a job or spend
            coins until it is verified, though — so a paid top-up would sit
            unusable.
          </p>
        )}

        {/* The STANDING rate, as opposed to the one-off above. This is the
            agreement: it prices every future bill including the ones the
            employer raises for themselves in the app, which is the half a
            per-invoice discount could never cover. */}
        <div className="flex flex-col gap-2 border-t pt-3">
          <Label htmlFor="standing">
            Agreed rate for {employer.companyName}
            {/* Said out loud, because the rate is the BUSINESS's and this page
                is one person's. Setting it here changes what every manager at
                this UEN pays, and somebody editing from a colleague's page
                should not have to infer that. */}
            <span className="ml-1 font-normal text-muted-foreground">
              · UEN {employer.companyUen}
              {employer.companySeats > 1 &&
                ` · all ${employer.companySeats} managers`}
            </span>
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="standing"
              inputMode="numeric"
              value={standingDraft}
              onChange={(e) => setStandingDraft(e.target.value)}
              placeholder={`${listPrice ?? 100} (list price)`}
              aria-invalid={!standingValid}
              className="h-8 w-40 tabular-nums"
            />
            <span className="text-xs text-muted-foreground">cents a coin</span>
            <Button
              size="sm"
              variant="outline"
              disabled={!standingValid || !standingDirty || price.isPending}
              onClick={() => price.mutate(standingParsed)}
            >
              {price.isPending ? "Saving…" : "Save rate"}
            </Button>
            {standing !== null && (
              <Button
                size="sm"
                variant="ghost"
                disabled={price.isPending}
                onClick={() => {
                  setStandingDraft("");
                  price.mutate(null);
                }}
              >
                Back to list price
              </Button>
            )}
          </div>
          <p className="max-w-prose text-xs text-muted-foreground">
            {standing === null ? (
              <>
                On the list price, so they follow it when it changes. Set a rate
                only when one has actually been agreed — it belongs to the
                business, so it applies to everyone who hires under this UEN.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {money(standing)} a coin
                </span>{" "}
                — agreed, so it does not move when the list price does. This
                prices their own top-ups in the app too, not just bills raised
                here. Nothing already invoiced changes.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/dashboard/payments${filter}`} />}
          >
            <HugeiconsIcon icon={ReceiptIcon} strokeWidth={2} />
            Awaiting confirmation
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/dashboard/invoices${filter}&status=all`} />}
          >
            <HugeiconsIcon icon={Invoice01Icon} strokeWidth={2} />
            All invoices
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- the decision -------------------------------------------------------------

/** Kept apart from the form above, and styled as a band rather than a card, so
 *  that the one control on this page which changes what somebody is ALLOWED to do
 *  cannot be mistaken for the ones that fix a typo. */
function DecisionBand({
  employer,
  decide,
}: {
  employer: EmployerReview;
  decide: {
    mutate: (input: {
      status: "approved" | "rejected";
      companyVerified?: boolean;
    }) => void;
    isPending: boolean;
  };
}) {
  const approved = employer.status === "approved";
  const companyBlocked = employer.companyVerificationStatus !== "verified";

  // Offered here as well as in the queue's dialog, because both halves gate
  // posting and approving only the person would leave them exactly as blocked as
  // before — a decision that looks like it worked and did nothing. Defaulted on
  // only while the business is still unverified: confirming that somebody works
  // at an already-checked cafe should not re-open a decision about the cafe.
  const [alsoVerifyCompany, setAlsoVerifyCompany] = useState(companyBlocked);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">
            {approved
              ? "Approved to act for this business"
              : "Awaiting the call"}
          </p>
          <p className="max-w-prose text-xs text-muted-foreground">
            {approved
              ? "They can post jobs and spend the company's coins. Rejecting takes that away immediately — the gate reads this on every request."
              : "They can do nothing in the company's name until this is approved."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {employer.status !== "rejected" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => decide.mutate({ status: "rejected" })}
              disabled={decide.isPending}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              Reject
            </Button>
          )}
          {!approved && (
            <Button
              size="sm"
              onClick={() =>
                decide.mutate({
                  status: "approved",
                  companyVerified: alsoVerifyCompany ? true : undefined,
                })
              }
              disabled={decide.isPending}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
              {decide.isPending ? "Saving…" : "Approve"}
            </Button>
          )}
        </div>
      </div>

      {!approved && (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background/60 p-3 text-sm">
          <input
            type="checkbox"
            checked={alsoVerifyCompany}
            onChange={(e) => setAlsoVerifyCompany(e.target.checked)}
            className="mt-0.5 size-4 rounded border-border accent-primary"
          />
          <span>
            <span className="font-medium">
              Also mark {employer.companyName} verified
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {companyBlocked
                ? `Both halves have to pass before anyone at this UEN can post, and the business is currently ${employer.companyVerificationStatus}. Approving the person alone leaves them blocked.`
                : "This business is already verified — leave unticked to change nothing about it."}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

// --- pieces -------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/dashboard/employers"
      className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} size={15} strokeWidth={2} />
      Back to employers
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label}: <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function ReadOnly({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string | null;
  icon?: Parameters<typeof HugeiconsIcon>[0]["icon"];
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {icon && (
          <HugeiconsIcon
            icon={icon}
            size={13}
            strokeWidth={2}
            className="shrink-0 text-muted-foreground"
          />
        )}
        <span className="truncate">{value ?? "—"}</span>
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-28 rounded-xl" />
    </div>
  );
}
