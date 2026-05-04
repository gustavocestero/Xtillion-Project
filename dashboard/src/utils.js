// shared formatters and chart defaults

export const fmtCurrency = (n) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const fmtNumber = (n) =>
  n == null ? "—" : Number(n).toLocaleString();

export const fmtPercent = (n, digits = 1) =>
  n == null ? "—" : `${(Number(n) * 100).toFixed(digits)}%`;

// consistent palette so every chart looks like part of the same product
export const palette = {
  primary: "#1f6feb",
  primarySoft: "rgba(31, 111, 235, 0.15)",
  success: "#1faa6f",
  successSoft: "rgba(31, 170, 111, 0.15)",
  warning: "#d97706",
  danger: "#d93636",
  gray: "#94a3b8",
  series: ["#1f6feb", "#1faa6f", "#d97706", "#9333ea", "#0891b2", "#d93636",
           "#ca8a04", "#7c3aed", "#0284c7", "#059669"],
};

export const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
    tooltip: { backgroundColor: "#0f1f3a", padding: 10, cornerRadius: 6 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    y: { grid: { color: "#eef1f6" }, ticks: { font: { size: 11 } } },
  },
};
