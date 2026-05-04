import React from "react";
import { Line, Bar } from "react-chartjs-2";
import ChartCard from "../components/ChartCard";
import DataTable from "../components/DataTable";
import MethodologyPanel from "../components/MethodologyPanel";
import useJson from "../useJson";
import { fmtCurrency, fmtNumber, palette, baseChartOptions } from "../utils";

export default function Transfers() {
  const { data, error } = useJson("/data/transfers.json");
  if (error) return <div className="loading">Error: {error}</div>;
  if (!data) return <div className="loading">Loading…</div>;

  const s = data.summary;

  const trendChart = {
    labels: data.monthly_trend.map((m) => m.year_month),
    datasets: [{
      label: "Transfer volume ($)",
      data: data.monthly_trend.map((m) => m.transfer_total),
      borderColor: palette.primary,
      backgroundColor: palette.primarySoft,
      fill: true,
      tension: 0.25,
    }],
  };

  const distChart = {
    labels: data.amount_distribution.map((d) => d.bucket),
    datasets: [{
      label: "Transfers",
      data: data.amount_distribution.map((d) => d.count),
      backgroundColor: palette.primary,
    }],
  };

  const senderCols = [
    { key: "first_name", label: "First", format: (v, r) => `${v || ""} ${r.last_name || ""}` },
    { key: "city", label: "City" },
    { key: "count", label: "# sent", format: fmtNumber },
    { key: "total_sent", label: "Total", format: fmtCurrency },
  ];
  const receiverCols = [
    { key: "first_name", label: "First", format: (v, r) => `${v || ""} ${r.last_name || ""}` },
    { key: "city", label: "City" },
    { key: "count", label: "# received", format: fmtNumber },
    { key: "total_received", label: "Total", format: fmtCurrency },
  ];

  return (
    <>
      <div className="page-header">
        <h1>Transfers</h1>
        <p>Peer-to-peer transfer activity over time.</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="label">Total volume</div><div className="value">{fmtCurrency(s.total_volume)}</div></div>
        <div className="kpi-card"><div className="label">Valid transfers</div><div className="value">{fmtNumber(s.valid_transfers)}</div><div className="sub">{fmtNumber(s.invalid_transfers)} invalid</div></div>
        <div className="kpi-card"><div className="label">Average</div><div className="value">{fmtCurrency(s.avg_amount)}</div><div className="sub">median {fmtCurrency(s.median_amount)}</div></div>
        <div className="kpi-card"><div className="label">Largest</div><div className="value">{fmtCurrency(s.max_amount)}</div></div>
      </div>

      <div className="grid-2">
        <ChartCard title="Monthly transfer volume">
          <Line data={trendChart} options={baseChartOptions} />
        </ChartCard>
        <ChartCard title="Transfer amount distribution">
          <Bar data={distChart} options={baseChartOptions} />
        </ChartCard>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Top 10 senders</h2>
          <DataTable columns={senderCols} rows={data.top_senders} />
        </div>
        <div className="card">
          <h2>Top 10 receivers</h2>
          <DataTable columns={receiverCols} rows={data.top_receivers} />
        </div>
      </div>

      <div className="callout callout-info">
        <strong>Outliers</strong>
        {s.zero_count} valid $0 transfers and a 99th-percentile threshold of {fmtCurrency(data.outliers.p99_threshold)}.
        {data.outliers.high_value.length > 0 && (
          <> Largest: {fmtCurrency(data.outliers.high_value[0].amount)} on {data.outliers.high_value[0].date}.</>
        )}
      </div>

      <MethodologyPanel title="How I did this">
        <p>
          15 transfers had a missing sender or recipient ID. Rather than drop them, I
          flagged them and kept them in the database — the analytics filter to{" "}
          <code>valid == True</code>, but the raw record is preserved for audit.
        </p>
        <pre><code>{`# matching.flag_transfers
valid_ids = set(people["id"].dropna().astype(int))
def is_valid(row):
    s, r = row.sender_id, row.recipient_id
    return pd.notna(s) and pd.notna(r) and int(s) in valid_ids and int(r) in valid_ids
transfers["valid"] = transfers.apply(is_valid, axis=1)`}</code></pre>
        <p>
          Outliers use a simple 99th-percentile threshold rather than a z-score — the
          distribution is heavily skewed so a normal-distribution assumption isn't great.
        </p>
      </MethodologyPanel>
    </>
  );
}
