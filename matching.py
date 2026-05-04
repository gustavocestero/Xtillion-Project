"""Merge the two people sources and link the activity files back to a person_id."""

import pandas as pd


def merge_people(json_df: pd.DataFrame, yaml_df: pd.DataFrame) -> pd.DataFrame:
    """Outer-merge the two customer files on id. JSON wins on overlap."""
    # mark sources before the merge so we don't lose them
    j = json_df.copy()
    y = yaml_df.copy()

    # outer join — we want every id from either side
    merged = j.merge(y, on="id", how="outer", suffixes=("", "_y"))

    # for every overlapping column, prefer JSON, fall back to YAML
    for col in ["first_name", "last_name", "telephone", "email",
                "city", "country", "dob", "devices"]:
        ycol = f"{col}_y"
        if ycol in merged.columns:
            merged[col] = merged[col].combine_first(merged[ycol])
            merged = merged.drop(columns=[ycol])

    merged["source_json"] = merged["source_json"].fillna(False).astype(bool)
    merged["source_yaml"] = merged["source_yaml"].fillna(False).astype(bool)

    def tag(row):
        if row["source_json"] and row["source_yaml"]:
            return "both"
        if row["source_json"]:
            return "json"
        return "yaml"

    merged["source"] = merged.apply(tag, axis=1)
    merged = merged.sort_values("id").reset_index(drop=True)
    return merged


def link_promotions(promos_df: pd.DataFrame, people_df: pd.DataFrame) -> pd.DataFrame:
    """Attach person_id to each promo. Email match first, phone fallback."""
    p = promos_df.copy()

    email_to_id = (
        people_df.dropna(subset=["email"])
        .drop_duplicates("email")
        .set_index("email")["id"]
    )
    phone_to_id = (
        people_df.dropna(subset=["telephone"])
        .drop_duplicates("telephone")
        .set_index("telephone")["id"]
    )

    by_email = p["client_email"].map(email_to_id)
    by_phone = p["telephone"].map(phone_to_id)
    p["person_id"] = by_email.combine_first(by_phone).astype("Int64")

    unmatched = p["person_id"].isna().sum()
    if unmatched:
        print(f"[link_promotions] {unmatched} promos could not be linked to a person")
    return p


def link_transactions(txns_df: pd.DataFrame, people_df: pd.DataFrame) -> pd.DataFrame:
    """Phone-only linkage for store transactions."""
    t = txns_df.copy()
    phone_to_id = (
        people_df.dropna(subset=["telephone"])
        .drop_duplicates("telephone")
        .set_index("telephone")["id"]
    )
    t["person_id"] = t["phone"].map(phone_to_id).astype("Int64")

    unmatched_phones = t.loc[t["person_id"].isna(), "phone"].nunique()
    if unmatched_phones:
        print(f"[link_transactions] {unmatched_phones} unique phones did not match any person")
    return t


def flag_transfers(transfers_df: pd.DataFrame, people_df: pd.DataFrame) -> pd.DataFrame:
    """Mark which transfers have valid sender + recipient ids that exist in people."""
    t = transfers_df.copy()
    valid_ids = set(people_df["id"].dropna().astype(int).tolist())

    def is_valid(row):
        s, r = row["sender_id"], row["recipient_id"]
        if pd.isna(s) or pd.isna(r):
            return False
        return int(s) in valid_ids and int(r) in valid_ids

    t["valid"] = t.apply(is_valid, axis=1)
    invalid = (~t["valid"]).sum()
    if invalid:
        print(f"[flag_transfers] {invalid} transfers flagged invalid (missing or unknown ids)")
    return t
