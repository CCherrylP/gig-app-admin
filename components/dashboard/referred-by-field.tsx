"use client";

import { Input } from "@/components/ui/input";
import type { EmployerReview } from "@/lib/employers";

/** The code to start the box with: the one they signed up with, if it can refer a business. */
export const suggestedReferralCode = (employer: EmployerReview) =>
  employer.signupReferral?.valid ? employer.signupReferral.code : "";

/** Asked on the approval call: did someone refer you? Takes an MCI or BD staff code. */
export function ReferredByField({
  employer,
  value,
  onChange,
}: {
  employer: EmployerReview;
  value: string;
  onChange: (value: string) => void;
}) {
  const link = employer.signupReferral;
  const who = link
    ? `${link.name ?? "someone"}${link.companyName ? ` (${link.companyName})` : ""}`
    : "";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="referred-by" className="text-xs font-medium">
        Referred by (optional)
      </label>
      <Input
        id="referred-by"
        placeholder="Their referrer's code, e.g. from MCI"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 font-mono"
      />
      <p className="text-xs text-muted-foreground">
        {employer.referredBy
          ? `Currently referred by ${employer.referredBy.name ?? "someone"}${
              employer.referredBy.companyName ? ` (${employer.referredBy.companyName})` : ""
            }. A new code replaces them.`
          : link?.valid
            ? `They signed up from ${who}'s link. Confirm it on the call, or clear the box.`
            : link
              ? `They signed up with code ${link.code}, but it can't refer a business.`
              : "Ask if a partner such as MCI referred them. Leave blank if not."}
      </p>
    </div>
  );
}
