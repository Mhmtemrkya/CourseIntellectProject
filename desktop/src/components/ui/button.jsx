import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "ci-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[hsl(var(--brand-accent)/0.38)] bg-gradient-to-r from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-accent)/0.82)] text-white shadow-[0_10px_28px_hsl(var(--brand-accent)/0.18)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_hsl(var(--brand-accent)/0.28)]",
        destructive:
          "border border-destructive/35 bg-destructive text-destructive-foreground shadow-[0_10px_24px_hsl(var(--destructive)/0.18)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline:
          "border border-border/80 bg-card/55 text-foreground shadow-sm backdrop-blur-xl hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.35)] hover:bg-[hsl(var(--brand-accent)/0.08)]",
        secondary:
          "border border-border/60 bg-secondary/75 text-secondary-foreground shadow-sm hover:bg-secondary",
        ghost: "text-muted-foreground hover:bg-[hsl(var(--brand-accent)/0.09)] hover:text-foreground",
        link: "text-[hsl(var(--brand-accent))] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-7",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
