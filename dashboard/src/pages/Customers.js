import React, { useState } from "react";
import CustomerSearch from "../components/CustomerSearch";
import DataTable from "../components/DataTable";
import MethodologyPanel from "../components/MethodologyPanel";
import useJson from "../useJson";
import { fmtCurrency, fmtNumber } from "../utils";

export default function Customers() {
  const { data: list }     = useJson("/data/customers.json");
  const { data: profiles } = useJson("/data/customer_profiles.json");
  const [selected, setSelected] = useState(null);

  if (!list || !profiles) return <div className="loading">Loading…</div>;

  const profile = selected ? profiles[String(selected.id)] : null;

  return (
    <>
      <div className="page-header">
        <h1>Customers</h1>
        <p>{fmtNumber(list.customer_360.length)} unified customer profiles. Search by name, ID, email, or city.</p>
      </div>

      <CustomerSearch customers={list.customer_360} onSelect={setSelected} />

      <div className="card">
        <h2>Segments</h2>
        <DataTable
          initialSort={{ key: "customers", dir: "desc" }}
          columns={[
            { key: "segment", label: "Segment" },
            { key: "customers", label: "Customers", format: fmtNumber },
            { key: "avg_store_spend", label: "Avg store spend", format: fmtCurrency },
            { key: "avg_sent", label: "Avg sent", format: fmtCurrency },
            { key: "avg_received", label: "Avg received", format: fmtCurrency },
          ]}
          rows={list.segment_summary}
        />
      </div>

      {profile && (
        <div className="card">
          <div className="profile-header">
            <div>
              <h2>{profile.info.name || "—"}</h2>
              <div className="meta">
                #{profile.info.id} · {profile.info.email || "no email"} ·{" "}
                {profile.info.telephone || "no phone"} ·{" "}
                {profile.info.city || "—"}, {profile.info.country || "—"} ·{" "}
                {profile.info.devices || "no devices"}
              </div>
            </div>
            <span className="segment-badge">{profile.info.segment}</span>
          </div>

          <h3>Promotions ({profile.promos.length})</h3>
          {profile.promos.length === 0 ? <p className="empty">No promotions.</p> : (
            <DataTable
              columns={[
                { key: "promotion", label: "Brand" },
                { key: "responded", label: "Responded" },
                { key: "promotion_date", label: "Date" },
              ]}
              rows={profile.promos}
            />
          )}

          <h3 style={{ marginTop: 24 }}>Store purchases ({profile.transactions.length})</h3>
          {profile.transactions.length === 0 ? <p className="empty">No purchases.</p> : (
            <DataTable
              columns={[
                { key: "store", label: "Store" },
                { key: "item_name", label: "Item" },
                { key: "quantity", label: "Qty" },
                { key: "total_price", label: "Total", format: fmtCurrency },
                { key: "date", label: "Date" },
              ]}
              rows={profile.transactions}
            />
          )}

          <h3 style={{ marginTop: 24 }}>Transfers ({profile.transfers.length})</h3>
          {profile.transfers.length === 0 ? <p className="empty">No transfers.</p> : (
            <DataTable
              columns={[
                { key: "direction", label: "Direction" },
                { key: "counterparty_id", label: "Counterparty ID" },
                { key: "amount", label: "Amount", format: fmtCurrency },
                { key: "date", label: "Date" },
              ]}
              rows={profile.transfers}
            />
          )}
        </div>
      )}

      <MethodologyPanel title="How I did this">
        <p>
          The 360° view is a left-join of the unified people table to per-customer
          aggregations of promotions, store purchases, and transfers. The segment
          column applies a small rule-based classifier — straightforward, defensible,
          and easy to tune.
        </p>
        <pre><code>{`# analysis.customer_360
out = (people.set_index("id")
              .join(promo_agg, how="left")
              .join(txn_agg, how="left")
              .join(sent_agg, how="left")
              .join(recv_agg, how="left"))

def segment(row):
    if row.store_spend > 0 and row.sent_total + row.received_total > 0:
        return "High-Value"
    if row.store_spend > 0:                   return "Store Shopper"
    if row.sent_total + row.received_total:   return "Transfer-Only"
    if row.promo_yes > 0:                     return "Promo Responder"
    if row.promo_count > 0:                   return "Promo-Only"
    return "Inactive"`}</code></pre>
      </MethodologyPanel>
    </>
  );
}
