import { supabase } from "./supabase";

// Two-factor login (TOTP) through Supabase Auth. Staff need aal2 to see the dashboard.

/** What the signed-in admin still has to do: set up an app, enter a code, or nothing. */
export type MfaStep =
  | { kind: "enrol" }
  | { kind: "verify"; factorId: string }
  | { kind: "done" };

/** Where to send someone the API refused with MFA_REQUIRED, or who is still aal1. */
export const MFA_PATH = "/login?mfa=1";

/** "1" makes the dashboard ask for a code on every login. Off by default, to match
 *  the API's ADMIN_REQUIRE_MFA. If the API asks anyway, it sends people to MFA_PATH. */
export const MFA_ON = process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA === "1";

/** True when this session has passed a two-factor check. */
export async function hasAal2(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data?.currentLevel === "aal2";
}

/** Work out the next step from the session's level and the user's verified factors.
 *  `forced` is true when the API refused with MFA_REQUIRED, even with MFA_ON off. */
export async function nextMfaStep(forced = false): Promise<MfaStep> {
  if (!MFA_ON && !forced) return { kind: "done" };
  if (await hasAal2()) return { kind: "done" };

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;

  const factor = data.totp[0];
  return factor ? { kind: "verify", factorId: factor.id } : { kind: "enrol" };
}

export interface Enrolment {
  factorId: string;
  /** An image URL for the QR code. */
  qrSrc: string;
  /** The same secret as text, for typing in by hand. */
  secret: string;
}

/** Start setting up an authenticator app. Clears half-finished attempts first,
 *  since a leftover unverified factor blocks a new one with the same name. */
export async function startEnrolment(): Promise<Enrolment> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Admin dashboard",
    issuer: "AdHoc Admin",
  });
  if (error) throw error;

  // auth-js hands back "data:image/svg+xml;utf-8,<svg...>". Encode the SVG so
  // characters like # cannot cut the URL short.
  const svg = data.totp.qr_code.replace(/^data:image\/svg\+xml;utf-8,/, "");
  return {
    factorId: data.id,
    qrSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    secret: data.totp.secret,
  };
}

/** Check a 6-digit code. On success the session becomes aal2. */
export async function verifyCode(factorId: string, code: string): Promise<boolean> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return !error;
}
