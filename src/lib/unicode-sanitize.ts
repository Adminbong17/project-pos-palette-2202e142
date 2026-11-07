/**
 * Unicode & External Keyboard Sanitizer
 *
 * Prevents two common issues on Android Chrome with external Bluetooth/2.4GHz
 * keyboards (such as A4Tech FBK27C AS) and Bengali/English IMEs:
 * 1. Null bytes (\u0000), C0/C1 control codes, or unpaired UTF-16 surrogates
 *    ([\uD800-\uDBFF] without [\uDC00-\uDFFF] or vice-versa) getting inserted
 *    during fast typing, Fn/layout switching, or Backspace on multi-unit symbols.
 * 2. PostgreSQL / PostgREST throwing `ERROR: unsupported Unicode escape sequence`
 *    (SQLSTATE 22P05) when a JSON payload contains `\u0000` or lone surrogates.
 */

// Matches null byte and C0/C1 control characters EXCEPT \t (\x09), \n (\x0A), \r (\x0D)
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

// Matches lone/unpaired UTF-16 high or low surrogates
const LONE_SURROGATE_RE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

// Matches literal `\u0000` or unpaired `\ud800`..`\udfff` inside serialized JSON strings
const JSON_NULL_ESCAPE_RE = /(?<!\\)\\u0000/gi;
const JSON_LONE_SURROGATE_ESCAPE_RE =
  /(?<!\\)\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f][0-9a-f]{2})|(?<!\\ud[89ab][0-9a-f]{2})(?<!\\)\\ud[c-f][0-9a-f]{2}/gi;

/**
 * Live sanitizer safe to run on every keystroke without disturbing
 * trailing spaces or active Bengali combining marks (কার, হসন্ত, ফলা).
 */
export function sanitizeUnicodeLive(input: string): string {
  if (!input) return "";
  return input.replace(CONTROL_CHARS_RE, "").replace(LONE_SURROGATE_RE, "");
}

/**
 * Full text sanitizer for saving/storing: removes null/control chars and
 * unpaired surrogates, and normalizes Unicode to canonical NFC form.
 */
export function sanitizeUnicodeText(input: string | null | undefined): string {
  if (input == null) return "";
  const cleaned = sanitizeUnicodeLive(String(input));
  try {
    return cleaned.normalize("NFC");
  } catch {
    return cleaned;
  }
}

/**
 * Recursively sanitizes all string fields in an object, array, or primitive
 * before persisting to Supabase/PostgreSQL or localStorage.
 */
export function sanitizePayloadDeep<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeUnicodeText(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayloadDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[sanitizeUnicodeText(k)] = sanitizePayloadDeep(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Sanitizes a serialized JSON request body string right before network transmission
 * so PostgreSQL/PostgREST never rejects the request with `unsupported Unicode escape sequence`.
 */
export function sanitizeJsonBodyString(body: string): string {
  if (!body) return body;
  return body
    .replace(CONTROL_CHARS_RE, "")
    .replace(LONE_SURROGATE_RE, "")
    .replace(JSON_NULL_ESCAPE_RE, "")
    .replace(JSON_LONE_SURROGATE_ESCAPE_RE, "");
}
