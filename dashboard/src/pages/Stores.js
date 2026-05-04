import React from "react";
import { Bar } from "react-chartjs-2";
import ChartCard from "../components/ChartCard";
import DataTable from "../components/DataTable";
import MethodologyPanel from "../components/MethodologyPanel";
import useJson from "../useJson";
import { fmtCurrency, fmtNumber, palette, baseChartOptions } from "../utils";

export default function Stores() {
  const { data, error } = useJson("/data/stores.json");
  if (error) return <div className="loading">Error: {error}</div>;
  if (!data) return <div className="loading">Loading…</div>;

  const storeChart = {
    labels: data.revenue_by_store.map((r) => r.store),
    datasets: [{
      label: "Revenue ($)",
      data: data.revenue_by_store.map((r) => r.revenue),
      backgroundColor: palette.primary,
    }],
  };

  const productChart = {
    labels: data.revenue_by_product.map((r) => r.item_name),
    datasets: [
      {
        label: "Revenue ($)",
        data: data.revenue_by_product.map((r) => r.revenue),
        backgroundColor: palette.primary,
      },
      {
        label: "Units sold",
        data: data.revenue_by_product.map((r) => r.units),
        backgroundColor: palette.success,
      },
    ],
  };

  return (
    <>
      <div className="page-header">
        <h1>Stores</h1>
        <p>Six stores, ten products. Where the money comes from.</p>
      </div>

      <div className="grid-2">
        <ChartCard title="Revenue by store">
          <Bar data={storeChart} options={baseChartOptions} />
        </ChartCard>
        <ChartCard title="Revenue & units by product">
          <Bar data={productChart} options={baseChartOptions} />
        </ChartCard>
      </div>

      <div className="card">
        <h2>Basket metrics per store</h2>
        <DataTable
          initialSort={{ key: "avg_txn_value", dir: "desc" }}
          columns={[
            { key: "store", label: "Store" },
            { key: "txn_count", label: "Transactions", format: fmtNumber },
            { key: "avg_items_per_txn", label: "Avg items / txn" },
            { key: "avg_txn_value", label: "Avg value", format: fmtCurrency },
          ]}
          rows={data.basket_metrics}
        />
      </div>

      <div className="card">
        <h2>Product affinity (bought together)</h2>
        <DataTable
          initialSort={{ key: "co_purchases", dir: "desc" }}
          columns={[
            { key: "product_a", label: "Product A" },
            { key: "product_b", label: "Product B" },
            { key: "co_purchases", label: "Co-purchases", format: fmtNumber },
          ]}
          rows={data.product_affinity}
        />
      </div>

      <MethodologyPanel title="How I did this">
        <p>
          The XML transactions file nests line items under each transaction, so the loader
          walks the tree and emits one row per item — turning nested data into a long-format
          DataFrame that Pandas can group by store, product, or basket easily.
        </p>
        <pre><code>{`# loaders.load_transactions
for txn in root.findall("transaction"):
    for item in txn.findall("./items/item"):
        rows.append({
            "transaction_id": txn.attrib["id"],
            "store": txn.findtext("store"),
            "phone": txn.findtext("phone"),
            "item_name": item.findtext("item"),
            "price_per_item": float(item.findtext("price_per_item")),
            "quantity": int(item.findtext("quantity")),
        })`}</code></pre>
        <p>
          Product affinity uses a self-join on <code>transaction_id</code> to find every
          pair of products that appeared in the same basket, deduplicating with a
          lexicographic order filter.
        </p>
        <pre><code>{`# analysis.product_affinity
pairs = a.merge(a, on="transaction_id")
pairs = pairs[pairs.item_name_x < pairs.item_name_y]   # unordered, no self-pairs
pairs.groupby(["item_name_x", "item_name_y"]).size()`}</code></pre>
      </MethodologyPanel>
    </>
  );
}
