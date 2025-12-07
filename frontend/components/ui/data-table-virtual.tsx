"use client"

import * as React from "react"
import { useRef } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  Row,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface DataTableVirtualProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  loadingRows?: number
  emptyMessage?: React.ReactNode
  onRowClick?: (row: TData) => void
  /** Height of the table container (required for virtualization) */
  height?: number | string
  /** Estimated row height for virtualization */
  estimateRowHeight?: number
  /** Number of rows to render outside visible area */
  overscan?: number
  /** Enable row virtualization (default: true when > 50 items) */
  enableVirtualization?: boolean
  className?: string
}

/**
 * Virtualized DataTable component for large datasets
 * 
 * Only renders visible rows + buffer, providing smooth scrolling
 * even with thousands of rows.
 * 
 * @example
 * ```tsx
 * <DataTableVirtual
 *   columns={columns}
 *   data={items}
 *   height={600}
 *   estimateRowHeight={52}
 *   onRowClick={(row) => console.log(row)}
 * />
 * ```
 */
export function DataTableVirtual<TData, TValue>({
  columns,
  data,
  isLoading = false,
  loadingRows = 10,
  emptyMessage = "Нет данных",
  onRowClick,
  height = 600,
  estimateRowHeight = 52,
  overscan = 10,
  enableVirtualization,
  className,
}: DataTableVirtualProps<TData, TValue>) {
  const parentRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const { rows } = table.getRowModel()
  
  // Auto-enable virtualization for large datasets
  const shouldVirtualize = enableVirtualization ?? rows.length > 50

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    enabled: shouldVirtualize,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  const columnCount =
    table.getHeaderGroups()[0]?.headers.length ?? columns.length ?? 1

  // Padding for virtual scroll positioning
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0

  const renderRow = (row: Row<TData>, virtualRow?: { index: number; start: number; size: number }) => (
    <TableRow
      key={row.id}
      data-state={row.getIsSelected() ? "selected" : undefined}
      data-index={virtualRow?.index}
      className={cn(
        onRowClick && "cursor-pointer hover:bg-muted/50",
        "transition-colors"
      )}
      onClick={() => onRowClick?.(row.original)}
      style={
        shouldVirtualize && virtualRow
          ? {
              position: 'absolute',
              top: virtualRow.start,
              left: 0,
              right: 0,
              height: virtualRow.size,
            }
          : undefined
      }
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )

  return (
    <div
      ref={parentRef}
      className={cn("rounded-lg border bg-card overflow-auto", className)}
      style={{ height, maxHeight: height }}
    >
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody
          style={
            shouldVirtualize
              ? { height: totalSize, position: 'relative' }
              : undefined
          }
        >
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: loadingRows }).map((_, index) => (
              <TableRow key={`loading-${index}`}>
                <TableCell colSpan={columnCount}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            // Empty state
            <TableRow>
              <TableCell colSpan={columnCount}>
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              </TableCell>
            </TableRow>
          ) : shouldVirtualize ? (
            // Virtualized rows
            <>
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index]
                return renderRow(row, virtualRow)
              })}
            </>
          ) : (
            // Non-virtualized rows (small datasets)
            rows.map((row) => renderRow(row))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Hook to get virtualization info for external use
 */
export function useTableVirtualization<TData>(
  data: TData[],
  options: {
    height: number
    estimateRowHeight?: number
    overscan?: number
    enabled?: boolean
  }
) {
  const parentRef = useRef<HTMLDivElement>(null)
  const { height, estimateRowHeight = 52, overscan = 10, enabled = true } = options

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    enabled,
  })

  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    scrollToIndex: virtualizer.scrollToIndex,
    measureElement: virtualizer.measureElement,
    containerStyle: { height, maxHeight: height, overflow: 'auto' },
  }
}

