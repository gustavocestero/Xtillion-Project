import React, { useState, useMemo, useEffect } from "react";

/** Debounced client-side customer search. */
export default function CustomerSearch({ customers, onSelect }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) => {
        const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
        return (
          name.includes(q) ||
          String(c.id).includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.city || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [customers, debounced]);

  return (
    <div className="customer-search">
      <input
        className="customer-search-input"
        placeholder="Search by name, ID, email, or city…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <div className="customer-search-results">
          {results.map((c) => (
            <div
              key={c.id}
              className="result"
              onClick={() => { onSelect(c); setQuery(""); }}
            >
              <div className="name">{c.first_name} {c.last_name}</div>
              <div className="meta">#{c.id} · {c.city || "—"} · {c.email || "no email"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
