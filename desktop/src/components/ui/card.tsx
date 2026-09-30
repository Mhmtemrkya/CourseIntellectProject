import * as React from "react"

import { cn } from "@/lib/utils"
import { CardToneContext, cardHeading, cardTone, type CardTone } from './card-palette'

interface CardProps extends React.ComponentPropsWithoutRef<'div'> {
  tone?: CardTone;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, tone, ...props }, ref) => {
  const scopeTone = React.useContext(CardToneContext);
  const heading = cardHeading(props.children);
  return (
  <div
    ref={ref}
    data-card-tone={tone ?? (heading ? cardTone(heading) : scopeTone)}
    className={cn("ci-card rounded-[10px] border border-border/70 text-card-foreground shadow-[0_14px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-300", className)}
    {...props} />
  );
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 border-b border-foreground/[0.06] px-4 py-3", className)}
    {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-[13px] font-black uppercase leading-none tracking-[0.045em] text-[hsl(var(--brand-accent-text,var(--brand-accent)))]", className)}
    {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs text-muted-foreground", className)}
    {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center border-t border-foreground/[0.06] p-4", className)}
    {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
