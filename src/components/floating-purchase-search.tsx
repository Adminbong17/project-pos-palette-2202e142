import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type FloatingPurchaseSearchProps = {
  children: ReactNode;
};

export function FloatingPurchaseSearch({ children }: FloatingPurchaseSearchProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <div className="h-[60px]" aria-hidden="true" />
      {mounted
        ? createPortal(
            <div className="fixed left-3 right-3 top-14 z-50 rounded-b-lg border border-border/60 bg-card px-3 py-3 shadow-lg md:left-1/4 md:right-1/4">
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}