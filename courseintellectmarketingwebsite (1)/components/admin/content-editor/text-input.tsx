"use client"

import { useState } from "react"

interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  required?: boolean
  helperText?: string
}

export function TextInput({ label, value, onChange, placeholder, maxLength, required, helperText }: TextInputProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      <div
        className={`relative rounded-lg border transition-all duration-200 ${
          isFocused ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/50"
        }`}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full px-3 py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none rounded-lg"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {helperText && <span>{helperText}</span>}
        {maxLength && (
          <span className="ml-auto">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  )
}
