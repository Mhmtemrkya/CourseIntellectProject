import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({
  ...props
}: React.ComponentProps<typeof Sonner>) => {
  const { theme = "system" } = useTheme()
  // next-themes serbest metin döner; sonner yalnız üç değeri tanır.
  const sonnerTheme: React.ComponentProps<typeof Sonner>["theme"] =
    theme === "light" || theme === "dark" ? theme : "system"

  return (
    <Sonner
      theme={sonnerTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
