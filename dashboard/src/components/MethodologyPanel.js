import React, { useState } from "react";

// Collapsible "how I did it" panel — every page has one to make the work auditable.
export default function MethodologyPanel({ title = "How I did this", children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`methodology ${open ? "open" : ""}`}>
      <div className="methodology-header" onClick={() => setOpen(!open)}>
        <span>📐 {title}</span>
        <span className="icon">▶</span>
      </div>
      {open && <div className="methodology-body">{children}</div>}
    </div>
  );
}
