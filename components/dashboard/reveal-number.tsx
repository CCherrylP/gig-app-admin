"use client";

import { useState } from "react";

// A payout number shown masked by default and revealed per row on click, so a screen of accounts is not exposed all at once while a single number can still be read to pay someone.
export function RevealNumber({ value }: { value: string | null | undefined }) {
  const [shown, setShown] = useState(false);

  if (!value) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  // The last four only until revealed, which is enough to recognise a row.
  const masked = `••••${value.slice(-4)}`;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`truncate font-mono text-xs ${shown ? "select-all" : ""}`}>
        {shown ? value : masked}
      </span>
      <button
        type="button"
        aria-label={shown ? "Hide number" : "Show full number"}
        // stopPropagation, or revealing a number also toggles the row it sits in.
        onClick={(event) => {
          event.stopPropagation();
          setShown((previous) => !previous);
        }}
        className="text-[11px] text-muted-foreground underline hover:text-foreground"
      >
        {shown ? "Hide" : "Show"}
      </button>
    </span>
  );
}
