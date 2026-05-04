"""Read each raw file into a clean DataFrame. One function per file."""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd
import yaml

DATA_DIR = Path(__file__).parent / "data"


def load_people_json(path: Path = DATA_DIR / "people.json") -> pd.DataFrame:
    with open(path) as f:
        rows = json.load(f)

    df = pd.DataFrame(rows)

    # flatten the nested location dict
    df["city"] = df["location"].apply(lambda d: d.get("City") if isinstance(d, dict) else None)
    df["country"] = df["location"].apply(lambda d: d.get("Country") if isinstance(d, dict) else None)
    df = df.drop(columns=["location"])

    # ids are zero-padded strings — make them ints so they line up with YAML/transfers
    df["id"] = pd.to_numeric(df["id"], errors="coerce").astype("Int64")
    df["dob"] = pd.to_datetime(df["dob"], format="%m/%d/%Y", errors="coerce")
    df["email"] = df["email"].str.lower().str.strip()
    df["telephone"] = df["telephone"].str.strip()

    # devices is a list — keep as comma-joined string for SQLite friendliness
    df["devices"] = df["devices"].apply(lambda x: ",".join(x) if isinstance(x, list) else "")

    df["source_json"] = True
    return df


def load_people_yaml(path: Path = DATA_DIR / "people.yml") -> pd.DataFrame:
    with open(path) as f:
        rows = yaml.safe_load(f)

    df = pd.DataFrame(rows)

    # split combined name into first/last
    name_parts = df["name"].fillna("").str.split(" ", n=1, expand=True)
    df["first_name"] = name_parts[0]
    df["last_name"] = name_parts[1].fillna("")

    # "Montreal, Canada" -> city + country
    city_parts = df["city"].fillna("").str.split(",", n=1, expand=True)
    df["city"] = city_parts[0].str.strip()
    df["country"] = city_parts[1].fillna("").str.strip()

    # binary flags -> list-style "Android,Iphone" string
    def to_devices(row):
        names = []
        for col in ("Android", "Iphone", "Desktop"):
            if int(row.get(col, 0) or 0) == 1:
                names.append(col)
        return ",".join(names)

    df["devices"] = df.apply(to_devices, axis=1)

    df = df.rename(columns={"phone": "telephone"})
    df["id"] = pd.to_numeric(df["id"], errors="coerce").astype("Int64")
    df["dob"] = pd.to_datetime(df["dob"], format="%B %d, %Y", errors="coerce")
    df["email"] = df["email"].str.lower().str.strip()
    df["telephone"] = df["telephone"].astype(str).str.strip()

    df = df.drop(columns=["name", "Android", "Iphone", "Desktop"])
    df["source_yaml"] = True
    return df


def load_promotions(path: Path = DATA_DIR / "promotions.csv") -> pd.DataFrame:
    df = pd.read_csv(path)
    df["client_email"] = df["client_email"].str.lower().str.strip()
    df["telephone"] = df["telephone"].astype(str).str.strip().replace({"nan": None})
    df["promotion"] = df["promotion"].str.strip()
    df["promotion_date"] = pd.to_datetime(df["promotion_date"], errors="coerce")
    return df


def load_transfers(path: Path = DATA_DIR / "transfers.csv") -> pd.DataFrame:
    df = pd.read_csv(path)
    # nullable ints — some senders/recipients are missing
    df["sender_id"] = pd.to_numeric(df["sender_id"], errors="coerce").astype("Int64")
    df["recipient_id"] = pd.to_numeric(df["recipient_id"], errors="coerce").astype("Int64")
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    return df


def load_transactions(path: Path = DATA_DIR / "transactions.xml") -> pd.DataFrame:
    """Parse XML and explode into long format — one row per line item."""
    tree = ET.parse(path)
    root = tree.getroot()

    rows = []
    for txn in root.findall("transaction"):
        txn_id = txn.attrib.get("id")
        phone = (txn.findtext("phone") or "").strip()
        store = (txn.findtext("store") or "").strip()
        date = txn.findtext("date")

        for item in txn.findall("./items/item"):
            rows.append({
                "transaction_id": int(txn_id) if txn_id else None,
                "phone": phone,
                "store": store,
                "date": date,
                "item_name": (item.findtext("item") or "").strip(),
                "price": float(item.findtext("price") or 0),
                "price_per_item": float(item.findtext("price_per_item") or 0),
                "quantity": int(item.findtext("quantity") or 0),
            })

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    # total_price = price already contains line total per the source, but recompute defensively
    df["total_price"] = df["price_per_item"] * df["quantity"]
    return df
