import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[hsl(var(--ci-overlay)/0.78)] backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "ci-dialog fixed left-[50%] top-[50%] z-50 grid w-[calc(100%_-_2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-5 overflow-hidden rounded-3xl border border-border/75 bg-card/92 p-6 text-card-foreground shadow-[0_32px_100px_hsl(220_70%_2%/0.55),inset_0_1px_0_hsl(var(--foreground)/0.05)] backdrop-blur-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className
      )}
      {...props}>
      <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
      {children}
      <DialogPrimitive.Close
        aria-label="Kapat"
        data-ci-dialog-close="true"
        style={{ top: '1.25rem', right: '1.25rem', bottom: 'auto', left: 'auto' }}
        className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-xl border border-border/70 bg-muted/55 p-0 text-muted-foreground transition-all hover:border-[hsl(var(--brand-accent)/0.35)] hover:bg-[hsl(var(--brand-accent)/0.1)] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-accent)/0.4)] disabled:pointer-events-none">
        <X className="block h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Kapat</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 border-b border-border/55 pb-4 pr-12 text-center sm:text-left", className)}
    {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse gap-2 border-t border-border/55 pt-4 sm:flex-row sm:justify-end", className)}
    {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-xl font-semibold leading-none tracking-[-0.02em]", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
