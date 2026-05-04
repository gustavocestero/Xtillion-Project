import React from "react";
import { Bar } from "react-chartjs-2";
import KpiCard from "../components/KpiCard";
import ChartCard from "../components/ChartCard";
import DataTable from "../components/DataTable";
import MethodologyPanel from "../components/MethodologyPanel";
import useJson from "../useJson";
import { fmtPercent, fmtNumber, palette, baseChartOptions } from "../utils";

export default function Conversion() {
  const { data, error } = useJson("/data/conversion.json");
  if (error) return <div className="loading">Error: {error}</div>;
  if (!data) return <div className="loading">Loading…</div>;

  const o = data.overall;

  const brandChart = {
    labels: data.by_brand.map((b) => b.brand),
    datasets: [
      {
        label: "Yes-respondents who bought",
        data: data.by_brand.map((b) => (b.yes_rate * 100).toFixed(1)),
        backgroundColor: palette.success,
      },
      {
        label: "No-respondents who bought",
        data: data.by_brand.map((b) => (b.no_rate * 100).toFixed(1)),
        backgroundColor: palette.gray,
      },
    ],
  };

  return (
    <>
      <div className="page-header">
        <h1>Promo → Purchase Conversion</h1>
        <p>The headline cross-analysis: do promotion responses actually translate to sales?</p>
      </div>

      <div className="hero">
        <div className="label">Customers who said "Yes" to a promotion are</div>
        <div className="big-number">{o.multiplier ? `${o.multiplier}×` : "—"}</div>
        <div className="sub">more likely to buy that promoted product than customers who said "No".</div>
      </div>

      <div className="kpi-grid">
        <KpiCard label='"Yes" conversion rate'
                 value={fmtPercent(o.yes_conversion_rate)}
                 sub={`${fmtNumber(o.yes_count)} promo responses`} />
        <KpiCard label='"No" conversion rate'
                 value={fmtPercent(o.no_conversion_rate)}
                 sub={`${fmtNumber(o.no_count)} promo responses`} />
        <KpiCard label="Lift multiplier"
                 value={o.multiplier ? `${o.multiplier}×` : "—"}
                 sub="Yes vs No purchase rate" />
      </div>

      <ChartCard title="Conversion rate by brand: Yes vs No respondents">
        <Bar data={brandChart} options={baseChartOptions} />
      </ChartCard>

      <div className="card">
        <h2>What this means for Venmito</h2>
        <p>
          Promotion responses aren't just engagement noise — they're a real purchase signal.
          A "Yes" predicts a roughly <b>{o.multiplier}×</b> higher chance of actually buying
          the promoted product compared to a "No". That makes promo-Yes responders the
          obvious top priority for follow-up campaigns and upsell, and it justifies investing
          in better attribution between the promotions stream and the in-store transactions.
        </p>
      </div>

      <div className="card">
        <h2>Per-brand breakdown</h2>
        <DataTable
          initialSort={{ key: "yes_rate", dir: "desc" }}
          columns={[
            { key: "brand", label: "Brand" },
            { key: "yes_count", label: "Yes responses", format: fmtNumber },
            { key: "yes_rate",  label: "Yes → bought", format: (v) => fmtPercent(v) },
            { key: "no_count",  label: "No responses",  format: fmtNumber },
            { key: "no_rate",   label: "No → bought",   format: (v) => fmtPercent(v) },
          ]}
          rows={data.by_brand}
        />
      </div>

      <MethodologyPanel title="How I did this">
        <p>
          The 10 brands in the promotions file are the same 10 product names in the store
          transactions. That's the bridge: for every promotion sent to a customer, I can
          check whether they later showed up in the transactions for that exact product.
        </p>
        <pre><code>{`# analysis.promo_to_purchase_conversion
bought = set(zip(txns["person_id"], txns["item_name"]))

promos["converted"] = promos.apply(
    lambda r: (int(r.person_id), r.promotion) in bought, axis=1
)

yes_rate = promos[promos.responded == "Yes"]["converted"].mean()
no_rate  = promos[promos.responded == "No"]["converted"].mean()
multiplier = yes_rate / no_rate`}</code></pre>
        <p>
          Using a set lookup keeps the inner check O(1) — fast even on the full
          customer × product matrix.
        </p>
      </MethodologyPanel>
    </>
  );
}
