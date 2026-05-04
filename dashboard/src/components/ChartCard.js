import React from "react";

// Simple card wrapper that gives every chart a consistent title + sizing box.
export default function ChartCard({ title, children }) {
  return (
    <div className="card chart-card">
      {title && <h2>{title}</h2>}
      <div className="chart-wrap">{children}</div>
    </div>
  );
}
