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
export type AttendanceFilter =
  | "attention"
  | "missing"
  | "upcoming"
  | "reviewed"
  | "all";

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
  /** WHETHER there is one. The link is fetched on the click — see
   *  attendancePhoto below. This used to be a short-lived signed URL, which
   *  meant the queue signed two per row before it could answer, for links the
   *  page discarded and re-minted anyway. */
  hasCheckInPhoto: boolean;
  /** Metres from the gig. Evidence on the code route, the gate on the selfie. */
  checkInDistance: number | null;
  /** Null on a scanned code — only the selfie route needs a human. */
  checkInReview: SelfieReview | null;
  /** Minutes after the scheduled start. Negative is early. */
  minutesLate: number | null;

  clockOutAt: string | null;
  hasClockOutPhoto: boolean;

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
  /** Shifts with an end of the clock missing and nobody paid. Only shifts that
   *  have ENDED — a booking for next week has not missed anything. */
  missingCount: number;
  /** Bookings still to run, or running now. A diary, not a work pile. */
  upcomingCount: number;
}

/** When a shift actually finishes, overnight included.
 *
 *  The API's `shiftEndInstant`, repeated on this side for one reason: whether
 *  the Release button appears. `all` lists shifts that have not run yet, and the
 *  API refuses to release those (409 SHIFT_NOT_OVER) — offering the button and
 *  then failing on it would be the same bug one step later.
 *
 *  Both columns are Singapore wall clocks, so an end at or before the start has
 *  rolled past midnight: 21:00–05:00 finishes the next morning, not sixteen
 *  hours before it began. */
export function shiftEndsAt(record: {
  shiftOnDate: string;
  scheduledStart: string;
  scheduledEnd: string;
}) {
  const start = new Date(`${record.shiftOnDate}T${record.scheduledStart}:00+08:00`);
  const end = new Date(`${record.shiftOnDate}T${record.scheduledEnd}:00+08:00`);

  return end > start ? end : new Date(end.getTime() + 86_400_000);
}

/** Has this shift been and gone? */
export const shiftHasEnded = (
  record: {
    shiftOnDate: string;
    scheduledStart: string;
    scheduledEnd: string;
  },
  now: Date = new Date(),
) => shiftEndsAt(record) <= now;

/** The geofence the selfie route is gated on, repeated here so the screen can
 *  say WHY a row is flagged. The API is the authority. */
export const GEOFENCE_M = 150;

export function listAttendance(filter: AttendanceFilter = "attention") {
  return fetchWithAuth<AttendanceResponse>(`/admin/attendance?filter=${filter}`);
}

/** A fresh link to ONE photograph, minted now.
 *
 *  Replaces re-fetching the whole queue to refresh a single URL, which is what
 *  the page used to do — and since the queue signed every photograph on it, one
 *  click cost as much as a page load. The link is still short-lived and still
 *  minted per request; that part was never the problem. */
export function attendancePhoto(applicationId: string, which: "in" | "out") {
  return fetchWithAuth<{ url: string }>(
    `/admin/attendance/${applicationId}/photo/${which}`,
  );
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
