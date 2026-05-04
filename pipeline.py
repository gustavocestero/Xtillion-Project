"""End-to-end pipeline: load -> merge -> link -> persist -> analyze -> export."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pandas as pd

import analysis
from loaders import (
    load_people_json, load_people_yaml, load_promotions,
    load_transfers, load_transactions,
)
from matching import merge_people, link_promotions, link_transactions, flag_transfers


ROOT = Path(__file__).parent
DB_PATH = ROOT / "venmito.db"
EXPORT_DIR = ROOT / "dashboard" / "public" / "data"


def _to_records(df: pd.DataFrame) -> list[dict]:
    """JSON-safe dict records: convert NaT/NaN, format dates."""
    out = df.copy()
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = out[col].dt.strftime("%Y-%m-%d")
    out = out.where(pd.notna(out), None)
    return out.to_dict("records")


def _write_json(name: str, payload) -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / name
    with open(path, "w") as f:
        json.dump(payload, f, indent=2, default=str)
    print(f"  wrote {path.relative_to(ROOT)}")


def main() -> None:
    print("== Loading raw files ==")
    people_json = load_people_json()
    people_yaml = load_people_yaml()
    promos      = load_promotions()
    transfers   = load_transfers()
    txns        = load_transactions()
    print(f"  people.json: {len(people_json)} rows")
    print(f"  people.yml:  {len(people_yaml)} rows")
    print(f"  promotions:  {len(promos)} rows")
    print(f"  transfers:   {len(transfers)} rows")
    print(f"  transactions:{len(txns)} line items")

    print("\n== Merging people ==")
    people = merge_people(people_json, people_yaml)
    print(f"  unified people: {len(people)} rows "
          f"(both={ (people['source']=='both').sum() }, "
          f"json-only={ (people['source']=='json').sum() }, "
          f"yaml-only={ (people['source']=='yaml').sum() })")

    print("\n== Linking activity to people ==")
    promos = link_promotions(promos, people)
    txns   = link_transactions(txns, people)
    transfers = flag_transfers(transfers, people)

    promo_match = promos["person_id"].notna().mean() * 100
    txn_match   = txns["person_id"].notna().mean() * 100
    print(f"  promos linked:       {promo_match:.1f}%")
    print(f"  transactions linked: {txn_match:.1f}%")

    print("\n== Persisting to SQLite ==")
    con = sqlite3.connect(DB_PATH)
    # narrow people down to the columns we actually care about
    people_db = people[["id", "first_name", "last_name", "email", "telephone",
                        "city", "country", "devices", "dob", "source"]].copy()
    people_db["dob"] = people_db["dob"].dt.strftime("%Y-%m-%d")

    people_db.to_sql("people", con, if_exists="replace", index=False)
    promos.to_sql("promotions", con, if_exists="replace", index=False)
    txns.to_sql("transactions", con, if_exists="replace", index=False)
    transfers.to_sql("transfers", con, if_exists="replace", index=False)
    print(f"  -> {DB_PATH.name}")

    print("\n== Running analysis ==")
    rev_store   = analysis.revenue_by_store(txns)
    rev_product = analysis.revenue_by_product(txns)
    bestsell    = analysis.best_sellers(txns)
    baskets     = analysis.basket_metrics(txns)
    affinity    = analysis.product_affinity(txns)

    promo_brand  = analysis.response_rate_by_brand(promos)
    promo_city   = analysis.response_rate_by_city(promos, people)
    promo_device = analysis.response_rate_by_device(promos, people)
    fey          = analysis.fey_kuser_report(promos)
    retarget     = analysis.retargeting_recs(promos, people)

    tr_summary   = analysis.transfer_summary(transfers)
    tr_top_send  = analysis.top_senders(transfers, people)
    tr_top_recv  = analysis.top_receivers(transfers, people)
    tr_monthly   = analysis.monthly_trend(transfers, txns)
    tr_outliers  = analysis.transfer_outliers(transfers)
    tr_dist      = analysis.amount_distribution(transfers)

    c360         = analysis.customer_360(people, promos, txns, transfers)
    seg_summary  = analysis.segment_summary(c360)
    conversion   = analysis.promo_to_purchase_conversion(promos, txns)

    # also persist derived tables for the technical user
    c360_db = c360.copy()
    c360_db["dob"] = c360_db["dob"].dt.strftime("%Y-%m-%d")
    c360_db.to_sql("customer_360", con, if_exists="replace", index=False)
    seg_summary.to_sql("segments", con, if_exists="replace", index=False)
    con.close()

    print("\n== Exporting JSON for dashboard ==")
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    _write_json("overview.json", {
        "kpis": {
            "total_customers": int(len(people)),
            "transfer_volume": tr_summary["total_volume"],
            "store_revenue": round(float(txns["total_price"].sum()), 2),
            "promo_response_rate": round(float((promos["responded"] == "Yes").mean()), 4),
        },
        "monthly_activity": _to_records(tr_monthly),
        "data_quality": {
            "people_total": int(len(people)),
            "people_overlap": int((people["source"] == "both").sum()),
            "people_json_only": int((people["source"] == "json").sum()),
            "people_yaml_only": int((people["source"] == "yaml").sum()),
            "promo_match_rate": round(float(promo_match) / 100, 4),
            "txn_match_rate": round(float(txn_match) / 100, 4),
            "transfers_invalid": tr_summary["invalid_transfers"],
        },
    })

    _write_json("stores.json", {
        "revenue_by_store": _to_records(rev_store),
        "revenue_by_product": _to_records(rev_product),
        "best_sellers": bestsell,
        "basket_metrics": _to_records(baskets),
        "product_affinity": _to_records(affinity),
    })

    _write_json("promotions.json", {
        "response_by_brand": _to_records(promo_brand),
        "response_by_city": _to_records(promo_city),
        "response_by_device": _to_records(promo_device),
        "fey_kuser_report": fey,
        "retargeting_recs": _to_records(retarget),
    })

    _write_json("transfers.json", {
        "summary": tr_summary,
        "top_senders": _to_records(tr_top_send),
        "top_receivers": _to_records(tr_top_recv),
        "monthly_trend": _to_records(tr_monthly),
        "outliers": tr_outliers,
        "amount_distribution": _to_records(tr_dist),
    })

    # customer list — slimmed down for the search/list view
    c360_export = c360[[
        "id", "first_name", "last_name", "email", "city", "country",
        "devices", "promo_count", "promo_yes", "txn_count", "store_spend",
        "sent_total", "received_total", "segment",
    ]].copy()
    _write_json("customers.json", {
        "customer_360": _to_records(c360_export),
        "segment_summary": _to_records(seg_summary),
    })

    # one entry per person — full activity for the explorer
    profiles = {}
    promos_no_id = promos.dropna(subset=["person_id"]).copy()
    txns_no_id   = txns.dropna(subset=["person_id"]).copy()
    valid_tr     = transfers[transfers["valid"]].copy()

    promos_no_id["person_id"] = promos_no_id["person_id"].astype(int)
    txns_no_id["person_id"]   = txns_no_id["person_id"].astype(int)

    for _, person in c360.iterrows():
        pid = int(person["id"])
        my_promos = promos_no_id[promos_no_id["person_id"] == pid][
            ["promotion", "responded", "promotion_date"]
        ]
        my_txns = txns_no_id[txns_no_id["person_id"] == pid][
            ["store", "item_name", "quantity", "total_price", "date"]
        ]
        my_sent = valid_tr[valid_tr["sender_id"] == pid][
            ["recipient_id", "amount", "date"]
        ].copy()
        my_sent["direction"] = "sent"
        my_sent = my_sent.rename(columns={"recipient_id": "counterparty_id"})
        my_recv = valid_tr[valid_tr["recipient_id"] == pid][
            ["sender_id", "amount", "date"]
        ].copy()
        my_recv["direction"] = "received"
        my_recv = my_recv.rename(columns={"sender_id": "counterparty_id"})
        my_transfers = pd.concat([my_sent, my_recv], ignore_index=True)
        if not my_transfers.empty:
            my_transfers = my_transfers.sort_values("date")

        profiles[str(pid)] = {
            "info": {
                "id": pid,
                "name": f"{person['first_name'] or ''} {person['last_name'] or ''}".strip(),
                "email": person["email"],
                "telephone": person["telephone"],
                "city": person["city"],
                "country": person["country"],
                "devices": person["devices"],
                "segment": person["segment"],
            },
            "promos": _to_records(my_promos),
            "transactions": _to_records(my_txns),
            "transfers": _to_records(my_transfers),
        }
    _write_json("customer_profiles.json", profiles)

    _write_json("conversion.json", conversion)

    print("\n== Key findings ==")
    print(f"  Total customers: {len(people)}")
    print(f"  Total store revenue: ${txns['total_price'].sum():,.2f}")
    print(f"  Total transfer volume: ${tr_summary['total_volume']:,.2f}")
    print(f"  Overall promo response rate: {(promos['responded'] == 'Yes').mean():.1%}")
    overall = conversion["overall"]
    print(f"  Promo conversion: Yes={overall['yes_conversion_rate']:.1%} "
          f"vs No={overall['no_conversion_rate']:.1%} "
          f"(multiplier={overall['multiplier']}x)")
    print(f"  fey_kuser appears {fey['appearances']} times — flagged as anomaly")

    print("\nDone.")


if __name__ == "__main__":
    main()
