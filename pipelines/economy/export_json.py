#!/usr/bin/env python3
"""Export the weekly-economy parquet store to docs/economy/data/weekly.json.

Bridges the inherited Python pipeline (data_store/*.parquet written by
scripts/update_data.py, plus cache/last_update.json) to the static page at
docs/economy/. Deterministic; no network access.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
STORE = HERE / "data_store"
CACHE = HERE / "cache" / "last_update.json"
OUT = HERE.parent.parent / "docs" / "economy" / "data" / "weekly.json"

# parquet file → list of (column, series_key, label, unit)
SERIES_MAP = {
    "cpi.parquet": [("cpi", "cpi", "CPI inflation", "% y/y")],
    "live_register.parquet": [
        ("Persons on the Live Register (Seasonally Adjusted)",
         "live_register_sa", "Live Register (seasonally adjusted)", "persons"),
    ],
    "exchange_rates.parquet": [
        ("eur_usd", "eur_usd", "EUR/USD", "$"),
        ("eur_gbp", "eur_gbp", "EUR/GBP", "£"),
    ],
    "brent_crude.parquet": [("brent_price", "brent", "Brent crude", "$/bbl")],
    "natural_gas.parquet": [("gas_price", "gas", "Natural gas (Henry Hub)", "$/MMBtu")],
    "monthly_bonds.parquet": [
        ("ireland_10y", "ie10y", "Irish 10-year yield", "%"),
        ("spread", "ie_de_spread", "Spread over Bund", "pp"),
    ],
    "consumer_sentiment.parquet": [
        ("sentiment", "sentiment", "Consumer sentiment (CSI)", "index"),
    ],
    "pmi_data.parquet": [
        ("manufacturing_pmi", "pmi_manufacturing", "Manufacturing PMI", "index"),
        ("services_pmi", "pmi_services", "Services PMI", "index"),
        ("construction_pmi", "pmi_construction", "Construction PMI", "index"),
    ],
    "insolvency.parquet": [
        ("corporate_insolvencies", "insolvency_corporate", "Corporate insolvencies", "count"),
        ("personal_bankruptcies", "insolvency_personal", "Personal bankruptcies", "count"),
    ],
}


def series_points(df, col):
    d = df[["date", col]].dropna().sort_values("date")
    return [
        [ts.strftime("%Y-%m-%d"), round(float(v), 4)]
        for ts, v in zip(pd.to_datetime(d["date"]), d[col])
    ]


def latest_entry(points):
    if not points:
        return None
    entry = {"value": points[-1][1], "date": points[-1][0]}
    if len(points) > 1:
        prev = points[-2][1]
        entry["prev"] = prev
        entry["change"] = round(points[-1][1] - prev, 4)
    return entry


def main():
    series = {}
    latest = {}
    for fname, cols in SERIES_MAP.items():
        path = STORE / fname
        if not path.exists():
            continue
        df = pd.read_parquet(path)
        for col, key, label, unit in cols:
            if col not in df.columns:
                continue
            pts = series_points(df, col)
            if not pts:
                continue
            series[key] = {"label": label, "unit": unit, "points": pts}
            latest[key] = latest_entry(pts)

    # CPI is stored as a y/y rate; expose it under the name the landing page uses
    if "cpi" in latest:
        latest["cpi"] = {**latest["cpi"], "yoy": latest["cpi"]["value"]}
    if "live_register_sa" in latest:
        latest["live_register"] = latest["live_register_sa"]

    # richer 'latest' values from the pipeline snapshot (unemployment has no parquet)
    snap = {}
    if CACHE.exists():
        try:
            snap = json.load(open(CACHE)).get("results", {})
        except (json.JSONDecodeError, OSError):
            snap = {}
    unemp = (snap.get("cso") or {}).get("unemployment") or {}
    if unemp.get("rate") is not None:
        latest["unemployment"] = {"value": unemp["rate"], "date": unemp.get("date")}
    container = (snap.get("market") or {}).get("container") or {}
    if container.get("current") is not None:
        latest["container"] = container
    commodities = (snap.get("market") or {}).get("commodities") or {}
    if (commodities.get("brent") or {}).get("wow") is not None and "brent" in latest:
        latest["brent"]["wow_pct"] = commodities["brent"]["wow"]
    fx = (snap.get("ecb") or {}).get("latest_rates") or {}
    for k, src in (("eur_usd", "eur_usd_wow"), ("eur_gbp", "eur_gbp_wow")):
        if fx.get(src) is not None and k in latest:
            latest[k]["wow_pct"] = fx[src]

    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latest": latest,
        "series": series,
        "commentary": None,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(payload, f)
    print(f"Wrote {OUT}: {len(series)} series, {len(latest)} latest values")


if __name__ == "__main__":
    main()
