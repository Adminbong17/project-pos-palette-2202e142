import { useState, type ReactNode, type TableHTMLAttributes } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Plain <table> replacement that can be minimised (folded) with a chevron
 * button, the same way the shadcn <Table> component can. Printing always shows
 * the full table.
 */
export function FoldTable({
  children,
  foldable = true,
  defaultCollapsed = false,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & {
  children?: ReactNode;
  foldable?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const open = !foldable || !collapsed;

  return (
    <>
      {foldable && (
        <div className="flex justify-end px-2 py-1 print:hidden">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Minimise table" : "Expand table"}
            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-foreground/80 hover:bg-muted"
          >
            {open ? (
              <>
                Minimise <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Expand <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      )}
      <table {...props} className={`${props.className ?? ""} ${open ? "" : "hidden print:table"}`}>
        {children}
      </table>
    </>
  );
}
