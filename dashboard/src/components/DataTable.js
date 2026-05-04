import React, { useState, useMemo } from "react";

/**
 * Reusable sortable + searchable table.
 *  columns: [{ key, label, format?, numeric? }]
 *  rows:    array of objects
 */
export default function DataTable({ columns, rows, searchable = false, searchKeys, initialSort, pageSize }) {
  const [sortKey, setSortKey] = useState(initialSort?.key || null);
  const [sortDir, setSortDir] = useState(initialSort?.dir || "desc");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const q = query.toLowerCase();
    const keys = searchKeys || columns.map((c) => c.key);
    return rows.filter((r) =>
      keys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))
    );
  }, [rows, query, searchable, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const out = [...filtered];
    out.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  const display = pageSize ? sorted.slice(0, pageSize) : sorted;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <div>
      {searchable && (
        <input
          className="table-search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} onClick={() => handleSort(c.key)}>
                  {c.label}
                  <span className="sort-arrow">
                    {sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.length === 0 ? (
              <tr><td colSpan={columns.length} className="empty">No results.</td></tr>
            ) : display.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key}>{c.format ? c.format(row[c.key], row) : row[c.key] ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
