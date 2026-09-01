<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Two things particular to this repo

**The UI kit is a copy, not a fork.** `components/ui/*`, `app/globals.css` and
the sidebar shell come from careerhop-admin verbatim. Update them by copying
from there again, not by editing here — the two dashboards are meant to look
like one product.

**The lib/ types are copies of gig-app-api's `src/contract/admin.ts`.** The
repos share no package. Changing a shape on one side means changing it on the
other, by hand, or the drift shows up as a runtime `undefined` rather than a
type error.
