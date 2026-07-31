import type { ReactNode } from "react";
import { FloatingSearch } from "@/components/floating-search";

type FloatingPurchaseSearchProps = {
  children: ReactNode;
  results?: ReactNode;
};

/** Thin wrapper kept for the purchase pages — same behaviour as FloatingSearch. */
export function FloatingPurchaseSearch({ children, results }: FloatingPurchaseSearchProps) {
  return (
    <FloatingSearch spacer={60} results={results} className="max-w-[calc(100vw-24px)]">
      {children}
    </FloatingSearch>
  );
}
