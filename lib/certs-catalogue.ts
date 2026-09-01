// The certificate catalogue, mirrored from gig-app's data/rolesData.json.
//
// The API sends a `certId` and nothing else — deliberately, because the
// catalogue ships in the app and two copies of it is one that goes stale. This
// is the third copy, and it exists only to put a name and an issuer next to the
// id on screen: "wsq-security" is not something a reviewer can check a document
// against, and the issuer is half of what makes the check possible at all.
//
// An id that is not here still renders — see certName — so a catalogue entry
// added to the app before it is added here degrades to the raw slug rather than
// to a blank cell.

export interface CertMeta {
  id: string;
  name: string;
  issuer: string;
  note: string;
}

export const CERTIFICATIONS: CertMeta[] = [
  {
    id: "food-hygiene",
    name: "WSQ Food Safety Course Level 1",
    issuer: "SkillsFuture Singapore, via approved training providers",
    note: "Replaced the older Basic Food Hygiene Course. Required for anyone handling unpackaged food.",
  },
  {
    id: "security-licence",
    name: "Security Officer Licence",
    issuer: "Police Licensing & Regulatory Department, Singapore Police Force",
    note: "A legal requirement for security duties. Guarding, screening and access control need it.",
  },
  {
    id: "forklift-licence",
    name: "WSQ Operate Forklift",
    issuer: "Approved WSQ training providers",
    note: "Employers usually also require site-specific familiarisation before a first shift.",
  },
  {
    id: "work-at-height",
    name: "WSQ Work at Height for Workers",
    issuer: "Approved WSQ training providers",
    note: "Required by MOM for work above 3 metres. Needs periodic refresher.",
  },
  {
    id: "class-3",
    name: "Class 3 driving licence",
    issuer: "Singapore Traffic Police",
    note: "Class 3A is automatic only; some light goods roles need a manual Class 3.",
  },
  {
    id: "class-2b",
    name: "Class 2B riding licence",
    issuer: "Singapore Traffic Police",
    note: "Riders normally supply their own bike, helmet and thermal bag.",
  },
  {
    id: "first-aid",
    name: "Standard First Aid",
    issuer: "Singapore Red Cross, St John and other approved providers",
    note: "Usually one certified first-aider per crew rather than every worker.",
  },
  {
    id: "cpr-aed",
    name: "CPR + AED certification",
    issuer: "SRFAC-aligned approved providers",
    note: "Usually needs renewal every two years.",
  },
  {
    id: "snb-registration",
    name: "Singapore Nursing Board registration",
    issuer: "Singapore Nursing Board",
    note: "A legal requirement to practise as a nurse.",
  },
  {
    id: "healthcare-support",
    name: "Healthcare support certification",
    issuer: "ITE, WSQ providers, healthcare institutions",
    note: "Requirements vary by institution — some train on the job, others require it up front.",
  },
  {
    id: "cleanroom-gowning",
    name: "Cleanroom gowning and protocol briefing",
    issuer: "The employer, per site",
    note: "Site-specific. Not transferable between employers.",
  },
  {
    id: "halal-awareness",
    name: "Halal handling awareness",
    issuer: "MUIS-aligned in-house or provider training",
    note: "Often delivered as an on-site briefing rather than a formal certificate.",
  },
  {
    id: "hygiene-briefing",
    name: "On-site hygiene briefing",
    issuer: "The employer",
    note: "Not a certificate. Record it as attended, not as held.",
  },
  {
    id: "working-with-children",
    name: "Background screening for work with children",
    issuer: "The engaging school, centre or operator",
    note: "A clearance the employer runs, not a qualification the worker holds.",
  },
];

const BY_ID = new Map(CERTIFICATIONS.map((cert) => [cert.id, cert]));

export const certById = (id: string) => BY_ID.get(id) ?? null;

/** The catalogue name, or the id turned into something readable when the
 *  catalogue has not caught up. */
export function certName(id: string) {
  const known = BY_ID.get(id);
  if (known) return known.name;
  return id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
