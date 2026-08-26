import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type CardCtx = {
  foldable: boolean;
  collapsed: boolean;
  toggle: () => void;
};

const CardContext = React.createContext<CardCtx | null>(null);

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Show the fold / unfold button in the header (default: true). */
  foldable?: boolean;
  /** Start folded. */
  defaultCollapsed?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, foldable = true, defaultCollapsed = false, ...props }, ref) => {
    const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
    const ctx = React.useMemo<CardCtx>(
      () => ({ foldable, collapsed, toggle: () => setCollapsed((v) => !v) }),
      [foldable, collapsed],
    );
    return (
      <CardContext.Provider value={ctx}>
        <div
          ref={ref}
          data-collapsed={collapsed ? "true" : undefined}
          className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
          {...props}
        />
      </CardContext.Provider>
    );
  },
);
Card.displayName = "Card";


const CardHeaderImpl = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(CardContext);
    const show = !!ctx?.foldable;
    return (
      <div
        ref={ref}
        className={cn("relative flex flex-col space-y-1.5 p-6", show && "pr-12", className)}
        {...props}
      >
        {children}
        {show && (
          <button
            type="button"
            onClick={ctx!.toggle}
            aria-expanded={!ctx!.collapsed}
            aria-label={ctx!.collapsed ? "Open section" : "Fold section"}
            title={ctx!.collapsed ? "Open" : "Fold"}
            className="print:hidden absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                ctx!.collapsed && "-rotate-90",
              )}
            />
          </button>
        )}
      </div>
    );
  },
);
CardHeaderImpl.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const ctx = React.useContext(CardContext);
    if (ctx?.collapsed) return null;
    return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
  },
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const ctx = React.useContext(CardContext);
    if (ctx?.collapsed) return null;
    return <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />;
  },
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeaderImpl as CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
