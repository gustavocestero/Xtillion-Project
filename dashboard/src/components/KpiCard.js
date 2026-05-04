import React from "react";

// Headline number tile — used on every page hero strip.
export default function KpiCard({ label, value, sub }) {
  return (
    <div className="kpi-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
