#!/usr/bin/env python3
"""Render docs/data/briefing.json as an email-safe HTML edition.

Output goes to docs/email/latest.html — the same file is attached to the
daily send and serves as the "view in browser" page. Email-client constraints
apply: table layout, inline styles, no JS, no webfonts, fixed light palette.
"""

import html
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
BRIEFING = ROOT / "docs" / "data" / "briefing.json"
OUT = ROOT / "docs" / "email" / "latest.html"

SITE = "https://stephenkinsella.net/brief/"

# fixed light palette (email clients ignore CSS variables and dark schemes)
INK = "#1B1F1D"
SOFT = "#4A524D"
FAINT = "#7A8079"
ACCENT = "#0B5D4E"
POS = "#1D7A46"
NEG = "#B0413E"
WARN = "#C08A2D"
RULE = "#D8D2C7"
BG = "#FAF7F2"
PANEL = "#FFFFFF"

SERIF = "Georgia, 'Times New Roman', serif"
SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


def esc(s):
    return html.escape(str(s), quote=True)


def badge(delta, suffix="%"):
    if delta is None:
        return ""
    colour = POS if delta > 0 else (NEG if delta < 0 else FAINT)
    arrow = "▲" if delta > 0 else ("▼" if delta < 0 else "—")
    return (f'<span style="color:{colour};font-size:13px;font-weight:600">'
            f"{arrow} {abs(delta):.1f}{esc(suffix)}</span>")


def kpi_row(label, value, delta_html, href):
    return f"""
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid {RULE};font-family:{SANS};
                 font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:{FAINT}">
        <a href="{esc(href)}" style="color:{FAINT};text-decoration:none">{esc(label)}</a></td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid {RULE};font-family:{SERIF};
                 font-size:20px;font-weight:700;color:{INK};white-space:nowrap">{value}</td>
      <td align="right" style="padding:10px 0 10px 14px;border-bottom:1px solid {RULE};
                 font-family:{SANS};white-space:nowrap">{delta_html}</td>
    </tr>"""


def build_rows(tiles):
    rows = []
    t = tiles.get("media")
    if t and t.get("today_total") is not None:
        net = t.get("today_net") or 0
        tone = "Neutral" if net == 0 else ("Favourable" if net > 0 else "Unfavourable")
        rows.append(kpi_row("Media tone today",
                            f"{tone} <span style='font-size:13px;color:{SOFT}'>({t['today_total']} items)</span>",
                            "", SITE + "media/"))
    t = tiles.get("economy")
    if t and t.get("unemployment") is not None:
        rows.append(kpi_row("Unemployment", f"{t['unemployment']:.1f}%", "", SITE + "economy/"))
    if t and t.get("cpi_yoy") is not None:
        rows.append(kpi_row("CPI inflation", f"{t['cpi_yoy']:.1f}% y/y", "", SITE + "economy/"))
    t = tiles.get("exchequer")
    if t and t.get("tax_ytd_bn") is not None:
        rows.append(kpi_row("Tax receipts YTD", f"€{t['tax_ytd_bn']:.1f}bn",
                            badge(t.get("yoy_pct"), "% y/y"), SITE + "economy/#exchequer"))
    t = tiles.get("brent")
    if t:
        rows.append(kpi_row("Brent crude", f"${float(t['value']):.1f}/bbl",
                            badge(t.get("delta_pct")), SITE + "energy/"))
    t = tiles.get("heating_oil")
    if t:
        rows.append(kpi_row("Heating oil (IE)", f"€{float(t['value']):.0f}/500L",
                            badge(t.get("delta_pct")), SITE + "energy/"))
    t = tiles.get("ie10y")
    if t:
        spread = (f' <span style="font-size:13px;color:{SOFT}">+{t["spread_bund_bps"]}bps vs Bund</span>'
                  if t.get("spread_bund_bps") is not None else "")
        rows.append(kpi_row("Irish 10-year", f"{float(t['value']):.2f}%{spread}",
                            "", SITE + "energy/#bonds"))
    t = tiles.get("eurusd")
    if t:
        rows.append(kpi_row("EUR/USD", f"${float(t['value']):.3f}",
                            badge(t.get("delta_pct")), SITE + "energy/"))
    return "".join(rows)


def build(briefing):
    now = datetime.now(timezone.utc)
    dateline = now.strftime("%A %-d %B %Y")
    note = esc(briefing.get("morning_note", ""))

    alerts_html = ""
    alerts = briefing.get("alerts") or []
    if alerts:
        chips = "".join(
            f'<div style="font-family:{SANS};font-size:13px;font-weight:600;color:{WARN};'
            f'padding:6px 0">▲ {esc(a["text"])}</div>'
            for a in alerts[:4])
        alerts_html = f'<tr><td style="padding:6px 32px 0">{chips}</td></tr>'

    return f"""<!DOCTYPE html>
<html lang="en-IE">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Brief — {esc(dateline)}</title></head>
<body style="margin:0;padding:0;background:{BG}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG}">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
         style="max-width:600px;width:100%;background:{PANEL};border:1px solid {RULE};border-radius:10px">
    <tr><td style="padding:28px 32px 4px">
      <div style="font-family:{SERIF};font-size:26px;font-weight:700;letter-spacing:.08em;color:{INK}">
        THE BRIEF<span style="color:{ACCENT}">.</span></div>
      <div style="font-family:{SANS};font-size:13px;color:{SOFT};padding-top:4px">{esc(dateline)}
        &nbsp;·&nbsp; <a href="{SITE}" style="color:{ACCENT}">view the full briefing</a></div>
    </td></tr>
    <tr><td style="padding:18px 32px 0">
      <div style="border-top:3px solid {INK};border-bottom:1px solid {RULE};padding:16px 0">
        <div style="font-family:{SANS};font-size:11px;font-weight:700;letter-spacing:.12em;
                    text-transform:uppercase;color:{ACCENT};padding-bottom:6px">Morning note</div>
        <div style="font-family:{SERIF};font-size:17px;line-height:1.55;color:{INK}">{note}</div>
      </div>
    </td></tr>
    {alerts_html}
    <tr><td style="padding:10px 32px 6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{build_rows(briefing.get("tiles", {}))}</table>
    </td></tr>
    <tr><td style="padding:16px 32px 26px">
      <div style="font-family:{SANS};font-size:12px;color:{FAINT};line-height:1.6">
        Compiled automatically from CSO, ECB, Department of Finance, EIA, FRED and Irish news feeds.<br>
        Sections: <a href="{SITE}media/" style="color:{ACCENT}">Media</a> ·
        <a href="{SITE}economy/" style="color:{ACCENT}">Economy</a> ·
        <a href="{SITE}econ/" style="color:{ACCENT}">Data</a> ·
        <a href="{SITE}energy/" style="color:{ACCENT}">Energy</a> ·
        <a href="{SITE}tax/" style="color:{ACCENT}">Tax</a> ·
        <a href="{SITE}spend/" style="color:{ACCENT}">Spend</a> ·
        <a href="{SITE}jobs/" style="color:{ACCENT}">Jobs</a><br>
        Stephen Kinsella · University of Limerick
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>"""


def main():
    briefing = json.load(open(BRIEFING))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(build(briefing), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
