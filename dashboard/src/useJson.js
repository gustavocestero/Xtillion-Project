import { useEffect, useState } from "react";

// Tiny fetch+JSON hook. Cancels on unmount so stale loads don't clobber state.
export default function useJson(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${path}`);
        return r.json();
      })
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [path]);
  return { data, error };
}
