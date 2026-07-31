import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type ComboOption = { id: string; name: string; removable?: boolean };

const MAX_RESULTS = 60;

/**
 * Searchable list of saved options with an inline "Add “…”" action so a doctor
 * can build their own personal list while writing a prescription.
 * Mobile opens a full-width sheet with big tap targets; desktop uses a popover.
 */
export function RxPresetCombo({
  options,
  placeholder,
  triggerLabel,
  triggerVariant = "outline",
  onPick,
  onAdd,
  onRemove,
  className,
  width = 340,
}: {
  options: ComboOption[];
  placeholder?: string;
  triggerLabel: string;
  triggerVariant?: "outline" | "ghost";
  onPick: (name: string) => void;
  onAdd?: (name: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
  width?: number;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = q.trim();

  const matches = useMemo(() => {
    const s = query.toLowerCase();
    if (!s) return options;
    const starts: ComboOption[] = [];
    const rest: ComboOption[] = [];
    for (const o of options) {
      const n = o.name.toLowerCase();
      const i = n.indexOf(s);
      if (i === 0) starts.push(o);
      else if (i > 0) rest.push(o);
    }
    return [...starts, ...rest];
  }, [options, query]);

  const filtered = matches.slice(0, MAX_RESULTS);
  const hidden = matches.length - filtered.length;
  const exists = options.some((o) => o.name.toLowerCase() === query.toLowerCase());

  const pick = (name: string, isNew: boolean) => {
    if (isNew && onAdd) onAdd(name);
    onPick(name);
    setQ("");
    setOpen(false);
  };

  const body = (
    <Command shouldFilter={false} className="bg-transparent">
      <div className="relative">
        <CommandInput
          placeholder={placeholder ?? "Search or type…"}
          value={q}
          onValueChange={setQ}
          className={isMobile ? "h-12 text-base" : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query && !exists && filtered.length === 0 && onAdd) {
              e.preventDefault();
              pick(query, true);
            }
          }}
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            onClick={() => setQ("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <CommandList className={isMobile ? "max-h-[58vh]" : "max-h-[52vh]"}>
        {query && !exists && onAdd && (
          <CommandGroup>
            <CommandItem
              value={`__add_${query}`}
              onSelect={() => pick(query, true)}
              className={isMobile ? "py-3 text-base" : undefined}
            >
              <Plus className="mr-2 h-4 w-4" /> Add “{query}” to my list
            </CommandItem>
          </CommandGroup>
        )}
        {filtered.length === 0 && (!query || exists || !onAdd) && (
          <CommandEmpty>Nothing found.</CommandEmpty>
        )}
        <CommandGroup heading={options.length > 0 ? `${matches.length} option${matches.length === 1 ? "" : "s"}` : undefined}>
          {filtered.map((o) => (
            <CommandItem
              key={o.id}
              value={o.id}
              onSelect={() => pick(o.name, false)}
              className={`group justify-between ${isMobile ? "py-3 text-base" : ""}`}
            >
              <span className="truncate">{o.name}</span>
              {o.removable && onRemove && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Remove"
                  className={`ml-2 shrink-0 p-1 ${isMobile ? "opacity-70" : "opacity-0 group-hover:opacity-100"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(o.id);
                  }}
                >
                  <X className="h-4 w-4 text-destructive" />
                </span>
              )}
            </CommandItem>
          ))}
          {hidden > 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              +{hidden} more — keep typing to narrow down
            </div>
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const trigger = (
    <Button type="button" size="sm" variant={triggerVariant} className={className} role="combobox">
      <span className="truncate">{triggerLabel}</span>
      <Search className="ml-2 h-4 w-4 opacity-60" />
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <span onClick={() => setOpen(true)} className="contents">
          {trigger}
        </span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="top-4 max-w-[96vw] translate-y-0 gap-0 p-0 sm:max-w-md">
            <DialogHeader className="px-4 pt-4">
              <DialogTitle className="text-base">{triggerLabel}</DialogTitle>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="p-0" style={{ width }} align="end">
        {body}
      </PopoverContent>
    </Popover>
  );
}
