import { useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { AlertCircle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Inbox, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, EmptyState, Skeleton } from "./primitives";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Columns<T> = ColumnDef<T, any>[];

export function DataTable<T>({
  data,
  columns,
  pageSize = 10,
  onRowClick,
  emptyTitle = "No results",
  emptyText = "Try adjusting your search or filters.",
  className,
  manualPagination = false,
  manualSorting = false,
  total: totalProp,
  totalPages: totalPagesProp,
  pageIndex: pageIndexProp,
  sorting: sortingProp,
  onPaginationChange,
  onSortingChange,
  loading = false,
  error,
  onRetry,
}: {
  data: T[];
  columns: Columns<T>;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyText?: string;
  className?: string;
  manualPagination?: boolean;
  manualSorting?: boolean;
  total?: number;
  totalPages?: number;
  pageIndex?: number;
  sorting?: SortingState;
  onPaginationChange?: (pagination: PaginationState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalPagination, setInternalPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  const sorting = sortingProp ?? internalSorting;
  const pagination: PaginationState = manualPagination
    ? { pageIndex: pageIndexProp ?? 0, pageSize }
    : internalPagination;

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    if (onSortingChange) onSortingChange(next);
    else setInternalSorting(next);
  };

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === "function" ? updater(pagination) : updater;
    if (onPaginationChange) onPaginationChange(next);
    else setInternalPagination(next);
  };

  const table = useReactTable({
    data,
    columns,
    pageCount: manualPagination ? Math.max(1, totalPagesProp ?? 1) : undefined,
    manualPagination,
    manualSorting,
    state: { sorting, pagination },
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    ...(manualSorting ? {} : { getSortedRowModel: getSortedRowModel() }),
    ...(manualPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    autoResetPageIndex: false,
  });

  useEffect(() => {
    if (manualPagination) return;
    const max = Math.max(0, Math.ceil(data.length / internalPagination.pageSize) - 1);
    if (internalPagination.pageIndex > max) setInternalPagination((p) => ({ ...p, pageIndex: max }));
  }, [manualPagination, data.length, internalPagination.pageIndex, internalPagination.pageSize]);

  const total = manualPagination ? (totalProp ?? data.length) : data.length;
  const pages = manualPagination
    ? Math.max(1, totalPagesProp ?? Math.ceil(total / Math.max(1, pagination.pageSize)))
    : table.getPageCount();
  const start = total ? pagination.pageIndex * pagination.pageSize + 1 : 0;
  const end = total
    ? manualPagination
      ? Math.min(total, pagination.pageIndex * pagination.pageSize + data.length)
      : Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize)
    : 0;
  const visibleColumnCount = table.getVisibleLeafColumns().length || columns.length;

  return (
    <div className={cn("overflow-hidden", className)}>
      {error ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h4 className="font-heading text-base font-bold">Could not load records</h4>
          <p className="mt-1 max-w-sm text-sm text-muted">{error}</p>
          {onRetry && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
              <RotateCw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain touch-scroll">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-line bg-surface-2/50">
                    {hg.headers.map((h) => {
                      const sorted = h.column.getIsSorted();
                      const can = h.column.getCanSort();
                      return (
                        <th key={h.id} className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                          {h.isPlaceholder ? null : can ? (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={h.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1.5 uppercase cursor-pointer hover:text-ink"
                            >
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {sorted === "asc" ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="h-3 w-3" />
                              ) : (
                                <ChevronsUpDown className="h-3 w-3 opacity-40" />
                              )}
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 uppercase">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading && data.length === 0 ? (
                  Array.from({ length: Math.min(pageSize, 6) }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="border-b border-line/60 last:border-0">
                      {Array.from({ length: visibleColumnCount }).map((__, colIdx) => (
                        <td key={`skeleton-cell-${idx}-${colIdx}`} className="px-4 py-3.5 align-middle">
                          <Skeleton className={colIdx === 0 ? "h-8 w-40" : "h-5 w-20"} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      className={cn(
                        "border-b border-line/60 transition-colors last:border-0",
                        onRowClick && "cursor-pointer hover:bg-primary/[0.04]",
                        loading && "opacity-60",
                      )}
                    >
                      {row.getVisibleCells().map((c) => (
                        <td key={c.id} className="px-4 py-3 align-middle">
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && total === 0 && <EmptyState icon={<Inbox className="h-6 w-6" />} title={emptyTitle} text={emptyText} />}
          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
              <p className="text-xs text-muted">
                Showing <span className="num font-semibold text-ink">{start}–{end}</span> of <span className="num font-semibold text-ink">{total}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="icon" className="h-8 w-8" disabled={loading || !table.getCanPreviousPage()} onClick={() => table.previousPage()} aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="num px-2 text-xs font-semibold">
                  {pagination.pageIndex + 1} / {pages}
                </span>
                <Button variant="secondary" size="icon" className="h-8 w-8" disabled={loading || !table.getCanNextPage()} onClick={() => table.nextPage()} aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
