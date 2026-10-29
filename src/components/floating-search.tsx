import type { ReactNode } from "react";

type FloatingSearchProps = {
  children: ReactNode;
  /** Optional result list rendered directly under the input */
  results?: ReactNode;
  /** Height spacer kept for API compatibility */
  spacer?: number;
  className?: string;
};

/**
 * Lightweight, rock-solid search bar container.
 * Eliminates all ResizeObserver layout thrashing, scroll capture loops,
 * and DOM portal flapping that caused browser unresponsiveness.
 */
export function FloatingSearch({ children, results, className = "" }: FloatingSearchProps) {
  return (
    <div className={`relative w-full ${className}`}>
      {children}
      {results}
    </div>
  );
}
