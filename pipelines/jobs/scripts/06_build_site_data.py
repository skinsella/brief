"""
Merge occupations.csv + scores.json into site/data.json — the bundle the
frontend reads. Mirrors build_site_data.py in karpathy/jobs. Works even
when scores.json is missing (exposure becomes null).

Also emits a `vintage` block recording which year/quarter of each source
the data came from, so the frontend can show data-vintage badges per
layer without hard-coding strings.

Usage:
    uv run python scripts/06_build_site_data.py
"""

import csv
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CSV_IN = REPO / "occupations.csv"
INDEX_IN = REPO / "occupations.json"
PAGES_DIR = REPO / "pages"
SCORES_IN = REPO / "scores.json"
AIOE_BENCHMARK = REPO / "raw" / "_aioe_benchmark.json"
OUT = REPO.parent.parent / "docs" / "jobs" / "data.json"
PXSTAT_DIR = REPO / "raw" / "pxstat"


# NSB sector chapter → QLF55 NACE Rev 2.1 sector index. Each chapter is
# a SOC2010-grouped occupational category, not a NACE sector — these are
# the closest single-NACE-sector trends to overlay as context. Where an
# NSB chapter spans multiple NACE sections (e.g. Sales & Customer Service
# spans G + parts of J + parts of M), we pick the dominant section.
NSB_TO_QLF55_NACE = {
    "ICT":                              6,   # Information and Communication (J,K)
    "Healthcare":                       11,  # Human Health and Social Work (R)
    "Education":                        10,  # Education (Q)
    "Construction":                     2,   # Construction (F)
    "Hospitality":                      5,   # Accommodation and Food (I)
    "Transport & Logistics":            4,   # Transportation and Storage (H)
    "Sales & Customer Service":         3,   # Wholesale and Retail (G)
    "Business & Financial":             15,  # Financial, Insurance, Real Estate (L,M)
    "Science & Engineering":            7,   # Professional, Scientific and Technical (N)
    "Operatives & Elementary":          12,  # Industry (B-E)
    "Other Craft":                      12,  # Industry (B-E)
    "Social & Care":                    11,  # Human Health and Social Work (R)
    "Agriculture & Animal Care":        1,   # Agriculture, Forestry and Fishing (A)
    "Arts, Sports & Tourism":           16,  # Other NACE Activities (S to V)
    "Administrative & Secretarial":     8,   # Administrative and Support Service (O)
    "Legal & Security":                 9,   # Public Administration and Defence
}


def load_qlf55_sector_series() -> dict:
    """Return {nsb_category: {quarters: [str], employed: [int|None], nace_label: str}}
    using QLF55 (NACE Rev 2.1 × quarter, 2019Q1–latest), Both sexes column."""
    f = PXSTAT_DIR / "QLF55.json"
    if not f.exists():
        return {}
    d = json.loads(f.read_text())
    dims = d["dimension"]
    dim_ids = d["id"]
    sizes = d["size"]
    values = d["value"]

    def labels(dim_id: str) -> list[str]:
        cat = dims[dim_id]["category"]
        codes = cat["index"]
        return [cat["label"][c] for c in codes]

    def label_idx(dim_id: str, label: str) -> int:
        cat = dims[dim_id]["category"]
        for code, name in cat["label"].items():
            if name == label:
                return cat["index"].index(code)
        raise KeyError(f"{label!r} not in {dim_id}")

    # QLF55 dims (order): STATISTIC, TLIST(Q1), Sex, NACE
    statistic_idx = 0  # "Persons aged 15-89 years in Employment" (1 cat)
    if dims[dim_ids[0]]["category"]["label"].get(
        list(dims[dim_ids[0]]["category"]["index"])[0]) == "Persons aged 15-89 years in Employment":
        statistic_idx = 0
    quarter_labels = labels(dim_ids[1])
    sex_both_idx = label_idx(dim_ids[2], "All sexes")
    nace_labels = labels(dim_ids[3])

    out: dict = {}
    for nsb_cat, nace_idx in NSB_TO_QLF55_NACE.items():
        if nace_idx >= sizes[3]:
            continue
        series = []
        for q_idx in range(sizes[1]):
            flat = (
                ((statistic_idx * sizes[1] + q_idx) * sizes[2] + sex_both_idx)
                * sizes[3] + nace_idx
            )
            v = values[flat] if flat < len(values) else None
            series.append(int(v * 1000) if v is not None else None)  # values are in 000s
        out[nsb_cat] = {
            "quarters": quarter_labels,
            "employed": series,
            "nace_label": nace_labels[nace_idx],
        }
    return out


def extract_nsb_narrative(slug: str) -> tuple[str, str]:
    """Return (narrative_text, shortage_tag) parsed from pages/<slug>.md.
    Returns ("", "") if the page or the section is missing."""
    p = PAGES_DIR / f"{slug}.md"
    if not p.exists():
        return "", ""
    text = p.read_text()
    m = re.search(
        r"## Occupation-level outlook\n+(.+?)(?=\n\*\*Skills shortage:\*\*|\n## |\Z)",
        text, re.DOTALL,
    )
    narrative = m.group(1).strip() if m else ""
    s = re.search(r"\*\*Skills shortage:\*\*\s*(.+?)$", text, re.MULTILINE)
    shortage = s.group(1).strip() if s else ""
    return narrative, shortage

sys.path.insert(0, str(REPO / "scripts"))
from _nsb_paths import latest_local_nsb_year


def _latest_label_in_pxstat(table_code: str, dim_key: str) -> str | None:
    """Pull the last category label for a dimension in a cached PxStat JSON."""
    f = PXSTAT_DIR / f"{table_code}.json"
    if not f.exists():
        return None
    d = json.loads(f.read_text())
    dims = d.get("dimension", {})
    if dim_key not in dims:
        return None
    labels = list(dims[dim_key].get("category", {}).get("label", {}).values())
    return labels[-1] if labels else None


def build_vintage_block() -> dict:
    """Return a dict describing the vintage of every layer the site shows."""
    nsb_year = latest_local_nsb_year()
    # The NSB-YYYY edition reports YYYY-1 annual averages and growth
    # over the prior five years (e.g. NSB 2025 → 2024 annual data and
    # 2019-2024 5-yr growth).
    data_year = nsb_year - 1
    growth_window = f"{data_year - 5}–{data_year}"

    ehq15_qtr = _latest_label_in_pxstat("EHQ15", "TLIST(Q1)")
    den11_year = _latest_label_in_pxstat("DEN11", "TLIST(A1)")  # kept for reference
    return {
        "jobs": {
            "label": f"NSB {nsb_year}",
            "detail": f"Annual average {data_year}",
            "source": "SOLAS National Skills Bulletin",
        },
        "outlook": {
            "label": f"NSB {nsb_year}",
            "detail": f"5-yr growth {growth_window}",
            "source": "SOLAS National Skills Bulletin",
        },
        "pay": {
            "label": f"CSO EHQ15 {ehq15_qtr}" if ehq15_qtr else "CSO EHQ15",
            "detail": "Mean weekly earnings (NACE section avg) × NSB-sector mix × 52",
            "source": "CSO Earnings & Labour Costs, sector-weighted",
        },
        "education": {
            "label": f"NSB {nsb_year}",
            "detail": "%3rd-level → NFQ-tier classification (40/100 coverage)",
            "source": "SOLAS National Skills Bulletin",
        },
        "exposure_complementary": {
            "label": "LLM",
            "detail": "Gemini Flash via OpenRouter, Friend-or-Foe rubric",
            "source": "Model estimate (not measured data)",
        },
        "exposure_substitutable": {
            "label": "LLM",
            "detail": "Gemini Flash via OpenRouter, Friend-or-Foe rubric",
            "source": "Model estimate (not measured data)",
        },
        "exposure": {
            "label": "LLM",
            "detail": "max(complementary, substitutable)",
            "source": "Derived from model estimates",
        },
        "dof_risk_tier": {
            "label": "DoF 2024 + manual",
            "detail": "Hand-mapped from NSB sector → DoF NACE-sector tier",
            "source": "Williamson et al. (2024) framework",
        },
        "sector_series": {
            "label": "CSO QLF55",
            "detail": "NACE Rev 2.1 employment 2019Q1–latest, sector-mapped",
            "source": "CSO Labour Force Survey",
        },
        "aioe": {
            "label": "AIOE 2021",
            "detail": "Felten/Raj/Seamans, US SOC 2018 → UK SOC2010 mapping",
            "source": "Strategic Management Journal 42(12):2195–2217",
        },
    }


def main() -> None:
    scores: dict[str, dict] = {}
    if SCORES_IN.exists():
        for s in json.loads(SCORES_IN.read_text()):
            scores[s["slug"]] = s

    with CSV_IN.open() as f:
        rows = list(csv.DictReader(f))

    # SOC unit-group descriptions live in occupations.json (the index
    # that script 01 emits from the NSB Appendix). Merge them in by slug
    # so the detail panel can show what's inside each occupational group.
    index = {e["slug"]: e for e in json.loads(INDEX_IN.read_text())}
    # Felten/Raj/Seamans AIOE benchmark (script 07 output).
    aioe = {}
    if AIOE_BENCHMARK.exists():
        aioe = json.loads(AIOE_BENCHMARK.read_text())

    data = []
    for row in rows:
        slug = row["slug"]
        score = scores.get(slug, {})
        idx_entry = index.get(slug, {})
        nsb_narrative, nsb_shortage = extract_nsb_narrative(slug)
        ai_bench = aioe.get(slug, {})
        data.append({
            "title": row["title"],
            "slug": slug,
            "category": row["category"],
            "pay": int(row["median_pay_annual"]) if row["median_pay_annual"] else None,
            "jobs": int(row["num_jobs_2024"]) if row["num_jobs_2024"] else None,
            "outlook": int(row["outlook_pct"]) if row["outlook_pct"] not in ("", None) else None,
            "outlook_desc": row["outlook_desc"],
            "education": row["entry_education"],
            "exposure": score.get("exposure"),
            "exposure_complementary": score.get("exposure_complementary"),
            "exposure_substitutable": score.get("exposure_substitutable"),
            "exposure_rationale": score.get("rationale"),
            "dof_risk_tier": row.get("dof_risk_tier", "") or None,
            "soc_descriptions": idx_entry.get("soc_descriptions", []),
            "nsb_narrative": nsb_narrative or None,
            "nsb_shortage": nsb_shortage or None,
            "aioe_0_10": ai_bench.get("aioe_0_10"),
            "aioe_raw": ai_bench.get("aioe_raw"),
            "aioe_matched": ai_bench.get("matched", []),
            "url": row.get("url", ""),
        })

    sector_series = load_qlf55_sector_series()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Wrap rows + vintage block + sector series in a top-level object.
    # The frontend gracefully handles missing sector_series (older shape).
    bundle = {
        "rows": data,
        "vintage": build_vintage_block(),
        "sector_series": sector_series,
    }
    OUT.write_text(json.dumps(bundle))

    total_jobs = sum(d["jobs"] for d in data if d["jobs"])
    print(f"Wrote {len(data)} occupations to {OUT.relative_to(REPO)}")
    print(f"  Total employment represented: {total_jobs:,}")
    print(f"  With AI exposure score: {sum(1 for d in data if d['exposure'] is not None)}/{len(data)}")
    print(f"  Vintage block:")
    for layer, info in bundle["vintage"].items():
        print(f"    {layer:<28} {info['label']:<24} {info['detail']}")


if __name__ == "__main__":
    main()
