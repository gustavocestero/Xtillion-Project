import React from "react";
import { Bar } from "react-chartjs-2";
import KpiCard from "../components/KpiCard";
import ChartCard from "../components/ChartCard";
import MethodologyPanel from "../components/MethodologyPanel";
import useJson from "../useJson";
import { fmtCurrency, fmtNumber, fmtPercent, palette, baseChartOptions } from "../utils";

export default function Overview() {
  const { data, error } = useJson("/data/overview.json");

  if (error) return <div className="loading">Error: {error}</div>;
  if (!data) return <div className="loading">Loading…</div>;

  const k = data.kpis;
  const dq = data.data_quality;

  const chartData = {
    labels: data.monthly_activity.map((m) => m.year_month),
    datasets: [
      {
        label: "Transfers ($)",
        data: data.monthly_activity.map((m) => m.transfer_total),
        backgroundColor: palette.primary,
      },
      {
        label: "Store revenue ($)",
        data: data.monthly_activity.map((m) => m.transaction_total),
        backgroundColor: palette.success,
      },
    ],
  };

  return (
    <>
      <div className="page-header">
        <h1>Overview</h1>
        <p>Unified view of Venmito customers, transfers, store activity, and promotions.</p>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total Customers" value={fmtNumber(k.total_customers)}
                 sub={`${dq.people_overlap} in both sources`} />
        <KpiCard label="Transfer Volume" value={fmtCurrency(k.transfer_volume)}
                 sub={`${dq.transfers_invalid} invalid records`} />
        <KpiCard label="Store Revenue" value={fmtCurrency(k.store_revenue)} />
        <KpiCard label="Promo Response Rate" value={fmtPercent(k.promo_response_rate)} />
      </div>

      <ChartCard title="Monthly activity">
        <Bar data={chartData} options={baseChartOptions} />
      </ChartCard>

      <div className="card">
        <h2>Data quality snapshot</h2>
        <div className="grid-3">
          <div><strong>{fmtNumber(dq.people_total)}</strong> unified customers
            <div className="kpi-card sub" style={{ padding: 0, border: "none", boxShadow: "none" }}>
              {fmtNumber(dq.people_overlap)} both · {fmtNumber(dq.people_json_only)} JSON-only · {fmtNumber(dq.people_yaml_only)} YAML-only
            </div>
          </div>
          <div><strong>{fmtPercent(dq.promo_match_rate, 1)}</strong> of promotions matched to a customer</div>
          <div><strong>{fmtPercent(dq.txn_match_rate, 1)}</strong> of store transactions matched by phone</div>
        </div>
      </div>

      <MethodologyPanel title="How I unified the data">
        <p>
          Five raw files in four formats (JSON, YAML, CSV, XML) were ingested with Pandas.
          The two customer sources had different schemas, so I normalized them
          (flattened nested location, split combined names, split combined city, converted
          device flags to a list) and outer-merged them on <code>id</code>. Where a customer
          appeared in both sources, JSON values won.
        </p>
        <pre><code>{`# matching.py
merged = json_df.merge(yaml_df, on="id", how="outer", suffixes=("", "_y"))
for col in ["first_name", "last_name", "email", "telephone", "city", "country", "dob"]:
    merged[col] = merged[col].combine_first(merged[col + "_y"])
    merged = merged.drop(columns=[col + "_y"])
# 1,002 rows: 228 in both, 705 JSON-only, 69 YAML-only`}</code></pre>
        <p>
          Promotions were linked to customers by email first, phone as fallback.
          Store transactions were linked by phone only (no email in the XML).
          Transfers were validated against the unified people table.
        </p>
      </MethodologyPanel>
    </>
  );
}
