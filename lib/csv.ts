/** Prefixes ' to text a spreadsheet would run as a formula. Plain numbers like -5.00 are left alone. */
export function defuseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) && Number.isNaN(Number(value)) ? `'${value}` : value;
}

/** One quoted CSV cell, safe to open in Excel or Sheets. */
export function csvCell(value: string | number | null | undefined): string {
  return `"${defuseFormula(String(value ?? "")).replace(/"/g, '""')}"`;
}
