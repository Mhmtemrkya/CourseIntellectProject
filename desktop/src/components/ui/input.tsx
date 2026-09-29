import * as React from "react"

import { cn } from "@/lib/utils"
import { DatePickerInput } from "@/components/ui/date-picker-input"

// type="date" yerel tarih alanı yerine DatePickerInput'a (tetik bir <button>) yönlenir;
// ref bu durumda butona bağlanır. Dış ref tipi tek olmalı, bu yüzden HTMLElement.
const Input = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<"input">>(({ className, type, ...props }, ref) => {
  if (type === "date") {
    const { value, defaultValue, min, max, ...rest } = props
    return (
      <DatePickerInput
        ref={ref as React.Ref<HTMLButtonElement>}
        className={className}
        value={value == null ? value : String(value)}
        defaultValue={defaultValue == null ? undefined : String(defaultValue)}
        min={min == null ? undefined : String(min)}
        max={max == null ? undefined : String(max)}
        {...rest} />
    )
  }

  return (
    <input
      type={type}
      className={cn(
        "ci-input flex h-9 w-full rounded-[8px] border border-foreground/[0.10] bg-[hsl(var(--ci-field)/0.8)] px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-lg transition-all placeholder:text-muted-foreground/75 hover:border-[hsl(var(--brand-accent)/0.28)] focus-visible:border-[hsl(var(--brand-accent)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent)/0.14)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref as React.Ref<HTMLInputElement>}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
