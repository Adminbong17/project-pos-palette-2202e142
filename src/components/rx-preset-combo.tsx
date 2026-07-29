import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type ComboOption = { id: string; name: string; removable?: boolean };

/**
 * Searchable list of saved options with an inline "Add “…”" action so a doctor
 * can build their own personal list while writing a prescription.
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
  width = 320,
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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = q.trim();
  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;
  const exists = options.some((o) => o.name.toLowerCase() === query.toLowerCase());

  const pick = (name: string, isNew: boolean) => {
    if (isNew && onAdd) onAdd(name);
    onPick(name);
    setQ("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={triggerVariant}
          className={className}
          role="combobox"
        >
          <span className="truncate">{triggerLabel}</span>
          <Search className="ml-2 h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width }} align="end">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder ?? "Search or type…"} value={q} onValueChange={setQ} />
          <CommandList>
            {query && !exists && onAdd && (
              <CommandGroup>
                <CommandItem value={`__add_${query}`} onSelect={() => pick(query, true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add “{query}” to my list
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length === 0 && (!query || exists || !onAdd) && (
              <CommandEmpty>Nothing saved yet.</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  onSelect={() => pick(o.name, false)}
                  className="group justify-between"
                >
                  <span className="truncate">{o.name}</span>
                  {o.removable && onRemove && (
                    <span
                      role="button"
                      tabIndex={-1}
                      className="ml-2 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(o.id);
                      }}
                    >
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
