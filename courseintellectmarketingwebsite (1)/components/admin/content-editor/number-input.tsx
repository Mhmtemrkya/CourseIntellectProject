"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
  required?: boolean
  helperText?: string
}

export function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  prefix,
  suffix,
  required,
  helperText,
}: NumberInputProps) {
  const [isFocused, setIsFocused] = useState(false)

  const increment = () => {
    const newValue = Math.min(value + step, max)
    onChange(newValue)
  }

  const decrement = () => {
    const newValue = Math.max(value - step, min)
    onChange(newValue)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      <div
        className={`flex items-center rounded-lg border transition-all duration-200 ${
          isFocused ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/50"
        }`}
      >
        <button type="button" onClick={decrement} className="p-2.5 hover:bg-muted transition-colors rounded-l-lg">
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-1 px-2">
          {prefix && <span className="text-muted-foreground">{prefix}</span>}
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const newValue = Number(e.target.value)
              if (newValue >= min && newValue <= max) {
                onChange(newValue)
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            min={min}
            max={max}
            step={step}
            className="w-20 text-center bg-transparent text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {suffix && <span className="text-muted-foreground">{suffix}</span>}
        </div>
        <button type="button" onClick={increment} className="p-2.5 hover:bg-muted transition-colors rounded-r-lg">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  )
}
