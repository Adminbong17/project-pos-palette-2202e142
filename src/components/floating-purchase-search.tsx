import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type FloatingPurchaseSearchProps = {
  children: ReactNode;
};

const HEADER_OFFSET = 56; // top-14

export function FloatingPurchaseSearch({ children }: FloatingPurchaseSearchProps) {
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const [floating, setFloating] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox({ left: rect.left, width: rect.width });
      setFloating(rect.top < HEADER_OFFSET);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [mounted]);

  const isFloating = mounted && floating;

  return (
    <>
      <div
        ref={anchorRef}
        className="w-full"
        style={isFloating ? { height: 60 } : undefined}
        aria-hidden={isFloating ? "true" : undefined}
      >
        {isFloating ? null : children}
      </div>
      {isFloating
        ? createPortal(
            <div
              className="fixed top-14 z-50 rounded-b-lg border border-border/60 bg-card px-3 py-3 shadow-lg"
              style={
                box && box.width >= 200
                  ? { left: box.left, width: box.width }
                  : { left: 12, right: 12 }
              }
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
