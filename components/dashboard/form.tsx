import type * as React from "react";

import { cn } from "@/lib/utils";

// The pieces every form on this dashboard is built from, so a label, a hint and
// a box look the same in every dialog and settings card.
//
// HERE AND NOT IN components/ui, which is careerhop-admin's kit copied verbatim
// (see AGENTS.md). These sit on top of it.
//
// THE DIALOG RULE, because the kit's DialogContent has no padding of its own:
// DialogHeader pads itself, DialogFooter pads itself, and everything between
// them goes inside <DialogBody>. Content dropped straight into DialogContent
// touches the edge of the box.

/** The same look as the kit's <Input>, for the native controls it has no
 *  component for: <select>, <textarea> and date inputs. */
export const controlClass =
  "w-full min-w-0 rounded-md border border-input bg-input/30 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

/** A single-line control: select, date. 36px tall, like <Input> and <Button>. */
export const selectClass = cn(controlClass, "h-9");

/** A filter control in a toolbar — the same box, sized to its content. */
export const filterSelectClass = cn(controlClass, "h-9 w-auto max-w-56");

export const textareaClass = cn(controlClass, "min-h-24 py-2 leading-relaxed");

/** One labelled field: label, the control, then a hint or an error under it. */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Everything between DialogHeader and DialogFooter. Scrolls on its own when it
 *  is taller than the screen, so the header and the buttons stay in view. */
export function DialogBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex max-h-[65vh] flex-col gap-4 overflow-y-auto px-6 pb-6", className)}>
      {children}
    </div>
  );
}

/** A tinted note inside a form — what will happen, or what to check first. */
export function FormNote({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        tone === "muted" && "bg-muted/50 text-muted-foreground",
        tone === "warning" &&
          "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
        tone === "danger" && "border-destructive/30 bg-destructive/5 text-foreground",
      )}
    >
      {children}
    </div>
  );
}
