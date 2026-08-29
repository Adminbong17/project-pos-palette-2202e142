// Shared date-range presets used across all report/list pages.
// All ranges are computed in the Asia/Dhaka timezone (UTC+6), which is where
// the business operates. Weeks start on Saturday (Bangladesh convention).

export type DatePresetKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "all"
  | "custom";

export const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "all", label: "All" },
  { key: "custom", label: "Custom" },
];

/** Current date in Dhaka as YYYY-MM-DD. */
export function dhakaToday(offsetDays = 0): string {
  const shifted = new Date(Date.now() + (6 * 3600 + offsetDays * 86400) * 1000);
  return shifted.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Start (inclusive) and end (exclusive) of a Dhaka calendar day. */
function dayBounds(dateStr: string): { fromISO: string; toISO: string } {
  return {
    fromISO: `${dateStr}T00:00:00.000+06:00`,
    toISO: `${addDays(dateStr, 1)}T00:00:00.000+06:00`,
  };
}

/** Saturday-start week containing the given Dhaka date. */
function weekBounds(dateStr: string): { fromISO: string; toISO: string } {
  const dow = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay(); // Sun=0 … Sat=6
  const sinceSaturday = (dow + 1) % 7;
  const start = addDays(dateStr, -sinceSaturday);
  return { fromISO: `${start}T00:00:00.000+06:00`, toISO: `${addDays(start, 7)}T00:00:00.000+06:00` };
}

function monthBounds(dateStr: string, offsetMonths = 0): { fromISO: string; toISO: string } {
  const [y, m] = dateStr.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  const next = new Date(Date.UTC(y, m + offsetMonths, 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { fromISO: `${fmt(first)}T00:00:00.000+06:00`, toISO: `${fmt(next)}T00:00:00.000+06:00` };
}

export type PresetRange = { fromISO: string | null; toISO: string | null; label: string };

/** Resolve a preset (+ optional custom dates) to an ISO range. `all` → nulls. */
export function resolvePresetRange(
  preset: DatePresetKey,
  customFrom?: string,
  customTo?: string,
): PresetRange {
  const today = dhakaToday();
  switch (preset) {
    case "today":
      return { ...dayBounds(today), label: "Today" };
    case "yesterday":
      return { ...dayBounds(addDays(today, -1)), label: "Yesterday" };
    case "thisWeek":
      return { ...weekBounds(today), label: "This Week" };
    case "lastWeek": {
      const w = weekBounds(addDays(today, -7));
      return { ...w, label: "Last Week" };
    }
    case "thisMonth":
      return { ...monthBounds(today), label: "This Month" };
    case "lastMonth":
      return { ...monthBounds(today, -1), label: "Last Month" };
    case "all":
      return { fromISO: null, toISO: null, label: "All Time" };
    case "custom": {
      const f = customFrom || today;
      const t = customTo || f;
      return {
        fromISO: `${f}T00:00:00.000+06:00`,
        toISO: `${addDays(t, 1)}T00:00:00.000+06:00`,
        label: `${f} → ${t}`,
      };
    }
  }
}
