# Venmito

**Gustavo Cestero** · [gcestero456@gmail.com]

This is the project I built for the Venmito data engineering exercise. The original brief from Xtillion is in [README.md](README.md); this file is for whoever is grading it.

---

## TL;DR

Five raw files, four formats, no unified view of the customer. I wrote a Pandas pipeline that pulls everything together, drops it into SQLite, and exports the analysis as JSON. Then I built a small React dashboard on top to show the results.

The most interesting finding: **customers who say "Yes" to a promotion are about 3× more likely to actually buy that product than customers who said "No"**. That's the headline page in the dashboard.

```
loaders.py  ┐
matching.py ├──► venmito.db (SQLite)            ◄── technical consumer
analysis.py │
pipeline.py └──► dashboard/public/data/*.json ──► React dashboard ◄── non-technical consumer
```

The brief asks for at least two consumption methods. The SQLite file is for anyone with a SQL client. The dashboard at `http://localhost:3000` is for everyone else.

---

## How to run it

You'll need **Python 3.9+** and **Node 16+**.

```bash
# 1. Pipeline — produces venmito.db and the JSON files the dashboard reads
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python pipeline.py
```

You should see this at the end:

```
== Key findings ==
  Total customers: 1002
  Total store revenue: $2,530.00
  Total transfer volume: $55,472.02
  Overall promo response rate: 47.5%
  Promo conversion: Yes=21.4% vs No=7.3% (multiplier=2.95x)
```

Tests (optional):

```bash
pytest -q     # 7 passed
```

```bash
# 2. Dashboard
cd dashboard
npm install
npm start
```

Open http://localhost:3000.

The pipeline is idempotent — every `df.to_sql` is `if_exists="replace"`, so re-running it just rewrites the artifacts.

---

## How I approached it

I read every file by hand first. A few things stood out:

- The two customer files have different schemas but share an `id`. JSON has 933 rows, YAML has 297, and 228 of them overlap. So an outer join on `id` gives me 1,002 unique people.
- JSON has a nested `location` object, a list of `devices`, and zero-padded string IDs. YAML has a single combined name, a `"City, Country"` string, three binary device flags (`Android`/`Iphone`/`Desktop`), and integer IDs. None of that lines up out of the box, so the loaders normalize first and the merge happens on a common shape.
- Promotions have an email or a phone (sometimes both). I match on email first and fall back to phone — gets me 100% coverage.
- Transactions only carry a phone number. Phone-only matching gets ~98.6%, with 4 unique phones unmatched. Logged but not dropped.
- 15 transfers have a missing sender or recipient. Flagged with a `valid` boolean and kept in SQLite, but excluded from analytics.

The thing that made the project click for me: the **10 promotion brands are exactly the same 10 product names** in the transactions file. That's not a coincidence — it's the bridge that lets you ask the actual interesting question. *Did the people who said "Yes" to a promo actually go and buy the product?* Once I noticed that, the conversion analysis became the obvious headline.

### Why this architecture

I split the project in two on purpose. Pandas is the right tool for the data work — joins, group-bys, reshape — and React is the right tool for the UI. Keeping them separate means the dashboard is fully self-contained: no Python server running in the background, just static JSON. It also meant I could lean on each side's strengths without compromising either.

The methodology panels on every page were a deliberate choice too. Without them the React side would feel disconnected from the Pandas work. With them, you can click "How I did this" on any page and see a short explanation plus the actual snippet of analysis code that produced what's on screen.

---

## Tech stack

**Python**
- pandas — does basically all the work
- pyyaml — for the YAML file
- pytest — sanity tests
- sqlite3, json, xml.etree — all stdlib

**React**
- Create React App
- react-router-dom — page navigation
- chart.js + react-chartjs-2 — interactive charts
- Plain CSS (one stylesheet, custom properties for the palette). No Bootstrap, no Material UI, no Tailwind. Wanted the dashboard to look like a design choice rather than something assembled from a library.

`requirements.txt` has 3 entries. `dashboard/package.json` has 4 runtime deps. Kept it tight.

---

## Project layout

```
README.md                  ← original client brief, untouched
MY_README.md               ← this file
requirements.txt
pytest.ini

data/                      ← raw files, untouched
  people.json
  people.yml
  promotions.csv
  transfers.csv
  transactions.xml

loaders.py                 ← one function per raw file → clean DataFrame
matching.py                ← merge_people, link_promotions, link_transactions, flag_transfers
analysis.py                ← all metrics; pure functions, DataFrames in / out
pipeline.py                ← orchestrator
tests/test_pipeline.py

venmito.db                 ← (generated) SQLite, 6 tables

dashboard/
  package.json
  public/
    index.html
    data/                  ← (generated) one JSON file per dashboard page
  src/
    index.js, App.js, App.css, utils.js, useJson.js
    pages/                 ← Overview, Stores, Promotions, Transfers, Customers, Conversion
    components/            ← Sidebar, KpiCard, ChartCard, DataTable, MethodologyPanel, CustomerSearch
```

---

## Unification logic

| Step | What I did | Result |
|---|---|---|
| Merge people | Outer-join JSON and YAML on `id`. For shared columns (name, email, phone, city, country, dob, devices), JSON wins, YAML fills the gaps. Each row tagged with `source` ∈ `{both, json, yaml}`. | 1,002 customers (228 both, 705 JSON-only, 69 YAML-only) |
| Link promotions | Email-first (lowercased on both sides), phone fallback | 100% match |
| Link transactions | Phone-only (no email in the XML) | ~98.6% — 4 phones unmatched, logged |
| Validate transfers | Both sender and recipient must exist in the people table; add `valid` boolean | 15 invalid, kept in DB but filtered from analytics |
| `fey_kuser` anomaly | Frequency count on `client_email` flagged `fey_kuser@example.com` appearing 12× vs. typical 0–1 | Surfaced as a warning callout in the UI |

### Database tables

| Table | Rows | What's in it |
|---|---|---|
| `people` | 1,002 | id, name, email, phone, city, country, devices, dob, source |
| `promotions` | 236 | original columns + `person_id` |
| `transactions` | 360 | one row per line item + `person_id` |
| `transfers` | 614 | original columns + `valid` |
| `customer_360` | 1,002 | one row per person, all activity rolled up + segment |
| `segments` | 6 | per-segment counts and averages |

---

## Findings

### Headline — promo → purchase conversion

| | Conversion |
|---|---|
| Said **Yes** to a promo | **21.4%** |
| Said **No** to a promo | **7.3%** |
| **Lift** | **~3×** |

What this means in plain language: a "Yes" on a promotion isn't just engagement noise — it actually predicts a purchase. So the obvious next step for Venmito is to prioritize Yes-responders for follow-up campaigns instead of treating all promo recipients the same way.

### Other things worth flagging

- **Stores** — $2,530 total revenue across 6 stores. Top store is Trader Tales ($606, 53 transactions). Top product is Flixnet ($643, 63 units). The dataset is small but the patterns are clear.
- **Transfers** — $55,472 across 599 valid transfers. Heavily skewed: median is $27 but the max is $15,000. P99 is the more useful threshold for "outlier".
- **Promotions** — 47.5% overall response rate. Top brand by yes-rate is Popsi at 60% (15 of 25). The retargeting recommendations table on the Promotions page surfaces the brand × city combos with the worst response rates — those are the obvious places to try a different angle, which addresses the "how do you turn No into Yes?" question from the brief.
- **Segments** — 478 Transfer-Only, 291 Inactive, 100 High-Value, 72 Promo-Only, 53 Store Shopper, 8 Promo Responder. The 291 Inactive customers (~30% of the base) are the biggest re-engagement opportunity in the dataset.

### Data quality issues

| Issue | Count | What I did |
|---|---|---|
| Customers in only one source | 774 | Kept all of them via outer join |
| Promo records with no email | many | Phone fallback; ends up at 100% match |
| Unmatched transaction phones | 4 unique | Logged a warning, person_id stays null |
| Invalid transfers (missing IDs) | 15 | `valid=False`, kept in DB, filtered from analytics |
| `fey_kuser@example.com` | 12 occurrences | Surfaced as a warning callout in the UI |

Nothing was silently dropped.

---

## Dashboard tour

`http://localhost:3000`. Sidebar nav on the left, six pages.

- **Overview** — Four KPI cards, monthly activity chart, data quality snapshot. Methodology panel covers the people merge.
- **Stores** — Revenue by store and by product, basket metrics table, product affinity table (which products get bought in the same basket — done with a self-join on `transaction_id`).
- **Promotions** — Yes-rate by brand, Yes/No counts, per-city table (sortable + searchable), per-device table, retargeting recs. The fey_kuser anomaly gets its own yellow warning callout.
- **Transfers** — Volume KPIs, monthly line chart, amount distribution, top-10 senders / top-10 receivers side by side, outliers callout.
- **Customers** — Debounced search by name, ID, email, or city. Pick someone and you get their full profile: info card with segment badge, then their promotions, store purchases, and transfers.
- **Conversion** — The headline page. Big hero with the 3× number, three KPI cards, per-brand grouped bar chart, plain-English interpretation, per-brand sortable table.

Every analysis page has a collapsible **"How I did this"** panel — closed by default, click to expand, shows a short explanation plus the actual Pandas snippet behind that page.

---

## What I'd do with more time

- Replace the static JSON layer with a small Flask or FastAPI service so the dashboard talks to a live API.
- Date-range filtering across the pages.
- k-means on transaction + transfer behavior instead of the rule-based segmentation.
- CSV export from every dashboard table.
- React Testing Library coverage for the components.
- Dockerize it, add a Makefile for one-command setup.

---