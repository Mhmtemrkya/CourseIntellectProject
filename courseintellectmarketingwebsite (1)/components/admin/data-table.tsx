"use client"

import type React from "react"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
  className?: string
}

export interface Action<T> {
  label: string
  icon?: React.ReactNode
  onClick: (row: T) => void
  variant?: "default" | "destructive"
  hidden?: (row: T) => boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  actions?: Action<T>[]
  searchPlaceholder?: string
  searchKeys?: (keyof T)[]
  pageSize?: number
  emptyMessage?: string
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  actions,
  searchPlaceholder = "Ara...",
  searchKeys = [],
  pageSize = 10,
  emptyMessage = "Veri bulunamadı",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1)

  // Filter data
  const filteredData = data.filter((row) => {
    if (!search) return true
    return searchKeys.some((key) => {
      const value = row[key]
      return String(value).toLowerCase().includes(search.toLowerCase())
    })
  })

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortKey) return 0
    const aVal = a[sortKey as keyof T]
    const bVal = b[sortKey as keyof T]
    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1
    return 0
  })

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortOrder("asc")
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      {searchKeys.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-10"
          />
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={cn(
                      "text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3",
                      col.className,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(String(col.key))}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col.label}
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform",
                            sortKey === col.key && sortOrder === "desc" && "rotate-180",
                          )}
                        />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
                {actions && actions.length > 0 && (
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                    İşlemler
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {paginatedData.length > 0 ? (
                  paginatedData.map((row, index) => {
                    const rowActions = actions?.filter((action) => !action.hidden?.(row)) ?? []

                    return (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {columns.map((col) => (
                          <td key={String(col.key)} className={cn("px-4 py-3 text-sm", col.className)}>
                            {col.render
                              ? col.render(row[col.key as keyof T], row)
                              : String(row[col.key as keyof T] ?? "")}
                          </td>
                        ))}
                        {actions && actions.length > 0 && (
                          <td className="px-4 py-3 text-right">
                            {rowActions.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {rowActions.map((action) => (
                                    <DropdownMenuItem
                                      key={action.label}
                                      onClick={() => action.onClick(row)}
                                      className={cn(
                                        action.variant === "destructive" && "text-destructive focus:text-destructive",
                                      )}
                                    >
                                      {action.icon && <span className="mr-2">{action.icon}</span>}
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    )
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length + (actions ? 1 : 0)}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {filteredData.length} kayıttan {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filteredData.length)} arası gösteriliyor
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-3 text-sm">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
