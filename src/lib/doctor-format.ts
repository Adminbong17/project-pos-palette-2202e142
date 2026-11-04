/**
 * Formatting and deduplication utilities for Doctor identity, titles, and clinic headers.
 */

/**
 * Cleanly formats a doctor's name with a single "Dr." or "Prof." prefix.
 * Prevents double prefixes like "Dr. Dr MEHEDI HASAN", "Dr Dr", or "Dr. Dr.".
 */
export function formatDoctorDisplayName(rawName?: string | null): string {
  if (!rawName || !rawName.trim()) return "";
  let name = rawName.trim();

  // Strip duplicate leading Doctor/Dr/Prof markers if repeated (e.g. "Dr. Dr MEHEDI HASAN", "Dr Dr", "Dr. Dr.")
  while (
    /^(dr\.?|doctor|prof(?:essor)?\.?|ডাঃ|ডাক্তার)\s+(dr\.?|doctor|prof(?:essor)?\.?|ডাঃ|ডাক্তার)\s+/i.test(
      name,
    )
  ) {
    name = name
      .replace(/^(dr\.?|doctor|prof(?:essor)?\.?|ডাঃ|ডাক্তার)\s+/i, "")
      .trim();
  }

  // If it starts with Bengali prefixes "ডাঃ" or "ডাক্তার", preserve it
  if (/^(ডাঃ|ডাক্তার)\s*/i.test(name)) {
    return name;
  }

  // If it starts with Prof / Professor
  if (/^prof(?:essor)?\.?\s+/i.test(name)) {
    return name;
  }

  // If it starts with "Dr." (with dot)
  if (/^dr\.\s*/i.test(name)) {
    return "Dr. " + name.replace(/^dr\.\s*/i, "").trim();
  }

  // If it starts with "Dr " without dot (e.g. "Dr MEHEDI HASAN")
  if (/^dr\s+/i.test(name)) {
    return "Dr. " + name.replace(/^dr\s+/i, "").trim();
  }

  // If it starts with "Doctor "
  if (/^doctor\s+/i.test(name)) {
    return "Dr. " + name.replace(/^doctor\s+/i, "").trim();
  }

  // Otherwise, prepend "Dr. "
  return `Dr. ${name}`;
}

/**
 * Normalizes a name string for equality / substring comparison.
 */
function normalizeForComparison(s?: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/^(prof(?:essor)?\.?|dr\.?|doctor|ডাঃ|ডাক্তার)\s+/i, "")
    .replace(/chamber|clinic|chember|চেম্বার|ক্লিনিক/gi, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

/**
 * Checks whether a clinic name should be printed above the doctor's name on a prescription.
 * Returns false if the clinic name is just the doctor's own name (e.g. "Dr MEHEDI HASAN").
 */
export function shouldShowClinicHeader(
  clinicName?: string | null,
  doctorName?: string | null,
): boolean {
  if (!clinicName || !clinicName.trim()) return false;
  if (!doctorName || !doctorName.trim()) return true;

  const cNorm = normalizeForComparison(clinicName);
  const dNorm = normalizeForComparison(doctorName);

  if (!cNorm) return false;
  // If identical when stripped of Dr/titles/chamber
  if (cNorm === dNorm) return false;
  // If one contains the other and length >= 3
  if (cNorm.length >= 3 && dNorm.length >= 3) {
    if (cNorm.includes(dNorm) || dNorm.includes(cNorm)) return false;
  }
  return true;
}

export interface DoctorProfileDetails {
  degree: string;
  designation: string;
}

/**
 * Splits a raw qualification string into separate Degree and Designation.
 * Supports multi-line input or common delimiters like " — ", " | ", or "//".
 */
export function splitDoctorQualification(raw?: string | null): DoctorProfileDetails {
  if (!raw || !raw.trim()) return { degree: "", designation: "" };
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { degree: "", designation: "" };
  if (lines.length === 1) {
    const sepMatch = lines[0].match(/^(.*?)\s*(?:—|–|\||\/\/)\s*(.*)$/);
    if (sepMatch && sepMatch[1] && sepMatch[2]) {
      return { degree: sepMatch[1].trim(), designation: sepMatch[2].trim() };
    }
    return { degree: lines[0], designation: "" };
  }
  return {
    degree: lines[0],
    designation: lines.slice(1).join("\n"),
  };
}

/**
 * Combines Degree and Designation into a single string formatted cleanly.
 */
export function combineDoctorQualification(degree?: string | null, designation?: string | null): string {
  const d = (degree ?? "").trim();
  const des = (designation ?? "").trim();
  if (d && des) return `${d}\n${des}`;
  return d || des || "";
}
