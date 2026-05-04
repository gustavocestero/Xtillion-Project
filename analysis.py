"""All the business analysis. Pure functions: DataFrames in, DataFrames/dicts out."""

from __future__ import annotations

import pandas as pd


# ---------- promotions ----------

def response_rate_by_brand(promos: pd.DataFrame) -> pd.DataFrame:
    g = promos.groupby("promotion")["responded"].value_counts().unstack(fill_value=0)
    g["total"] = g.sum(axis=1)
    g["yes_rate"] = (g.get("Yes", 0) / g["total"]).round(4)
    return g.reset_index().rename(columns={"promotion": "brand"}).sort_values("yes_rate", ascending=False)

# alias used elsewhere
promo_by_brand = response_rate_by_brand


def response_rate_by_city(promos: pd.DataFrame, people: pd.DataFrame) -> pd.DataFrame:
    merged = promos.merge(people[["id", "city"]], left_on="person_id", right_on="id", how="left")
    g = merged.dropna(subset=["city"]).groupby("city")["responded"].value_counts().unstack(fill_value=0)
    g["total"] = g.sum(axis=1)
    g["yes_rate"] = (g.get("Yes", 0) / g["total"]).round(4)
    return g.reset_index().sort_values("yes_rate", ascending=False)


def response_rate_by_device(promos: pd.DataFrame, people: pd.DataFrame) -> pd.DataFrame:
    # explode the comma-joined devices string into one row per device
    p = people[["id", "devices"]].copy()
    p["devices"] = p["devices"].fillna("").str.split(",")
    p = p.explode("devices")
    p["devices"] = p["devices"].str.strip()
    p = p[p["devices"] != ""]

    merged = promos.merge(p, left_on="person_id", right_on="id", how="left")
    g = merged.dropna(subset=["devices"]).groupby("devices")["responded"].value_counts().unstack(fill_value=0)
    g["total"] = g.sum(axis=1)
    g["yes_rate"] = (g.get("Yes", 0) / g["total"]).round(4)
    return g.reset_index().rename(columns={"devices": "device"}).sort_values("yes_rate", ascending=False)


def fey_kuser_report(promos: pd.DataFrame) -> dict:
    """The fey_kuser email is an outlier — appears way more often than anyone else."""
    target = "fey_kuser@example.com"
    rows = promos[promos["client_email"].str.lower() == target]
    return {
        "email": target,
        "appearances": int(len(rows)),
        "yes_count": int((rows["responded"] == "Yes").sum()),
        "no_count": int((rows["responded"] == "No").sum()),
        "brands": sorted(rows["promotion"].dropna().unique().tolist()),
        "note": "Single email appears far more often than the typical 0–1 promos per customer. "
                "Likely a test account, data quality issue, or aggressive retargeting.",
    }


def retargeting_recs(promos: pd.DataFrame, people: pd.DataFrame, top_n: int = 10) -> pd.DataFrame:
    """Worst brand × city combos — best candidates for a different promo strategy."""
    merged = promos.merge(people[["id", "city"]], left_on="person_id", right_on="id", how="left")
    g = (
        merged.dropna(subset=["city"])
        .groupby(["promotion", "city"])["responded"]
        .value_counts()
        .unstack(fill_value=0)
    )
    g["total"] = g.sum(axis=1)
    g = g[g["total"] >= 3]  # need a few data points for the no-rate to be meaningful
    g["no_rate"] = (g.get("No", 0) / g["total"]).round(4)
    g = g.reset_index().rename(columns={"promotion": "brand"})
    return g.sort_values(["no_rate", "total"], ascending=[False, False]).head(top_n)


# ---------- stores ----------

def revenue_by_store(txns: pd.DataFrame) -> pd.DataFrame:
    g = txns.groupby("store").agg(
        revenue=("total_price", "sum"),
        items_sold=("quantity", "sum"),
        transactions=("transaction_id", "nunique"),
    ).reset_index().sort_values("revenue", ascending=False)
    g["revenue"] = g["revenue"].round(2)
    return g


def revenue_by_product(txns: pd.DataFrame) -> pd.DataFrame:
    g = txns.groupby("item_name").agg(
        revenue=("total_price", "sum"),
        units=("quantity", "sum"),
    ).reset_index().sort_values("revenue", ascending=False)
    g["revenue"] = g["revenue"].round(2)
    return g


def best_sellers(txns: pd.DataFrame) -> dict:
    by_units = txns.groupby("item_name")["quantity"].sum().sort_values(ascending=False)
    by_rev = txns.groupby("item_name")["total_price"].sum().sort_values(ascending=False)
    return {
        "by_units": [{"item": k, "units": int(v)} for k, v in by_units.head(5).items()],
        "by_revenue": [{"item": k, "revenue": round(float(v), 2)} for k, v in by_rev.head(5).items()],
    }


def basket_metrics(txns: pd.DataFrame) -> pd.DataFrame:
    per_txn = txns.groupby(["store", "transaction_id"]).agg(
        items=("quantity", "sum"),
        value=("total_price", "sum"),
    )
    g = per_txn.groupby("store").agg(
        avg_items_per_txn=("items", "mean"),
        avg_txn_value=("value", "mean"),
        txn_count=("items", "count"),
    ).reset_index()
    g["avg_items_per_txn"] = g["avg_items_per_txn"].round(2)
    g["avg_txn_value"] = g["avg_txn_value"].round(2)
    return g.sort_values("avg_txn_value", ascending=False)


def product_affinity(txns: pd.DataFrame, top_n: int = 10) -> pd.DataFrame:
    """Find products that get bought together via a self-join on transaction_id."""
    a = txns[["transaction_id", "item_name"]].drop_duplicates()
    pairs = a.merge(a, on="transaction_id")
    pairs = pairs[pairs["item_name_x"] < pairs["item_name_y"]]  # unordered pairs, no self-pairs
    if pairs.empty:
        return pd.DataFrame(columns=["product_a", "product_b", "co_purchases"])
    g = (
        pairs.groupby(["item_name_x", "item_name_y"])
        .size()
        .reset_index(name="co_purchases")
        .sort_values("co_purchases", ascending=False)
    )
    g = g.rename(columns={"item_name_x": "product_a", "item_name_y": "product_b"})
    return g.head(top_n)


# ---------- transfers ----------

def transfer_summary(transfers: pd.DataFrame) -> dict:
    valid = transfers[transfers["valid"]]
    return {
        "total_transfers": int(len(transfers)),
        "valid_transfers": int(len(valid)),
        "invalid_transfers": int((~transfers["valid"]).sum()),
        "total_volume": round(float(valid["amount"].sum()), 2),
        "avg_amount": round(float(valid["amount"].mean()), 2),
        "median_amount": round(float(valid["amount"].median()), 2),
        "max_amount": round(float(valid["amount"].max()), 2),
        "min_amount": round(float(valid["amount"].min()), 2),
        "zero_count": int((valid["amount"] == 0).sum()),
    }


def top_senders(transfers: pd.DataFrame, people: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    valid = transfers[transfers["valid"]]
    g = valid.groupby("sender_id").agg(total_sent=("amount", "sum"), count=("amount", "count")).reset_index()
    g = g.merge(people[["id", "first_name", "last_name", "city"]],
                left_on="sender_id", right_on="id", how="left").drop(columns=["id"])
    g["total_sent"] = g["total_sent"].round(2)
    return g.sort_values("total_sent", ascending=False).head(n)


def top_receivers(transfers: pd.DataFrame, people: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    valid = transfers[transfers["valid"]]
    g = valid.groupby("recipient_id").agg(total_received=("amount", "sum"), count=("amount", "count")).reset_index()
    g = g.merge(people[["id", "first_name", "last_name", "city"]],
                left_on="recipient_id", right_on="id", how="left").drop(columns=["id"])
    g["total_received"] = g["total_received"].round(2)
    return g.sort_values("total_received", ascending=False).head(n)


def monthly_trend(transfers: pd.DataFrame, txns: pd.DataFrame) -> pd.DataFrame:
    valid = transfers[transfers["valid"]].copy()
    valid["ym"] = valid["date"].dt.to_period("M").astype(str)
    tr = valid.groupby("ym")["amount"].sum().rename("transfer_total")

    t = txns.copy()
    t["ym"] = t["date"].dt.to_period("M").astype(str)
    tx = t.groupby("ym")["total_price"].sum().rename("transaction_total")

    df = pd.concat([tr, tx], axis=1).fillna(0).reset_index().rename(columns={"ym": "year_month"})
    df["transfer_total"] = df["transfer_total"].round(2)
    df["transaction_total"] = df["transaction_total"].round(2)
    return df.sort_values("year_month")


def transfer_outliers(transfers: pd.DataFrame) -> dict:
    valid = transfers[transfers["valid"]].copy()
    if valid.empty:
        return {"zero_transfers": [], "high_value": []}
    threshold = valid["amount"].quantile(0.99)
    high = valid[valid["amount"] >= threshold].sort_values("amount", ascending=False).head(10)
    zeros = valid[valid["amount"] == 0].head(10)

    def to_records(df):
        out = df.copy()
        out["date"] = out["date"].dt.strftime("%Y-%m-%d")
        out["sender_id"] = out["sender_id"].astype("Int64")
        out["recipient_id"] = out["recipient_id"].astype("Int64")
        return out[["sender_id", "recipient_id", "amount", "date"]].to_dict("records")

    return {
        "zero_transfers": to_records(zeros),
        "high_value": to_records(high),
        "p99_threshold": round(float(threshold), 2),
    }


def amount_distribution(transfers: pd.DataFrame) -> pd.DataFrame:
    valid = transfers[transfers["valid"]].copy()
    bins = [-0.01, 0, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000]
    labels = ["$0", "$0-50", "$50-100", "$100-250", "$250-500",
              "$500-1k", "$1k-2.5k", "$2.5k-5k", "$5k-10k", "$10k+"]
    valid["bucket"] = pd.cut(valid["amount"], bins=bins, labels=labels)
    g = valid.groupby("bucket", observed=False).size().reset_index(name="count")
    return g


# ---------- customers ----------

def customer_360(people: pd.DataFrame, promos: pd.DataFrame,
                 txns: pd.DataFrame, transfers: pd.DataFrame) -> pd.DataFrame:
    """One row per person with all activity rolled up."""
    p = people.copy()

    promo_agg = promos.dropna(subset=["person_id"]).groupby("person_id").agg(
        promo_count=("promotion", "count"),
        promo_yes=("responded", lambda s: (s == "Yes").sum()),
    )
    txn_agg = txns.dropna(subset=["person_id"]).groupby("person_id").agg(
        txn_count=("transaction_id", "nunique"),
        store_spend=("total_price", "sum"),
    )

    valid_tr = transfers[transfers["valid"]]
    sent_agg = valid_tr.groupby("sender_id").agg(
        sent_count=("amount", "count"),
        sent_total=("amount", "sum"),
    )
    recv_agg = valid_tr.groupby("recipient_id").agg(
        received_count=("amount", "count"),
        received_total=("amount", "sum"),
    )

    out = (p.set_index("id")
             .join(promo_agg, how="left")
             .join(txn_agg, how="left")
             .join(sent_agg, how="left")
             .join(recv_agg, how="left")
             .reset_index())

    fill_cols = ["promo_count", "promo_yes", "txn_count", "store_spend",
                 "sent_count", "sent_total", "received_count", "received_total"]
    for c in fill_cols:
        out[c] = out[c].fillna(0)

    out["store_spend"] = out["store_spend"].round(2)
    out["sent_total"] = out["sent_total"].round(2)
    out["received_total"] = out["received_total"].round(2)

    out["segment"] = out.apply(_segment, axis=1)
    return out


def _segment(row) -> str:
    has_store = row["store_spend"] > 0
    has_transfer = (row["sent_total"] + row["received_total"]) > 0
    has_promo = row["promo_count"] > 0
    promo_responder = row["promo_yes"] > 0

    if has_store and has_transfer:
        return "High-Value"
    if has_store:
        return "Store Shopper"
    if has_transfer:
        return "Transfer-Only"
    if promo_responder:
        return "Promo Responder"
    if has_promo:
        return "Promo-Only"
    return "Inactive"


def segment_summary(c360: pd.DataFrame) -> pd.DataFrame:
    g = c360.groupby("segment").agg(
        customers=("id", "count"),
        avg_store_spend=("store_spend", "mean"),
        avg_sent=("sent_total", "mean"),
        avg_received=("received_total", "mean"),
    ).reset_index().sort_values("customers", ascending=False)
    for c in ("avg_store_spend", "avg_sent", "avg_received"):
        g[c] = g[c].round(2)
    return g


# ---------- conversion (the headline) ----------

def promo_to_purchase_conversion(promos: pd.DataFrame, txns: pd.DataFrame) -> dict:
    """For each promo, did the customer subsequently buy that exact product?"""
    p = promos.dropna(subset=["person_id"]).copy()

    # build a set of (person_id, item_name) bought
    bought = set(
        zip(
            txns.dropna(subset=["person_id"])["person_id"].astype(int),
            txns.dropna(subset=["person_id"])["item_name"],
        )
    )

    p["converted"] = p.apply(
        lambda r: (int(r["person_id"]), r["promotion"]) in bought, axis=1
    )

    yes = p[p["responded"] == "Yes"]
    no = p[p["responded"] == "No"]

    yes_rate = round(float(yes["converted"].mean()), 4) if len(yes) else 0.0
    no_rate = round(float(no["converted"].mean()), 4) if len(no) else 0.0
    multiplier = round(yes_rate / no_rate, 2) if no_rate > 0 else None

    by_brand = (
        p.groupby(["promotion", "responded"])["converted"]
        .agg(["sum", "count"])
        .reset_index()
    )
    by_brand["rate"] = (by_brand["sum"] / by_brand["count"]).round(4)

    # pivot to one row per brand with yes_rate / no_rate
    pivot_rate = by_brand.pivot_table(
        index="promotion", columns="responded", values="rate", fill_value=0
    ).reset_index().rename(columns={"promotion": "brand", "Yes": "yes_rate", "No": "no_rate"})
    pivot_count = by_brand.pivot_table(
        index="promotion", columns="responded", values="count", fill_value=0
    ).reset_index().rename(columns={"promotion": "brand", "Yes": "yes_count", "No": "no_count"})
    brand_df = pivot_rate.merge(pivot_count, on="brand")

    return {
        "overall": {
            "yes_count": int(len(yes)),
            "no_count": int(len(no)),
            "yes_conversion_rate": yes_rate,
            "no_conversion_rate": no_rate,
            "multiplier": multiplier,
        },
        "by_brand": brand_df.to_dict("records"),
    }
