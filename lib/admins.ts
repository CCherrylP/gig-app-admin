import { fetchWithAuth } from "./api";

// Staff accounts for this dashboard: GET, POST and DELETE /admin/admins.

export interface AdminAccount {
  id: string;
  name: string | null;
  /** The login. It does not need to be a real inbox. */
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  hasTwoFactor: boolean;
  isYou: boolean;
}

export interface NewAdmin {
  name: string;
  email: string;
  password: string;
}

export function listAdmins() {
  return fetchWithAuth<{ admins: AdminAccount[] }>("/admin/admins");
}

export function createAdmin(admin: NewAdmin) {
  return fetchWithAuth<AdminAccount>("/admin/admins", {
    method: "POST",
    body: JSON.stringify(admin),
  });
}

export function removeAdmin(userId: string) {
  return fetchWithAuth<{ removed: true }>(`/admin/admins/${userId}`, { method: "DELETE" });
}

/** The API's password rule, so the form can say it before sending. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (!/[A-Za-z]/.test(password)) return "Add at least one letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  return null;
}
