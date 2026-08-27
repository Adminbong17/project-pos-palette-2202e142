// Lab report signing defaults, shared between the Lab pages.
// Kept in localStorage so choosing a technologist / pathologist and the "own pad"
// setting on the Signatures & Pad page carries over to the report page.

export type LabPrefs = {
  techName: string;
  techDesignation: string;
  pathologistName: string;
  pathologistDesignation: string;
  ownPad: boolean;
};

const KEY = "lab-report-prefs";

export const EMPTY_LAB_PREFS: LabPrefs = {
  techName: "",
  techDesignation: "",
  pathologistName: "",
  pathologistDesignation: "",
  ownPad: false,
};

export function loadLabPrefs(): LabPrefs {
  if (typeof window === "undefined") return EMPTY_LAB_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_LAB_PREFS;
    return { ...EMPTY_LAB_PREFS, ...(JSON.parse(raw) as Partial<LabPrefs>) };
  } catch {
    return EMPTY_LAB_PREFS;
  }
}

export function saveLabPrefs(prefs: LabPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked — ignore */
  }
}
