import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// useSyncExternalStore rather than the shadcn default, which sets state inside
// an effect to read the initial width. That pattern renders once with the wrong
// answer and then again with the right one — a cascading render React's lint
// rules now reject — and on this app it meant the sidebar mounted expanded on a
// phone for a frame before collapsing.
//
// The server snapshot is `false`: there is no viewport during prerender, and a
// desktop-shaped first paint is the one that does not shift when the real width
// arrives on hydration.

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
