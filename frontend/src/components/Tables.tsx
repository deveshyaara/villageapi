interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
  loading?: boolean;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data available",
  loading = false,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="bg-surface-900 border border-surface-700/50 rounded-xl p-12">
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-surface-200/50">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-900 border border-surface-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-6 py-3.5 text-xs font-semibold text-surface-200/50 uppercase tracking-wider ${
                    col.className ?? ""
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700/30">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="hover:bg-surface-800/50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-6 py-4 text-sm text-surface-200/80 ${
                      col.className ?? ""
                    }`}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-sm text-surface-200/40">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
