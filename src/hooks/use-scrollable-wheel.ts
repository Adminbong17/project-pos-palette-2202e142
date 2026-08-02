import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps mouse-wheel scrolling working inside portaled popovers/dialog lists.
 * Radix's scroll-lock (react-remove-scroll) calls preventDefault on wheel
 * events that originate outside the locked container, which silently kills
 * native scrolling for nested popover lists. We scroll the element ourselves
 * so the wheel always works.
 */
export function useScrollableWheel<T extends HTMLElement>(
  externalRef?: React.Ref<T> | null,
) {
  const innerRef = useRef<T | null>(null);

  const setRef = useCallback(
    (node: T | null) => {
      innerRef.current = node;
      if (typeof externalRef === "function") externalRef(node);
      else if (externalRef && typeof externalRef === "object") {
        (externalRef as React.MutableRefObject<T | null>).current = node;
      }
    },
    [externalRef],
  );

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      if (!dy) return;
      if (el.scrollHeight <= el.clientHeight + 1) return;

      const before = el.scrollTop;
      el.scrollTop = before + dy;
      if (el.scrollTop !== before) e.stopPropagation();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return setRef;
}
