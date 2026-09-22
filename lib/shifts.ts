import { fetchWithAuth } from "./api";

// Every shift on the platform, in a window, past ones included — and the one
// place staff can correct one.
//
// WHY IT IS ITS OWN SCREEN. Clock in / clock out starts from an APPLICATION and
// only ever lists shifts somebody turned up to; payroll starts from money owed.
// A shift nobody applied to is in neither, so "what is happening on the 14th"
// and "this job was posted on the wrong Saturday" were both unanswerable from
// this dashboard.
//
// WHY IT IS EDITABLE HERE AND NOWHERE ELSE. The employer's own edit refuses a
// date or hours change once anybody is booked — on their side moving a shift is
// a different offer rather than an edit, and the API answers SHIFT_IN_USE. That
// is right, and it left nobody able to fix a real mistake: a 09:00 shift typed
// as 21:00 with three people on it could only be undone by closing the listing
// and asking everybody to apply again. This is that route.
//
// Shapes copied from gig-app-api's contract/admin.ts. Keep them in step.

export type ShiftFilter = "all" | "upcoming" | "past" | "unfilled";

/** One live claim on a seat. Declined and withdrawn applications are not here —
 *  they hold no seat, and listing them would read as a fuller shift than it is. */
export interface ShiftBooking {
  applicationId: string;
  candidateId: string;
  candidateName: string | null;
  status: string;
  checkInAt: string | null;
  clockOutAt: string | null;
  /** The employer's sign-off. Set means this seat's money is done. */
  approvedAt: string | null;
  earnedCents: number | null;
}

export interface AdminShift {
  id: string;
  /** 'YYYY-MM-DD' — a calendar day, which is what the grid is built on. */
  onDate: string;
  /** 'HH:MM' wall clock, as the employer typed it. */
  startTime: string;
  endTime: string;

  headcount: number;
  /** Seats BOOKED — confirmed, not merely applied for. */
  filled: number;
  unpaidBreakMinutes: number;
  unpaidBreakCount: number;

  /** The window somebody is on site for, overnight included. */
  scheduledMinutes: number;
  /** That window minus the unpaid break — what the shift PAYS, per seat. */
  paidMinutes: number;

  roleId: string;
  roleName: string;
  payPerHourCents: number;

  gigId: string;
  gigTitle: string;
  /** Set when the listing has been taken down. The shift survives it. */
  gigClosedAt: string | null;

  companyId: string;
  companyName: string;
  location: string;

  bookings: ShiftBooking[];

  /** Somebody holds a live claim on it. An edit will move their week, and they
   *  are told about it. */
  locked: boolean;
  /** THE MONEY IS DONE — a sign-off on any seat, or the shift's own settlement.
   *  The API refuses to edit these: those hours are what somebody was paid. */
  settled: boolean;
  settledAt: string | null;
}

export interface ShiftsResponse {
  shifts: AdminShift[];
  /** The window actually answered, inclusive at both ends. */
  from: string;
  to: string;
  /** Shifts matching the window AND the tab — what the list is a page of. */
  total: number;
  /** Shifts in the WINDOW with an empty seat and a date still to come, whatever
   *  the tab is. The only number here that is work. Tab-independent on purpose:
   *  a figure that moved when somebody clicked Past would be describing the tab
   *  rather than the month. */
  openCount: number;
  /** Shifts in the window with somebody booked on, again whatever the tab is. */
  bookedCount: number;
  /** The list was capped. A calendar showing part of a month without saying so
   *  reads as a quiet week. */
  truncated: boolean;
}

/** What one correction can change. Every field optional, and omitting one leaves
 *  it alone — this is one shift and one typed correction, not a description of
 *  what the listing should end up as. */
export interface ShiftEdit {
  onDate?: string;
  startTime?: string;
  endTime?: string;
  headcount?: number;
  /** The break as the pair, never a total. Both or neither. */
  unpaidBreakMinutes?: number;
  unpaidBreakCount?: number;
}

export function listShifts(
  range: { from: string; to: string },
  filter: ShiftFilter = "all",
  companyId?: string,
) {
  const params = new URLSearchParams({ from: range.from, to: range.to, filter });
  if (companyId) params.set("companyId", companyId);

  return fetchWithAuth<ShiftsResponse>(`/admin/shifts?${params}`);
}

/** The corrected shift comes back, so the row that was edited can be swapped in
 *  place rather than the whole month re-fetched. */
export function updateShift(id: string, edit: ShiftEdit) {
  return fetchWithAuth<AdminShift>(`/admin/shifts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(edit),
  });
}

// --- reading a shift ----------------------------------------------------------

/** The four break lengths the employer's form offers, and the only ones the
 *  database accepts. A break is rostered in quarter hours; 37 minutes on a
 *  payslip is a figure no manager chose and no worker can check. */
export const BREAK_LENGTHS = [0, 15, 30, 45, 60] as const;

/** '4h', '2h 30m', '45m'. Matches formatHours in lib/attendance. */
export function shiftHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/** How long a shift is, from two clock faces, overnight included: 21:00–05:00 is
 *  eight hours and not minus sixteen.
 *
 *  The same arithmetic the API's scheduledMinutes does, repeated here for ONE
 *  reason — the edit form has to say what the shift will be before it is saved,
 *  and asking the server what a shift nobody has written yet comes to is a round
 *  trip per keystroke. Every stored figure on the screen still comes from the
 *  API; this only ever describes a form.
 *
 *  An end equal to the start is a full day, the reading the API takes: 00:00 to
 *  00:00 is how 24-hour cover gets typed. */
export function windowMinutes(startTime: string, endTime: string) {
  const face = (value: string) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

  const start = face(startTime);
  const end = face(endTime);

  return end > start ? end - start : end + 1440 - start;
}

/** The PAID minutes of a window with a break taken out of it, floored at zero.
 *  The window is what somebody is on site for; this is what is paid, and the two
 *  stopped being the same number when breaks arrived. */
export const payableMinutes = (
  startTime: string,
  endTime: string,
  breakMinutes: number,
  breakCount: number,
) => Math.max(0, windowMinutes(startTime, endTime) - breakMinutes * breakCount);

/** Wages for one seat, in cents, from PAID minutes at the role's rate. Cents
 *  from integer minutes, never a float multiplication — the same order the API
 *  computes it in, so the figure on the screen is the figure that is held. */
export const wageCents = (minutes: number, payPerHourCents: number) =>
  Math.round((payPerHourCents * minutes) / 60);

/** What one seat of this shift pays, as stored. Reads `paidMinutes` from the
 *  API rather than recomputing it: the window overstates the pay by the lunch
 *  hour, and that is the one number a candidate decides on. */
export const seatWageCents = (shift: AdminShift) =>
  wageCents(shift.paidMinutes, shift.payPerHourCents);

/** Where a shift stands, for the pill and the calendar chip.
 *
 *  `settled` outranks the seat count because it is the one that decides whether
 *  the row can be edited at all — a full shift can still be corrected, a settled
 *  one cannot.
 *
 *  The other three are the seats, said in a way that reads the same whether the
 *  shift is next week or last month: "part filled" is a roster short of people
 *  either way, where "seats open" would invite somebody to fill a shift that has
 *  already been and gone. */
export type ShiftState = "settled" | "full" | "part" | "empty";

export function shiftState(shift: AdminShift): ShiftState {
  if (shift.settled) return "settled";
  if (shift.filled >= shift.headcount) return "full";
  return shift.filled > 0 ? "part" : "empty";
}

export const SHIFT_STATE_LABEL: Record<ShiftState, string> = {
  settled: "Settled",
  full: "Full",
  part: "Part filled",
  empty: "Nobody booked",
};
