import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "ci-input flex h-10 w-full rounded-xl border border-input/80 bg-card/45 px-3.5 py-2 text-base shadow-[inset_0_1px_0_hsl(var(--foreground)/0.025)] backdrop-blur-lg transition-all placeholder:text-muted-foreground/75 hover:border-border focus-visible:border-[hsl(var(--brand-accent)/0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--brand-accent)/0.1)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
