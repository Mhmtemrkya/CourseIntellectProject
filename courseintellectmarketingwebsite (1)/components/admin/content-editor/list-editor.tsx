"use client"

import type React from "react"

import { useState } from "react"
import { GripVertical, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"

interface ListEditorProps<T> {
  label: string
  items: T[]
  onChange: (items: T[]) => void
  renderItem: (item: T, index: number, updateItem: (item: T) => void) => React.ReactNode
  createNewItem: () => T
  itemLabel?: (item: T, index: number) => string
}

export function ListEditor<T>({ label, items, onChange, renderItem, createNewItem, itemLabel }: ListEditorProps<T>) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const addItem = () => {
    const newItems = [...items, createNewItem()]
    onChange(newItems)
    setExpandedIndex(newItems.length - 1)
  }

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    onChange(newItems)
    if (expandedIndex === index) {
      setExpandedIndex(null)
    }
  }

  const updateItem = (index: number, item: T) => {
    const newItems = [...items]
    newItems[index] = item
    onChange(newItems)
  }

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return
    const newItems = [...items]
    const [movedItem] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, movedItem)
    onChange(newItems)
    setExpandedIndex(toIndex)
  }

  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== index) {
      moveItem(dragIndex, index)
      setDragIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDragIndex(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ekle
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`border border-border rounded-lg overflow-hidden transition-all ${
              dragIndex === index ? "opacity-50 scale-[0.98]" : ""
            }`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              <span className="flex-1 text-sm font-medium truncate">
                {itemLabel ? itemLabel(item, index) : `Öğe ${index + 1}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(index, index - 1)}
                  disabled={index === 0}
                  className="p-1 hover:bg-muted rounded disabled:opacity-30"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, index + 1)}
                  disabled={index === items.length - 1}
                  className="p-1 hover:bg-muted rounded disabled:opacity-30"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${expandedIndex === index ? "rotate-180" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {expandedIndex === index && (
              <div className="p-4 border-t border-border bg-card">
                {renderItem(item, index, (updatedItem) => updateItem(index, updatedItem))}
              </div>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
            <p className="text-sm">Henüz öğe eklenmedi</p>
            <button type="button" onClick={addItem} className="mt-2 text-sm text-primary hover:underline">
              İlk öğeyi ekle
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
