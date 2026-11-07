import * as React from "react";

import { cn } from "@/lib/utils";
import { sanitizeUnicodeLive } from "@/lib/unicode-sanitize";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, onChange, onCompositionStart, onCompositionEnd, onBlur, ...props }, ref) => {
    const isControlled = value !== undefined && !props.readOnly && type !== "file";
    const [isComposing, setIsComposing] = React.useState(false);
    const [composingValue, setComposingValue] = React.useState(() =>
      isControlled ? sanitizeUnicodeLive(String(value ?? "")) : "",
    );
    const isComposingRef = React.useRef(false);

    const emitSanitizedChange = React.useCallback(
      (target: HTMLInputElement) => {
        if (!onChange) return;
        const cleaned = sanitizeUnicodeLive(target.value);
        if (target.value !== cleaned) {
          try {
            target.value = cleaned;
          } catch {
            /* ignore read-only DOM value assignment */
          }
        }
        const syntheticEvent = {
          target,
          currentTarget: target,
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      },
      [onChange],
    );

    const LastEmittedRef = React.useRef<string | null>(null);

    const handleCompositionStart = (e: React.CompositionEvent<HTMLInputElement>) => {
      if (isControlled) {
        isComposingRef.current = true;
        setIsComposing(true);
        setComposingValue(sanitizeUnicodeLive(e.currentTarget.value));
      }
      onCompositionStart?.(e);
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
      if (isControlled) {
        isComposingRef.current = false;
        setIsComposing(false);
        const cleaned = sanitizeUnicodeLive(e.currentTarget.value);
        setComposingValue(cleaned);
        if (LastEmittedRef.current !== cleaned) {
          LastEmittedRef.current = cleaned;
          emitSanitizedChange(e.currentTarget);
        }
      }
      onCompositionEnd?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (type !== "file" && typeof e.target.value === "string") {
        const cleaned = sanitizeUnicodeLive(e.target.value);
        if (e.target.value !== cleaned && !isComposingRef.current) {
          try {
            e.target.value = cleaned;
          } catch {
            /* ignore */
          }
        }
        if (isControlled) {
          setComposingValue(cleaned);
          LastEmittedRef.current = cleaned;
        }
      }
      onChange?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isControlled && isComposingRef.current) {
        isComposingRef.current = false;
        setIsComposing(false);
        emitSanitizedChange(e.currentTarget);
      }
      onBlur?.(e);
    };

    const resolvedValue = isControlled
      ? isComposing
        ? composingValue
        : typeof value === "string"
          ? sanitizeUnicodeLive(value)
          : value
      : value;

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...(value !== undefined ? { value: resolvedValue } : {})}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
