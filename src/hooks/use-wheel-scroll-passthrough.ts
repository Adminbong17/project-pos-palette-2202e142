import { useEffect, useRef } from "react";

/**
 * Makes mouse-wheel scrolling work anywhere inside a scrollable container —
 * even when the cursor is over a textarea, input, or a nested list that would
 * otherwise swallow the wheel event. Inner scrollers still scroll themselves
 * until they hit their edge, then the outer container takes over.
 */
export function useWheelScrollPassthrough<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      if (!dy) return;

      const target = e.target as HTMLElement | null;
      if (target && target !== el) {
        if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
          const atTop = target.scrollTop <= 0;
          const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1;
          if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) return;
        }
      }

      if (el.scrollHeight <= el.clientHeight + 1) return;
      el.scrollTop += dy;
    };

    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return ref;
}
