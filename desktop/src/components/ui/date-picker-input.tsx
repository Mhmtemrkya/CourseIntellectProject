import * as React from "react"
import { CalendarDays, Check, RotateCcw, X } from "lucide-react"
import { format, isValid, parse } from "date-fns"
import { tr } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const ISO_DATE_FORMAT = "yyyy-MM-dd"
const DISPLAY_DATE_FORMAT = "d MMMM yyyy, EEEE"

function parseDate(value) {
  if (!value) return undefined
  const parsed = parse(String(value).slice(0, 10), ISO_DATE_FORMAT, new Date())
  return isValid(parsed) ? parsed : undefined
}

function toIsoDate(value) {
  return value ? format(value, ISO_DATE_FORMAT) : ""
}

function emitDateChange(onChange, value, name) {
  onChange?.({
    target: { value, name },
    currentTarget: { value, name },
  })
}

const DatePickerInput = React.forwardRef(({
  className,
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  disabled,
  required,
  min,
  max,
  name,
  id,
  placeholder = "Tarih seçin",
  "aria-label": ariaLabel,
  ...props
}, ref) => {
  const [open, setOpen] = React.useState(false)
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "")
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : uncontrolledValue
  const selected = parseDate(currentValue)
  const minDate = parseDate(min)
  const maxDate = parseDate(max)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fromYear = minDate?.getFullYear() ?? 1900
  const toYear = maxDate?.getFullYear() ?? Math.max(today.getFullYear() + 25, 2100)

  const updateValue = (nextValue) => {
    if (!isControlled) setUncontrolledValue(nextValue)
    emitDateChange(onChange, nextValue, name)
  }

  const selectDate = (date) => {
    if (!date) return
    updateValue(toIsoDate(date))
    setOpen(false)
  }

  const canSelectToday = (!minDate || today >= minDate) && (!maxDate || today <= maxDate)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          {...props}
          id={id}
          ref={ref}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel || placeholder}
          aria-required={required || undefined}
          aria-haspopup="dialog"
          className={cn(
            "ci-input group flex h-9 w-full items-center justify-between gap-3 rounded-[8px] border border-foreground/[0.10] bg-[hsl(var(--ci-field)/0.8)] px-3 py-2 text-left text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-lg transition-all hover:border-[hsl(var(--brand-accent)/0.35)] focus-visible:border-[hsl(var(--brand-accent)/0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent)/0.16)] disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground/75",
            className,
          )}
          onBlur={onBlur}
          onFocus={onFocus}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected
              ? format(selected, DISPLAY_DATE_FORMAT, { locale: tr })
              : placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-[hsl(var(--brand-accent))]" />
          </span>
        </button>
      </PopoverTrigger>

      {name ? <input type="hidden" name={name} value={currentValue || ""} /> : null}

      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="max-h-[calc(100vh-1.5rem)] w-[min(27rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-3xl border-foreground/10 bg-popover/98 p-0 shadow-[0_24px_70px_hsl(220_60%_2%/0.38)]"
      >
        <div className="border-b border-foreground/10 bg-gradient-to-br from-[hsl(var(--brand-accent)/0.16)] via-transparent to-[hsl(var(--brand-primary)/0.08)] px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--brand-accent))]">
                Tarih seçimi
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {selected
                  ? format(selected, "d MMMM yyyy", { locale: tr })
                  : "Gün, ay ve yılı seçin"}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[hsl(var(--brand-accent))] text-white shadow-lg shadow-[hsl(var(--brand-accent)/0.24)]">
              {selected ? <Check className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
            </div>
          </div>
        </div>

        <Calendar
          mode="single"
          selected={selected}
          onSelect={selectDate}
          defaultMonth={selected || minDate || today}
          fromDate={minDate}
          toDate={maxDate}
          fromYear={fromYear}
          toYear={toYear}
          captionLayout="dropdown-buttons"
          locale={tr}
          initialFocus
          className="border-0 bg-transparent p-4 sm:p-5"
        />

        <div className="flex items-center justify-between gap-2 border-t border-foreground/10 bg-foreground/[0.025] px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canSelectToday}
              onClick={() => selectDate(today)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-foreground/10 px-3 text-xs font-semibold text-foreground transition hover:border-[hsl(var(--brand-accent)/0.35)] hover:bg-[hsl(var(--brand-accent)/0.08)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Bugün
            </button>
            {selected && !required ? (
              <button
                type="button"
                onClick={() => {
                  updateValue("")
                  setOpen(false)
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
                Temizle
              </button>
            ) : null}
          </div>
          <p className="text-right text-[10px] leading-4 text-muted-foreground">
            Üstteki alanlardan
            <br />
            ay ve yılı hızlı seçin
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
})

DatePickerInput.displayName = "DatePickerInput"

export { DatePickerInput }
