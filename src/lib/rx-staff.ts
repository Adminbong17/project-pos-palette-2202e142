/** Staff accounts sign in with a username; auth needs an email, so we derive one. */
export const STAFF_EMAIL_DOMAIN = "staff.qweekpos.app";

export function normalizeStaffUsername(username: string) {
  return (username ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function staffUsernameToEmail(username: string) {
  return `${normalizeStaffUsername(username)}@${STAFF_EMAIL_DOMAIN}`;
}

/** Turn whatever the user typed on the sign-in form into an email. */
export function loginIdentifierToEmail(identifier: string) {
  const v = (identifier ?? "").trim();
  return v.includes("@") ? v : staffUsernameToEmail(v);
}

export type RxStaff = {
  id: string;
  business_id: string;
  doctor_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  username: string;
  is_active: boolean;
  chamber_id: string | null;
  created_at: string;
};
