import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "ci-input flex h-9 w-full rounded-[8px] border border-foreground/[0.10] bg-[hsl(var(--ci-field)/0.8)] px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-lg transition-all placeholder:text-muted-foreground/75 hover:border-[hsl(var(--brand-accent)/0.28)] focus-visible:border-[hsl(var(--brand-accent)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent)/0.14)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
