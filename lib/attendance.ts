import { fetchWithAuth } from "./api";

// Who turned up, and what stands behind the claim.
//
// Two routes with very different weight: a scanned code is a supervisor
// vouching on the spot, and a selfie is a photograph plus a location fix with
// nobody behind it. This is also the screen a DISPUTE is settled from — an
// employer saying nobody came against a candidate saying they worked six hours
// — which is why the scheduled times travel beside the actual ones.
//
// Shapes copied from gig-app-api's contract/admin.ts. Keep them in step.

export type CheckInMethod = "code" | "selfie";
export type SelfieReview = "pending" | "approved" | "rejected";
export type AttendanceFilter = "attention" | "missing" | "reviewed" | "all";

export interface AttendanceRecord {
  applicationId: string;
  status: string;

  candidateId: string;
  candidateName: string | null;

  gigTitle: string;
  roleName: string;
  companyName: string;
  /** 'YYYY-MM-DD'. */
  shiftOnDate: string;
  /** 'HH:MM' wall clock, as the employer typed it. */
  scheduledStart: string;
  scheduledEnd: string;

  checkInAt: string | null;
  checkInMethod: CheckInMethod | null;
  /** Short-lived signed link, or null. */
  checkInPhotoUrl: string | null;
  /** Metres from the gig. Evidence on the code route, the gate on the selfie. */
  checkInDistance: number | null;
  /** Null on a scanned code — only the selfie route needs a human. */
  checkInReview: SelfieReview | null;
  /** Minutes after the scheduled start. Negative is early. */
  minutesLate: number | null;

  clockOutAt: string | null;
  clockOutPhotoUrl: string | null;

  workedMinutes: number | null;
  earnedCents: number | null;
  /** The employer signing the hours off, which is what releases wages. */
  approvedAt: string | null;

  /** The full scheduled length — what a release pays by default, because pay IS
   *  the scheduled hours. A missing clock-out changes what we can prove, not
   *  what is owed. */
  scheduledMinutes: number;
  payPerHourCents: number;
}

export interface AttendanceResponse {
  records: AttendanceRecord[];
  pendingReviewCount: number;
  attentionCount: number;
  /** Shifts with an end of the clock missing and nobody paid. */
  missingCount: number;
}

/** The geofence the selfie route is gated on, repeated here so the screen can
 *  say WHY a row is flagged. The API is the authority. */
export const GEOFENCE_M = 150;

export function listAttendance(filter: AttendanceFilter = "attention") {
  return fetchWithAuth<AttendanceResponse>(`/admin/attendance?filter=${filter}`);
}

/** Whether a selfie check-in counts. Refused by the API on a scanned code —
 *  a supervisor already vouched for that one, and stamping it would later read
 *  as somebody having checked a photograph that does not exist. */
export function reviewAttendance(
  applicationId: string,
  review: "approved" | "rejected",
) {
  return fetchWithAuth<AttendanceResponse>(
    `/admin/attendance/${applicationId}`,
    { method: "PATCH", body: JSON.stringify({ review }) },
  );
}

/** Pay for a shift the clock missed.
 *
 *  `minutes` omitted means the FULL SCHEDULED LENGTH, which is the point: pay is
 *  the scheduled hours anyway — 14:00 to 18:00 is four hours however the thumbs
 *  landed — so a dead phone changes what we can prove, not what is owed.
 *
 *  Goes through the same settlement the employer's own sign-off uses, so it
 *  stamps the shift, fixes the wage, and refunds the unearned part of the hold
 *  in one transaction.
 *
 *  `reason` is REQUIRED. Somebody is being paid for hours no clock recorded, and
 *  a payment with nothing written against it is one nobody can account for. */
export function releaseWages(
  applicationId: string,
  reason: string,
  minutes?: number,
) {
  return fetchWithAuth<AttendanceResponse>(
    `/admin/attendance/${applicationId}/release`,
    {
      method: "PATCH",
      body: JSON.stringify(
        minutes === undefined ? { reason } : { reason, minutes },
      ),
    },
  );
}

/** '4h', '2h 30m', '45m' — the same shape the API writes into the sentence the
 *  candidate reads. */
export function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** What a release will come to, in cents. Shown BEFORE the button is pressed —
 *  an admin moving money should see the figure first. */
export const wagesFor = (minutes: number, payPerHourCents: number) =>
  Math.round((minutes / 60) * payPerHourCents);

/** 'HH:MM' out of an SGT ISO string, for putting an actual time next to a
 *  scheduled one. Both then read as wall clocks, which is the comparison. */
export function clockOf(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "12 min late", "4 min early", or on time. Null when they never clocked in. */
export function lateness(minutes: number | null) {
  if (minutes === null) return null;
  if (minutes <= 0 && minutes > -60) return null;
  if (minutes > 0) return `${minutes} min late`;
  return `${Math.abs(minutes)} min early`;
}
