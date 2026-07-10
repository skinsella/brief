#!/usr/bin/env python3
"""Build docs/data/briefing.json — the landing-page payload for The Brief.

Reads whatever section data exists under docs/ and degrades gracefully when a
pipeline has not run yet (tiles report null, the note skips that clause).
Rule-based and deterministic: every number in the note is traceable to a
committed JSON file. Run from anywhere; paths resolve relative to this file.
Optional: if ANTHROPIC_API_KEY is set and --polish is passed, the assembled
facts are rewritten into a fluent paragraph, with a hard fallback to the
template on any error.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DOCS = ROOT / "docs"
OUT = DOCS / "data" / "briefing.json"


def load(relpath):
    p = DOCS / relpath
    if not p.exists():
        return None
    try:
        with open(p) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def _rows(history, value_key, date_key):
    """Normalise a history list; EIA series use 'period' instead of 'date'."""
    out = []
    for r in history or []:
        d = r.get(date_key) or r.get("period")
        v = r.get(value_key)
        if d and v is not None:
            out.append({date_key: d, value_key: v})
    return out


def newest(history, value_key="value", date_key="date"):
    """Return (date, value) of the most recent entry in a history list."""
    rows = _rows(history, value_key, date_key)
    if not rows:
        return None, None
    rows.sort(key=lambda r: r[date_key])
    return rows[-1][date_key], rows[-1][value_key]


def spark(history, value_key="value", date_key="date", n=20):
    """Oldest→newest list of the last n values, for sparklines."""
    rows = _rows(history, value_key, date_key)
    rows.sort(key=lambda r: r[date_key])
    return [round(float(r[value_key]), 4) for r in rows[-n:]]


def pct_change(history, value_key="value", date_key="date", back=5):
    """% change between the latest value and ~`back` observations earlier."""
    rows = _rows(history, value_key, date_key)
    rows.sort(key=lambda r: r[date_key])
    if len(rows) < 2:
        return None
    prev = rows[max(0, len(rows) - 1 - back)][value_key]
    cur = rows[-1][value_key]
    if not prev:
        return None
    return round(100.0 * (float(cur) - float(prev)) / float(prev), 2)


def build():
    now = datetime.now(timezone.utc)
    tiles = {}
    sections = {}
    note_bits = []

    # ── media (docs/media/data/sentiment.json) ────────────────────────────
    sent = load("media/data/sentiment.json")
    if sent:
        w = sent.get("windows", {})
        today = w.get("today", {})
        seven = w.get("seven_day", {})
        tiles["media"] = {
            "today_total": today.get("total"),
            "today_net": today.get("net"),
            "seven_day_total": seven.get("total"),
            "seven_day_net": seven.get("net"),
            "asof": sent.get("updated_at"),
        }
        sections["media"] = {"asof": sent.get("updated_at")}
        t, n = today.get("total", 0), today.get("net", 0)
        tone = "neutral" if n == 0 else ("favourable" if n > 0 else "unfavourable")
        vol = "quiet" if (t or 0) < 5 else ("busy" if t > 15 else "steady")
        note_bits.append(
            f"Media coverage is {vol} today ({t} item{'s' if t != 1 else ''}, "
            f"{tone} tone; {seven.get('total', 0)} items over the past week)."
        )

    # ── energy (docs/energy/data/*.json) ─────────────────────────────────
    prices = load("energy/data/prices.json")
    if prices:
        brent = (prices.get("commodities") or {}).get("BRENT", {})
        bd, bv = newest(brent.get("history"))
        wow = pct_change(brent.get("history"), back=5)
        if bv is not None:
            tiles["brent"] = {
                "value": bv, "unit": "$/bbl",
                "delta_pct": wow,
                "spark": spark(brent.get("history")),
                "asof": bd,
            }
            clause = f"Brent is at ${bv:.0f}"
            if wow is not None:
                direction = "up" if wow > 0 else "down"
                clause += f", {direction} {abs(wow):.1f}% on the week"
            note_bits.append(clause + ".")
        ed, ev = newest(prices.get("eurusd"), value_key="rate")
        if ev is not None:
            tiles["eurusd"] = {
                "value": ev, "unit": "$",
                "delta_pct": pct_change(prices.get("eurusd"), value_key="rate", back=5),
                "spark": spark(prices.get("eurusd"), value_key="rate"),
                "asof": ed,
            }
        sections["energy"] = {"asof": prices.get("last_updated")}

    irl = load("energy/data/ireland_prices.json")
    if irl and irl.get("national_avg_500l"):
        hd, hv = newest(irl.get("history"), value_key="national_avg")
        tiles["heating_oil"] = {
            "value": irl["national_avg_500l"], "unit": "€/500L",
            "delta_pct": pct_change(irl.get("history"), value_key="national_avg", back=7),
            "spark": spark(irl.get("history"), value_key="national_avg"),
            "asof": irl.get("last_updated"),
        }
        note_bits.append(
            f"Irish home heating oil averages €{irl['national_avg_500l']:.0f} per 500L."
        )

    bonds = load("energy/data/bonds.json")
    if bonds:
        ie = (bonds.get("yields") or {}).get("IE10Y", {})
        idt, iv = newest(ie.get("history"))
        sp = (bonds.get("cross_spreads") or {}).get("IE_DE")
        sdt, sv = newest(sp) if sp else (None, None)
        if iv is not None:
            tiles["ie10y"] = {
                "value": iv, "unit": "%",
                "spread_bund_bps": round(sv * 100) if sv is not None else None,
                "spark": spark(ie.get("history")),
                "asof": idt,
            }
            clause = f"The Irish 10-year trades at {iv:.2f}%"
            if sv is not None:
                clause += f", {round(sv * 100)} bps over bunds"
            note_bits.append(clause + ".")

    # ── economy (docs/economy/data/weekly.json) ───────────────────────────
    weekly = load("economy/data/weekly.json")
    if weekly:
        latest = weekly.get("latest", {})
        cpi = latest.get("cpi", {})
        lr = latest.get("live_register", {})
        unemp = latest.get("unemployment", {})
        tiles["economy"] = {
            "cpi_yoy": cpi.get("yoy") if isinstance(cpi, dict) else None,
            "unemployment": unemp.get("value") if isinstance(unemp, dict) else None,
            "live_register": lr.get("value") if isinstance(lr, dict) else None,
            "asof": weekly.get("generated_at"),
        }
        sections["economy"] = {"asof": weekly.get("generated_at")}
        bits = []
        if isinstance(cpi, dict) and cpi.get("yoy") is not None:
            bits.append(f"CPI inflation is {cpi['yoy']:.1f}% y/y")
        if isinstance(unemp, dict) and unemp.get("value") is not None:
            bits.append(f"unemployment {unemp['value']:.1f}%")
        if bits:
            note_bits.append("; ".join(bits) + ".")

    # ── exchequer (docs/economy/data/exchequer.json) ──────────────────────
    exchequer = load("economy/data/exchequer.json")
    if exchequer and exchequer.get("latest"):
        ex = exchequer["latest"]
        tax = ex.get("tax_revenue") or {}
        bal = ex.get("exchequer_balance") or {}
        month_iso = exchequer.get("latest_month", "")
        month_label = ""
        if month_iso:
            month_label = datetime.strptime(month_iso, "%Y-%m").strftime("%B")
        tiles["exchequer"] = {
            "tax_ytd_bn": round(tax["outturn_m"] / 1000, 1) if tax.get("outturn_m") else None,
            "yoy_pct": tax.get("yoy_pct"),
            "balance_bn": round(bal["outturn_m"] / 1000, 1) if bal.get("outturn_m") is not None else None,
            "month": month_iso,
            "asof": exchequer.get("generated_at"),
        }
        if tax.get("outturn_m"):
            clause = (f"Tax receipts reached €{tax['outturn_m'] / 1000:.1f}bn "
                      f"in the year to end-{month_label}")
            if tax.get("yoy_pct") is not None:
                clause += f", up {tax['yoy_pct']:.1f}% on last year"
            if bal.get("outturn_m") is not None:
                state = "surplus" if bal["outturn_m"] >= 0 else "deficit"
                clause += f"; the Exchequer {state} stands at €{abs(bal['outturn_m']) / 1000:.1f}bn"
            note_bits.append(clause + ".")

    # ── jobs (static monthly data; presence only) ─────────────────────────
    if (DOCS / "jobs" / "data.json").exists():
        sections["jobs"] = {"asof": None}

    # ── surprise detection ────────────────────────────────────────────────
    alerts = detect_surprises(sent, prices, irl, weekly, exchequer)
    if alerts:
        note_bits.append("Worth noting: " +
                         " ".join(a["text"] for a in alerts[:2]))

    note = " ".join(note_bits) if note_bits else (
        "Pipelines are warming up — live data will appear here after the first scheduled runs."
    )

    payload = {
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "morning_note": note,
        "alerts": alerts,
        "tiles": tiles,
        "sections": sections,
    }

    if "--polish" in sys.argv and os.environ.get("ANTHROPIC_API_KEY"):
        polished = polish(note)
        if polished:
            payload["morning_note"] = polished
            payload["morning_note_source"] = "anthropic-polished"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {OUT} ({len(note_bits)} note clauses, {len(tiles)} tiles)")


def _weekly_changes(history, value_key="value", date_key="date", step=5):
    """List of trailing %-changes over `step` observations, oldest→newest."""
    rows = _rows(history, value_key, date_key)
    rows.sort(key=lambda r: r[date_key])
    vals = [float(r[value_key]) for r in rows]
    return [
        100.0 * (vals[i] - vals[i - step]) / vals[i - step]
        for i in range(step, len(vals))
        if vals[i - step]
    ]


def detect_surprises(sent, prices, irl, weekly, exchequer):
    """Rule-based, deterministic anomaly clauses. Every alert is traceable to
    committed JSON; thresholds are deliberately conservative so an alert
    means something."""
    alerts = []

    # Brent: big weekly move
    if prices:
        brent = (prices.get("commodities") or {}).get("BRENT", {})
        changes = _weekly_changes(brent.get("history"))
        if changes and abs(changes[-1]) >= 5:
            direction = "up" if changes[-1] > 0 else "down"
            alerts.append({"kind": "energy",
                           "text": f"Brent is {direction} {abs(changes[-1]):.1f}% on the week."})
        # EUR/USD: unusually large weekly move
        fx = _weekly_changes(prices.get("eurusd"), value_key="rate")
        if fx and abs(fx[-1]) >= 1.5:
            direction = "strengthened" if fx[-1] > 0 else "weakened"
            alerts.append({"kind": "fx",
                           "text": f"The euro has {direction} {abs(fx[-1]):.1f}% against the dollar this week."})

    # Heating oil: largest weekly move in the stored window
    if irl:
        changes = _weekly_changes(irl.get("history"), value_key="national_avg", step=7)
        if len(changes) >= 4 and abs(changes[-1]) >= 2:
            if abs(changes[-1]) >= max(abs(c) for c in changes[:-1]):
                direction = "rise" if changes[-1] > 0 else "fall"
                alerts.append({"kind": "energy",
                               "text": f"Home heating oil saw its largest weekly {direction} "
                                       f"({abs(changes[-1]):.1f}%) in the recorded window."})

    # Media: tone flip after a quiet fortnight, or a heavy unfavourable day
    if sent:
        daily = sent.get("daily") or {}
        days = sorted(daily.keys())
        if days:
            today = daily[days[-1]]
            prior = [daily[d] for d in days[-15:-1]]
            if (today.get("net", 0) < 0 and len(prior) >= 7
                    and all(p.get("net", 0) >= 0 for p in prior)):
                alerts.append({"kind": "media",
                               "text": "First net-unfavourable coverage day in over a fortnight."})
            counts = today.get("counts") or {}
            if counts.get("unfavourable", 0) >= 3:
                alerts.append({"kind": "media",
                               "text": f"{counts['unfavourable']} unfavourable items today — "
                                       "an unusually heavy critical day."})

    # CPI: sharp month-on-month shift in the y/y rate
    if weekly:
        cpi = (weekly.get("series") or {}).get("cpi", {}).get("points", [])
        if len(cpi) >= 2:
            move = cpi[-1][1] - cpi[-2][1]
            if abs(move) >= 0.5:
                direction = "jumped" if move > 0 else "fell"
                alerts.append({"kind": "prices",
                               "text": f"CPI inflation {direction} {abs(move):.1f}pp on the month "
                                       f"to {cpi[-1][1]:.1f}%."})

    # Exchequer: a major tax head moving double digits
    if exchequer and exchequer.get("latest"):
        for key, label in (("corporation_tax", "Corporation tax"),
                           ("income_tax", "Income tax"), ("vat", "VAT")):
            head = exchequer["latest"].get(key) or {}
            pct = head.get("yoy_pct")
            if pct is not None and abs(pct) >= 10:
                direction = "running" if pct > 0 else "down"
                alerts.append({"kind": "fiscal",
                               "text": f"{label} is {direction} {abs(pct):.0f}% "
                                       f"{'ahead of' if pct > 0 else 'behind'} last year."})

    return alerts


def polish(note):
    """Optionally rewrite the template note fluently. Never raises."""
    try:
        import urllib.request
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps({
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 300,
                "messages": [{
                    "role": "user",
                    "content": (
                        "Rewrite this briefing note as one fluent paragraph of at most 80 words "
                        "for the Irish Minister for Finance. Keep every number exactly as given; "
                        "add no facts. Plain, confident, no preamble:\n\n" + note
                    ),
                }],
            }).encode(),
            headers={
                "content-type": "application/json",
                "x-api-key": os.environ["ANTHROPIC_API_KEY"],
                "anthropic-version": "2023-06-01",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            out = json.load(r)
        text = "".join(b.get("text", "") for b in out.get("content", [])).strip()
        return text or None
    except Exception as e:  # noqa: BLE001 — any failure falls back to the template
        print(f"polish skipped: {e}", file=sys.stderr)
        return None


if __name__ == "__main__":
    build()
