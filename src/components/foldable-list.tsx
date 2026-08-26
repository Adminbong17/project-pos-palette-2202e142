import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Long comma-lists inside table cells (invoice numbers, businesses, roles,
 * sale lines) blow up row height. Show a few items with a chevron fold/unfold
 * button; print always shows everything.
 */
export function FoldableList({
  items,
  collapsedCount = 3,
  separator = ", ",
  className,
  emptyText = "—",
}: {
  items: (string | number)[];
  collapsedCount?: number;
  separator?: string;
  className?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const list = (items ?? []).filter((i) => i !== null && i !== undefined && i !== "");
  if (list.length === 0) return <span className={className}>{emptyText}</span>;

  const foldable = list.length > collapsedCount;
  const shown = open || !foldable ? list : list.slice(0, collapsedCount);
  const hidden = list.length - shown.length;

  return (
    <span className={className}>
      <span className="print:!inline">{shown.join(separator)}</span>
      {foldable && !open && (
        <span className="hidden print:inline">
          {separator}
          {list.slice(collapsedCount).join(separator)}
        </span>
      )}
      {foldable && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-1 inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 align-middle text-[10px] font-medium text-foreground/80 hover:bg-muted print:hidden"
        >
          {open ? (
            <>
              Less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              +{hidden} more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </span>
  );
}
