'use client'

import { ReactNode, useState, useEffect, useRef } from 'react'

export interface Column<T> {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  nowrap?: boolean
  render?: (row: T) => ReactNode
}

interface DataTableProps<T extends { id?: string }> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  defaultPageSize?: number
  pageSizeOptions?: number[]
  striped?: boolean
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data found.',
  defaultPageSize = 20,
  pageSizeOptions = [20, 50, 100, 0],
  striped = true,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const prevDataRef = useRef(data)

  // Reset to page 0 when data changes (e.g. filter applied upstream)
  useEffect(() => {
    if (prevDataRef.current !== data) {
      prevDataRef.current = data
      setCurrentPage(0)
    }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-10 text-center text-sm text-slate-400">
        {emptyMessage}
      </div>
    )
  }

  const totalRows = data.length
  const showAll = pageSize === 0
  const totalPages = showAll ? 1 : Math.ceil(totalRows / pageSize)
  const safePage = Math.min(currentPage, totalPages - 1)
  const startIdx = showAll ? 0 : safePage * pageSize
  const endIdx = showAll ? totalRows : Math.min(startIdx + pageSize, totalRows)
  const pageData = showAll ? data : data.slice(startIdx, endIdx)

  const showPagination = totalRows > Math.min(...pageSizeOptions.filter((o) => o > 0))

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap border-b-2 border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  style={{ textAlign: col.align || 'left' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr
                key={row.id || startIdx + i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 ${
                  striped ? (i % 2 === 1 ? 'bg-gray-100 dark:bg-slate-700' : 'bg-white dark:bg-slate-800') : ''
                } ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700' : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-3 ${col.nowrap ? 'whitespace-nowrap' : ''}`}
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {col.render
                      ? col.render(row)
                      : (row as Record<string, unknown>)[col.key] as ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>
            Showing {startIdx + 1}–{endIdx} of {totalRows}
          </span>

          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-slate-400">Rows:</span>
            {pageSizeOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setPageSize(opt)
                  setCurrentPage(0)
                }}
                className={`rounded px-2 py-1 text-xs ${
                  pageSize === opt
                    ? 'bg-slate-800 text-white dark:bg-slate-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
                }`}
              >
                {opt === 0 ? 'All' : opt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage === 0 || showAll}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:hover:bg-transparent"
            >
              Prev
            </button>
            {!showAll && (
              <span className="text-xs">
                Page {safePage + 1} of {totalPages}
              </span>
            )}
            <button
              type="button"
              disabled={safePage >= totalPages - 1 || showAll}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
