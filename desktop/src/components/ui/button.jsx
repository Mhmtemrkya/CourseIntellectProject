import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "ci-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-xs font-bold uppercase tracking-[0.02em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[hsl(var(--brand-accent)/0.58)] bg-[hsl(var(--brand-accent))] text-white shadow-[0_0_22px_hsl(var(--brand-accent)/0.22)] hover:-translate-y-0.5 hover:bg-[hsl(var(--brand-accent-hover))] hover:shadow-[0_0_30px_hsl(var(--brand-accent)/0.34)]",
        destructive:
          "border border-destructive/35 bg-destructive text-destructive-foreground shadow-[0_10px_24px_hsl(var(--destructive)/0.18)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline:
          "border border-foreground/[0.10] bg-[#071B33]/70 text-foreground shadow-sm backdrop-blur-xl hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.45)] hover:bg-[hsl(var(--brand-accent)/0.10)]",
        secondary:
          "border border-border/60 bg-secondary/75 text-secondary-foreground shadow-sm hover:bg-secondary",
        ghost: "text-muted-foreground hover:bg-[hsl(var(--brand-accent)/0.09)] hover:text-foreground",
        link: "text-[hsl(var(--brand-accent))] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-7 rounded-[7px] px-2.5 text-[11px]",
        lg: "h-10 rounded-[8px] px-5",
        icon: "h-9 w-9",
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
