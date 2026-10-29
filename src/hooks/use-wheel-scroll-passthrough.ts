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

      let node = e.target as HTMLElement | null;
      let depth = 0;
      while (node && node !== el && depth < 25) {
        depth++;
        // Cheap overflow check first — only pay for getComputedStyle on
        // elements that actually have overflowing content.
        if (node.scrollHeight > node.clientHeight + 1) {
          const overflowY = getComputedStyle(node).overflowY;
          if (/(auto|scroll|overlay)/.test(overflowY)) {
            const atTop = node.scrollTop <= 0;
            const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
            if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) return; // inner scroller handles it
          }
        }
        node = node.parentElement;
      }

      if (el.scrollHeight <= el.clientHeight + 1) return;
      el.scrollTop += dy;
      e.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", onWheel, { capture: true } as any);
  }, []);

  return ref;
}
