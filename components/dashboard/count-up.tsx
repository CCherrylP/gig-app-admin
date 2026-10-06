"use client";

import * as React from "react";

// A number that runs up to its value instead of appearing.
//
// Only on Home, and only for counts — never money. A total somebody is about to
// type into a bank must be the real figure the instant it is on screen, not one
// that is still on its way there.

const DURATION_MS = 700;

/** Eases from the last value shown to `target`. Jumps straight there for anyone
 *  who has asked their system for less motion. */
export function useCountUp(target: number) {
  const [shown, setShown] = React.useState(0);
  const from = React.useRef(0);

  React.useEffect(() => {
    const start = from.current;
    if (start === target) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    const began = performance.now();

    const step = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - began) / DURATION_MS);
      // ease-out cubic: quick to start, settles gently on the figure
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(start + (target - start) * eased);
      setShown(value);
      from.current = value;
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

export function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}
