import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="group flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/60 px-2.5 py-2 text-xs font-semibold text-sidebar-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      <span className="relative grid h-6 w-6 place-items-center overflow-hidden rounded-lg bg-primary/15 text-primary transition-transform duration-300 group-hover:rotate-12">
        {dark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
      <span className="flex-1 text-left">{dark ? "Dark mode" : "Light mode"}</span>
      <span
        className={`relative h-4 w-8 shrink-0 rounded-full transition-colors duration-300 ${
          dark ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-background shadow transition-all duration-300 ${
            dark ? "left-[1.125rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
