# gig-app-admin

The staff dashboard for AdHoc — the decisions in this platform that a machine
cannot make.

There are four of them, and each one is a queue worked **oldest first**, because
in every case somebody is waiting on us:

| Queue | The decision | Who is blocked while it waits |
| --- | --- | --- |
| **Certifications** | Is this document real, current and the holder's own? | The candidate, who cannot apply for the roles it gates |
| **Appeals** | Does this MC actually cover the date of the shift? | The candidate, whose rating is dropping over it |
| **Employers** | Does this person really work for this business? | The employer, for whom the product does nothing until the call is made |
| **Invoices** | Did this transfer actually arrive? | The employer, whose coins do not exist until somebody says so |

Plus one thing that is not a queue: **Placement config**, the three coin numbers
that price the platform.

## Running it

```bash
cp .env.example .env.local   # fill in the Supabase project and the API URL
npm install
npm run dev                  # http://localhost:3003
```

`gig-app-api` has to be running too — everything on screen comes from it.

## Signing in

There is no sign-up and no admin login endpoint. This dashboard authenticates
against the **same Supabase project as the mobile app**, then asks the API who
the token belongs to:

1. `supabase.auth.signInWithPassword` — Supabase says who this is.
2. `GET /profile` — the API says whether they are staff.

Both have to pass. Every account in the app authenticates against that same
project, so a candidate's password works perfectly well at step one and must
still not open this dashboard.

**Becoming an admin is a database statement**, not a screen. `handle_new_user()`
writes `candidate` or `employer` and has no branch that produces `admin`, so the
only way in is:

```sql
update public.users u
   set role = 'admin'
  from auth.users a
 where a.id = u.id
   and a.email = 'you@example.com';
```

The role is read off our own users row on **every request**, not from the token
— so removing somebody's admin takes effect immediately rather than when their
JWT expires.

## What talks to what

```
  browser ──sign in──▶ Supabase          (identity, and nothing else)
     │
     └──Bearer JWT──▶ gig-app-api /admin/*   (every gate, every decision)
```

No cookies. The access token comes from the Supabase client, which refreshes it
on its own; `lib/api.ts` attaches it and treats a surviving 401 **or a 403** as a
finished session — a 403 is usually an account whose admin has just been taken
away, and it should land on the login screen rather than on an empty table.

## Design

The design system is careerhop-admin's, copied rather than reimplemented:
`components/ui/*`, `app/globals.css`, the sidebar shell and the login layout are
the same files. What changed is the brand — the AdHoc mark from
`gig-app/assets`, on its own navy (`#103572`, sampled from the app icon) so the
white pig is visible against a light sidebar.

Keep it that way. If a shadcn component needs updating, take it from
careerhop-admin rather than editing it here, so the two dashboards do not drift
into looking like two products.

## Contracts

`lib/certificates.ts`, `lib/appeals.ts`, `lib/employers.ts`, `lib/candidates.ts`,
`lib/invoices.ts` and `lib/settings.ts` mirror `src/contract/admin.ts` in
gig-app-api. The repos share no package, so **these are copies and they can
drift** — change one, change the other.

Two catalogues are mirrored the same way and for the same reason: the API sends
an id (`food-hygiene`, `mc`) and never a display name, because the catalogue
ships in the mobile app and two copies of it is one that goes stale. This is the
third copy, and it exists only so a reviewer sees "WSQ Food Safety Course Level
1, issued by SkillsFuture" instead of a slug. An unknown id degrades to a
title-cased version of itself rather than to a blank cell.

## What is deliberately not here

- **A candidate detail page.** The directory is for support — finding the person
  who wrote in. Their certificates are in the certificate queue, attached to a
  decision that needs them; a directory that carried them would be a database
  export with a search box.
- **Anything that edits a candidate.** `/admin/candidates` is read-only on the
  API too.
- **Coin ledger and balances.** Worth building, not built.

## Known gap

**Nothing files an appeal yet.** The `appeals` table and its `AppealOutcome` are
in the schema, and this queue reads and decides them — but gig-app-api has no
candidate-side route that creates one, so in a fresh database the queue is empty
because nothing can reach it, not because there is nothing to do.

Related: deciding an appeal records the outcome and does **not** move a rating.
No code applies a late-cancellation penalty anywhere yet. When that is built it
belongs in the sweep that closes the appeal window, keyed on this outcome — see
the note in `appeals.controller.ts` in the API.
