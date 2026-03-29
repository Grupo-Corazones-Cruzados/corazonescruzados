'use client';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  width?: string;
}

interface PixelDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyTitle?: string;
  emptyDesc?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export default function PixelDataTable<T>({
  columns,
  data,
  onRowClick,
  emptyTitle = 'Sin datos',
  emptyDesc = 'No hay registros aun.',
  page,
  totalPages,
  onPageChange,
}: PixelDataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="pixel-card text-center py-12">
        <p className="pixel-heading text-sm text-digi-muted">{emptyTitle}</p>
        <p className="text-xs text-digi-muted/60 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {emptyDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-digi-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-digi-card border-b-2 border-digi-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-left text-[9px] text-digi-muted uppercase tracking-wider"
                  style={{ fontFamily: "'Silkscreen', cursive", width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-digi-border/50 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-accent/5' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2.5 text-xs text-digi-text"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-3 py-2 bg-digi-card border-t-2 border-digi-border">
          <span className="text-[9px] text-digi-muted" style={{ fontFamily: "'Silkscreen', cursive" }}>
            Pag {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange((page || 1) - 1)}
              disabled={page === 1}
              className="px-2 py-1 text-[10px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow disabled:opacity-30 transition-colors"
              style={{ fontFamily: "'Silkscreen', cursive" }}
            >
              &lt;
            </button>
            <button
              onClick={() => onPageChange((page || 1) + 1)}
              disabled={page === totalPages}
              className="px-2 py-1 text-[10px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow disabled:opacity-30 transition-colors"
              style={{ fontFamily: "'Silkscreen', cursive" }}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
