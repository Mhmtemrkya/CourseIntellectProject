import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[7px] border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.05em] transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-accent)/0.4)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[hsl(var(--brand-accent)/0.25)] bg-[hsl(var(--brand-accent)/0.13)] text-[hsl(var(--brand-accent))] shadow-sm",
        secondary:
          "border-border/60 bg-secondary/70 text-secondary-foreground hover:bg-secondary",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "border-border/75 bg-card/35 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
