import * as React from "react";
import { cn } from "@/lib/utils";

const NumericInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, onWheel, ...props }, ref) => {
    // Prevent scroll from changing value
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      e.currentTarget.blur();
      onWheel?.(e);
    };

    return (
      <input
        type="number"
        onWheel={handleWheel}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          // Hide spinners (arrows)
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
