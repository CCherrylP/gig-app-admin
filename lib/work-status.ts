// What a candidates.work_status code means, in words.
//
// COPIED from gig-app's data/workPassData.json — the repos share no package, so
// a status added there shows up here as its raw code until it is added below.
// That fallback is deliberate: an unknown code printed as-is is a visible gap,
// where a guessed label would be a wrong answer.
//
// DECLARED, NEVER CHECKED. The candidate picks this from a list; no pass is ever
// uploaded. So it is shown as what they told us, not as a fact.

/** `limited` = only under stated restrictions (e.g. a Student's Pass in term). */
type Authorized = true | false | "limited";

const WORK_STATUS: Record<string, { label: string; authorized: Authorized }> = {
  singaporean: { label: "Singapore Citizen", authorized: true },
  pr: { label: "PR", authorized: true },
  ep: { label: "Employment Pass", authorized: true },
  pep: { label: "Personalised Employment Pass", authorized: true },
  one_pass: { label: "Overseas Networks & Expertise Pass", authorized: true },
  entrepass: { label: "EntrePass", authorized: true },
  s_pass: { label: "S Pass", authorized: true },
  work_permit: { label: "Work Permit", authorized: true },
  wp_domestic: { label: "Work Permit (Domestic Worker)", authorized: true },
  wp_nanny: { label: "Work Permit (Confinement Nanny)", authorized: true },
  wp_artiste: { label: "Work Permit (Performing Artiste)", authorized: true },
  tep: { label: "Training Employment Pass", authorized: "limited" },
  twp: { label: "Training Work Permit", authorized: "limited" },
  whp: { label: "Work Holiday Pass", authorized: "limited" },
  dp: { label: "Dependant's Pass", authorized: false },
  ltvp: { label: "Long-Term Visit Pass", authorized: false },
  loc: { label: "Letter of Consent", authorized: true },
  mwp: { label: "Miscellaneous Work Pass", authorized: "limited" },
  student_pass: { label: "Student's Pass", authorized: "limited" },
  exempt: { label: "Work Pass Exempt", authorized: "limited" },
  other_pass: { label: "Other Pass", authorized: true },
  need_pass: { label: "Needs a pass", authorized: false },
  not_stated: { label: "Not stated", authorized: false },
};

/** "S Pass" for `s_pass`; the raw code for one this copy does not know yet. */
export function workStatusLabel(code: string | null) {
  if (!code) return null;
  return WORK_STATUS[code]?.label ?? code;
}

/** The platform only lets citizens and PRs work. Anything else declared is
 *  worth a reviewer's second look, so it is flagged rather than hidden. */
export function isLocal(code: string | null) {
  return code === "singaporean" || code === "pr";
}
