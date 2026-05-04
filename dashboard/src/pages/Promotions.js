import React from "react";
import { Bar } from "react-chartjs-2";
import ChartCard from "../components/ChartCard";
import DataTable from "../components/DataTable";
import MethodologyPanel from "../components/MethodologyPanel";
import useJson from "../useJson";
import { fmtNumber, fmtPercent, palette, baseChartOptions } from "../utils";

export default function Promotions() {
  const { data, error } = useJson("/data/promotions.json");
  if (error) return <div className="loading">Error: {error}</div>;
  if (!data) return <div className="loading">Loading…</div>;

  const brandRate = {
    labels: data.response_by_brand.map((r) => r.brand),
    datasets: [{
      label: "Yes rate",
      data: data.response_by_brand.map((r) => (r.yes_rate * 100).toFixed(1)),
      backgroundColor: palette.primary,
    }],
  };

  const brandCount = {
    labels: data.response_by_brand.map((r) => r.brand),
    datasets: [
      { label: "Yes", data: data.response_by_brand.map((r) => r.Yes || 0), backgroundColor: palette.success },
      { label: "No",  data: data.response_by_brand.map((r) => r.No  || 0), backgroundColor: palette.gray },
    ],
  };

  const fey = data.fey_kuser_report;

  return (
    <>
      <div className="page-header">
        <h1>Promotions</h1>
        <p>Ten brands, 236 promotions. Which campaigns landed and which didn't.</p>
      </div>

      <div className="grid-2">
        <ChartCard title="Yes-rate by brand">
          <Bar data={brandRate} options={baseChartOptions} />
        </ChartCard>
        <ChartCard title="Yes vs No count by brand">
          <Bar data={brandCount} options={{
            ...baseChartOptions,
            scales: { ...baseChartOptions.scales, x: { ...baseChartOptions.scales.x, stacked: false }, y: { ...baseChartOptions.scales.y, stacked: false } },
          }} />
        </ChartCard>
      </div>

      <div className="callout callout-warning">
        <strong>⚠ Anomaly: {fey.email}</strong>
        Appears <b>{fey.appearances}× </b> in the promotions file
        ({fey.yes_count} Yes, {fey.no_count} No) across {fey.brands.length} brands —
        far above the typical 0–1 promos per customer. {fey.note}
      </div>

      <div className="card">
        <h2>Response rate by city</h2>
        <DataTable
          searchable
          initialSort={{ key: "yes_rate", dir: "desc" }}
          columns={[
            { key: "city", label: "City" },
            { key: "Yes", label: "Yes", format: fmtNumber },
            { key: "No",  label: "No",  format: fmtNumber },
            { key: "total", label: "Total", format: fmtNumber },
            { key: "yes_rate", label: "Yes rate", format: (v) => fmtPercent(v) },
          ]}
          rows={data.response_by_city}
        />
      </div>

      <div className="card">
        <h2>Response rate by device</h2>
        <DataTable
          initialSort={{ key: "yes_rate", dir: "desc" }}
          columns={[
            { key: "device", label: "Device" },
            { key: "Yes", label: "Yes", format: fmtNumber },
            { key: "No",  label: "No",  format: fmtNumber },
            { key: "total", label: "Total", format: fmtNumber },
            { key: "yes_rate", label: "Yes rate", format: (v) => fmtPercent(v) },
          ]}
          rows={data.response_by_device}
        />
      </div>

      <div className="card">
        <h2>Retargeting recommendations</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: -8 }}>
          Worst brand × city combos (≥3 promos sent). Try a different angle here.
        </p>
        <DataTable
          initialSort={{ key: "no_rate", dir: "desc" }}
          columns={[
            { key: "brand", label: "Brand" },
            { key: "city", label: "City" },
            { key: "No", label: "No", format: fmtNumber },
            { key: "Yes", label: "Yes", format: fmtNumber },
            { key: "total", label: "Sent", format: fmtNumber },
            { key: "no_rate", label: "No rate", format: (v) => fmtPercent(v) },
          ]}
          rows={data.retargeting_recs}
        />
      </div>

      <MethodologyPanel title="How I did this">
        <p>
          Each promotion record has either an email or a phone (sometimes both, sometimes
          one missing). I linked them to a unified customer with email first, phone as
          fallback — that gets to 100% match coverage.
        </p>
        <pre><code>{`# matching.link_promotions
by_email = promos.client_email.map(email_to_id)
by_phone = promos.telephone.map(phone_to_id)
promos["person_id"] = by_email.combine_first(by_phone)`}</code></pre>
        <p>
          Response rates are <code>responded == "Yes"</code> grouped by brand / city / device.
          The fey_kuser anomaly was caught with a simple frequency count on the email column.
        </p>
      </MethodologyPanel>
    </>
  );
}
