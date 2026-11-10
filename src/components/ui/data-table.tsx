import { useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, EmptyState } from "./primitives";

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
}: {
  data: T[];
  columns: Columns<T>;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyText?: string;
  className?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  useEffect(() => {
    const max = Math.max(0, Math.ceil(data.length / pagination.pageSize) - 1);
    if (pagination.pageIndex > max) setPagination((p) => ({ ...p, pageIndex: max }));
  }, [data.length, pagination.pageIndex, pagination.pageSize]);

  const total = data.length;
  const start = total ? pagination.pageIndex * pagination.pageSize + 1 : 0;
  const end = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);
  const pages = table.getPageCount();

  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line bg-surface-2/50">
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const can = h.column.getCanSort();
                  return (
                    <th key={h.id} className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                      {h.isPlaceholder ? null : (
                        <button
                          type="button"
                          disabled={!can}
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn("inline-flex items-center gap-1.5 uppercase", can ? "cursor-pointer hover:text-ink" : "cursor-default")}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {can && (sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-40" />)}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn("border-b border-line/60 transition-colors last:border-0", onRowClick && "cursor-pointer hover:bg-primary/[0.04]")}
              >
                {row.getVisibleCells().map((c) => (
                  <td key={c.id} className="px-4 py-3 align-middle">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total === 0 && <EmptyState icon={<Inbox className="h-6 w-6" />} title={emptyTitle} text={emptyText} />}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-xs text-muted">
            Showing <span className="num font-semibold text-ink">{start}–{end}</span> of <span className="num font-semibold text-ink">{total}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="icon" className="h-8 w-8" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="num px-2 text-xs font-semibold">
              {pagination.pageIndex + 1} / {pages}
            </span>
            <Button variant="secondary" size="icon" className="h-8 w-8" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
