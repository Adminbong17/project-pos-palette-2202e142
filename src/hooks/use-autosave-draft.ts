import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

const PREFIX = "draft:";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3; // keep drafts for 3 days

type Options<T> = {
  /** Skip autosave entirely (e.g. form not open yet). */
  enabled?: boolean;
  /** Return true when there is nothing worth saving. */
  isEmpty?: (data: T) => boolean;
  /** Message shown when a draft is recovered. */
  restoreMessage?: string;
};

/**
 * Keeps in-progress form data in localStorage so an unexpected power cut /
 * browser crash / accidental tab close does not lose the work.
 *
 * - writes are debounced (300ms) and also flushed on pagehide / tab hide
 * - the draft is restored automatically the next time the form mounts
 * - call clearDraft() after a successful save
 */
export function useAutosaveDraft<T>(
  key: string | null,
  data: T,
  restore: (data: T) => void,
  options: Options<T> = {},
) {
  const { enabled = true, isEmpty, restoreMessage = "Unsaved work restored" } = options;

  const storageKey = key ? PREFIX + key : null;
  const dataRef = useRef(data);
  dataRef.current = data;
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const isEmptyRef = useRef(isEmpty);
  isEmptyRef.current = isEmpty;
  const readyRef = useRef(false);
  const restoredForKey = useRef<string | null>(null);

  const clearDraft = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const flush = useCallback(() => {
    if (!storageKey || typeof window === "undefined" || !readyRef.current) return;
    try {
      const current = dataRef.current;
      if (isEmptyRef.current?.(current)) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ at: Date.now(), data: current }),
      );
    } catch {
      /* quota / private mode — ignore */
    }
  }, [storageKey]);

  // Restore once per key
  useEffect(() => {
    if (!storageKey || !enabled || typeof window === "undefined") return;
    if (restoredForKey.current === storageKey) return;
    restoredForKey.current = storageKey;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { at?: number; data?: T };
        if (parsed?.data !== undefined && Date.now() - (parsed.at ?? 0) < MAX_AGE_MS) {
          restoreRef.current(parsed.data);
          toast.info(restoreMessage);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      }
    } catch {
      /* ignore corrupt draft */
    }
    readyRef.current = true;
  }, [storageKey, enabled, restoreMessage]);

  // Debounced persist on every change
  useEffect(() => {
    if (!storageKey || !enabled || !readyRef.current) return;
    const t = setTimeout(flush, 300);
    return () => clearTimeout(t);
  }, [storageKey, enabled, flush, data]);

  // Flush immediately when the tab is hidden / closed
  useEffect(() => {
    if (!storageKey || !enabled || typeof window === "undefined") return;
    const onHide = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [storageKey, enabled, flush]);

  return { clearDraft, flush };
}
