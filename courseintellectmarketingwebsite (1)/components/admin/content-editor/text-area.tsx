"use client"

import { useState, useRef, useEffect } from "react"

interface TextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  required?: boolean
  helperText?: string
  rows?: number
  autoResize?: boolean
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  required,
  helperText,
  rows = 3,
  autoResize = true,
}: TextAreaProps) {
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoResize && textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value, autoResize])

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
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          className="w-full px-3 py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none rounded-lg resize-none"
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
