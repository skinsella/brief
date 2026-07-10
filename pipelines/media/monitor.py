#!/usr/bin/env python3
"""Fetch recent Simon Harris mentions and render the GitHub Pages monitor."""

from __future__ import annotations

import argparse
import calendar
import email.utils
import hashlib
import html
import json
import re
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "docs" / "media"
SEEN_PATH = ROOT / "seen.txt"
DATA_DIR = ROOT / "data"
ARCHIVE_DIR = ROOT / "archive"
ITEMS_PATH = DATA_DIR / "items.json"
RUNS_PATH = DATA_DIR / "runs.json"
SENTIMENT_PATH = DATA_DIR / "sentiment.json"
CLUSTERS_PATH = DATA_DIR / "clusters.json"
OVERRIDES_PATH = DATA_DIR / "overrides.json"
OVERRIDES_EXAMPLE_PATH = DATA_DIR / "overrides.example.json"
INDEX_PATH = ROOT / "index.html"
WEEKLY_BRIEFING_MD_PATH = ROOT / "weekly-briefing.md"
WEEKLY_BRIEFING_HTML_PATH = ROOT / "weekly-briefing.html"
FINE_GAEL_ITEMS_PATH = DATA_DIR / "fine_gael_items.json"
FINE_GAEL_SEEN_PATH = DATA_DIR / "fine_gael_seen.txt"
FINE_GAEL_INDEX_PATH = ROOT / "fine-gael.html"
DASHBOARD_PATH = ROOT / "dashboard.html"
HISTORY_PATH = ROOT / "history.html"
CALENDAR_PATH = ROOT / "calendar.html"
DAY_DIR = ROOT / "day"

PRIMARY_FEED = (
    "https://news.google.com/rss/search?"
    + urllib.parse.urlencode(
        {
            "q": '"Simon Harris" when:1h',
            "hl": "en-IE",
            "gl": "IE",
            "ceid": "IE:en",
        }
    )
)

SUPPLEMENTARY_FEED = (
    "https://news.google.com/rss/search?"
    + urllib.parse.urlencode(
        {
            "q": '"Simon Harris" (Ireland OR "Fine Gael" OR Tánaiste OR Tanaiste OR Finance) when:1h',
            "hl": "en-IE",
            "gl": "IE",
            "ceid": "IE:en",
        }
    )
)

FINE_GAEL_FEED = (
    "https://news.google.com/rss/search?"
    + urllib.parse.urlencode(
        {
            "q": '"Fine Gael" when:1h',
            "hl": "en-IE",
            "gl": "IE",
            "ceid": "IE:en",
        }
    )
)

DIRECT_SOURCE_FEEDS = [
    ("RTE News RSS", "https://www.rte.ie/news/rss/news-headlines.xml"),
    ("Irish Times RSS", "https://www.irishtimes.com/arc/outboundfeeds/rss/"),
    ("Irish Times Ireland RSS", "https://www.irishtimes.com/arc/outboundfeeds/rss/category/ireland/"),
    ("Irish Independent RSS", "https://www.independent.ie/irish-news/rss"),
    ("TheJournal.ie RSS", "https://www.thejournal.ie/feed/"),
    ("BreakingNews.ie RSS", "https://feeds.breakingnews.ie/bnireland"),
    ("Today FM RSS", "https://www.todayfm.com/feed"),
]

BROAD_GOOGLE_FEEDS = [
    (
        "Google News 24h catch-up",
        "https://news.google.com/rss/search?"
        + urllib.parse.urlencode({"q": '"Simon Harris" when:24h', "hl": "en-IE", "gl": "IE", "ceid": "IE:en"}),
    ),
    (
        "Google Finance/policy search",
        "https://news.google.com/rss/search?"
        + urllib.parse.urlencode(
            {
                "q": '"Simon Harris" (finance OR budget OR tax OR economy OR enterprise OR "Fine Gael") when:24h',
                "hl": "en-IE",
                "gl": "IE",
                "ceid": "IE:en",
            }
        ),
    ),
]

FETCH_TIMEOUT = 20
USER_AGENT = "HMonitor/1.0 (+https://github.com/skinsella/HMonitor)"


@dataclass
class Item:
    outlet: str
    published: str
    headline: str
    link: str
    summary: str
    tag: str
    reason: str
    cluster_key: str
    first_seen: str
    source_feed: str
    google_link: str = ""
    source_link: str = ""
    topic: str = "Other"
    attention: list[str] = field(default_factory=list)
    outlet_tier: str = "other"
    outlet_weight: int = 1
    favourability: str = "neutral"
    sentiment_score: int = 0
    sentiment_confidence: str = "medium"
    sentiment_target: str = "unclear"
    sentiment_rationale: str = "Straight news mention with no clear positive or negative framing toward Simon Harris."


@dataclass
class FetchStatus:
    name: str
    ok: bool
    count: int = 0
    error: str = ""


@dataclass
class RunResult:
    checked_at: str
    checked_at_display: str
    new_count: int
    old_skipped: int
    duplicate_skipped: int
    mismatched_skipped: int
    fetches: list[FetchStatus] = field(default_factory=list)
    new_links: list[str] = field(default_factory=list)
    archive_file: str = ""


@dataclass
class StoryCluster:
    key: str
    title: str
    topic: str
    item_count: int
    outlet_count: int
    outlets: list[str]
    first_seen: str
    latest_seen: str
    lifespan_hours: int
    velocity_6h: int
    velocity_24h: int
    reach_score: int
    tone_counts: dict[str, int]
    net_framing: int
    significant_count: int
    attention_score: int
    status: str
    item_links: list[str]


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def load_seen() -> set[str]:
    if not SEEN_PATH.exists():
        return set()
    return {line.strip() for line in SEEN_PATH.read_text(encoding="utf-8").splitlines() if line.strip()}


def save_seen(links: set[str]) -> None:
    SEEN_PATH.write_text("\n".join(sorted(links)) + ("\n" if links else ""), encoding="utf-8")


def load_items() -> dict[str, Item]:
    if not ITEMS_PATH.exists():
        return {}
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    return {link: item_from_raw(item) for link, item in raw.items()}


def item_from_raw(raw: dict) -> Item:
    known = {field.name for field in Item.__dataclass_fields__.values()}
    cleaned = {key: value for key, value in raw.items() if key in known}
    item = Item(**cleaned)
    return enrich_item(item)


def save_items(items: dict[str, Item]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    payload = {link: asdict(item) for link, item in sorted(items.items())}
    ITEMS_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_runs() -> list[dict]:
    if not RUNS_PATH.exists():
        return []
    return json.loads(RUNS_PATH.read_text(encoding="utf-8"))


def save_runs(runs: list[dict]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    RUNS_PATH.write_text(json.dumps(runs[:100], indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def save_sentiment(payload: dict) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    SENTIMENT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def save_clusters(clusters: list[StoryCluster]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    CLUSTERS_PATH.write_text(json.dumps([asdict(cluster) for cluster in clusters], indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def ensure_override_files() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    if not OVERRIDES_PATH.exists():
        OVERRIDES_PATH.write_text("{}\n", encoding="utf-8")
    if not OVERRIDES_EXAMPLE_PATH.exists():
        example = {
            "https://example.com/story": {
                "favourability": "neutral",
                "topic": "Finance",
                "tag": "SIGNIFICANT",
                "sentiment_target": "Simon Harris",
                "sentiment_rationale": "Manual correction after press-office review.",
                "attention": ["Manual review"],
            }
        }
        OVERRIDES_EXAMPLE_PATH.write_text(json.dumps(example, indent=2) + "\n", encoding="utf-8")


def load_overrides() -> dict[str, dict]:
    ensure_override_files()
    try:
        raw = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return raw if isinstance(raw, dict) else {}


def fetch_rss(name: str, url: str) -> tuple[FetchStatus, list[dict]]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as response:
            xml_bytes = response.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        return FetchStatus(name=name, ok=False, error=str(exc)), []

    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        return FetchStatus(name=name, ok=False, error=f"RSS parse failed: {exc}"), []

    parsed = []
    default_outlet = source_outlet_name(name)
    for node in root.findall("./channel/item"):
        source = node.find("source")
        outlet = (source.text or "").strip() if source is not None else ""
        parsed.append(
            {
                "headline": text_of(node, "title"),
                "link": text_of(node, "link"),
                "google_link": text_of(node, "link") if name.startswith("Google") or name.startswith("Supplementary") or name.startswith("Fine Gael") else "",
                "source_link": text_of(node, "link"),
                "published": text_of(node, "pubDate"),
                "outlet": outlet or default_outlet or outlet_from_title(text_of(node, "title")),
                "source_feed": name,
            }
        )
    return FetchStatus(name=name, ok=True, count=len(parsed)), parsed


def text_of(node: ET.Element, child: str) -> str:
    found = node.find(child)
    return (found.text or "").strip() if found is not None else ""


def outlet_from_title(title: str) -> str:
    if " - " in title:
        return title.rsplit(" - ", 1)[1].strip()
    return "Unknown"


def source_outlet_name(feed_name: str) -> str:
    if feed_name.startswith(("Google", "Supplementary", "Fine Gael")):
        return ""
    return feed_name.removesuffix(" RSS")


def clean_headline(title: str, outlet: str) -> str:
    suffix = f" - {outlet}"
    if outlet and title.endswith(suffix):
        return title[: -len(suffix)].strip()
    return title.strip()


def parse_pubdate(value: str) -> datetime:
    parsed = email.utils.parsedate_to_datetime(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def display_time(value: str) -> str:
    try:
        return parse_pubdate(value).strftime("%a, %d %b %Y %H:%M GMT")
    except (TypeError, ValueError):
        return value or "Unknown time"


def is_relevant(headline: str, outlet: str) -> bool:
    haystack = f"{headline} {outlet}".lower()
    if "simon harris" not in haystack:
        # Google News can return contextual matches whose titles omit the name.
        return bool(re.search(r"\b(government|central bank|fine gael|tánaiste|tanaiste|finance|wicklow)\b", haystack))
    wrong_person_markers = [
        "actor",
        "footballer",
        "rugby",
        "professor",
        "obituary",
        "film",
        "music",
    ]
    if any(marker in haystack for marker in wrong_person_markers):
        politics_markers = ["ireland", "irish", "fine gael", "tánaiste", "tanaiste", "finance", "wicklow"]
        return any(marker in haystack for marker in politics_markers)
    return True


def is_relevant_direct_source(headline: str, outlet: str) -> bool:
    haystack = f"{headline} {outlet}".lower()
    direct_markers = [
        "simon harris",
        "tánaiste",
        "tanaiste",
        "minister for finance",
        "finance minister",
        "leader of fine gael",
    ]
    return any(marker in haystack for marker in direct_markers)


def classify(headline: str) -> tuple[str, str, str]:
    h = headline.lower()
    if "poll" in h or "support" in h:
        return "SIGNIFICANT", "POLLING", "Polling or party-support coverage may need a quick political readout."
    if any(term in h for term in ["resign", "appointment", "appointed", "steps down"]):
        return "SIGNIFICANT", "PERSONNEL", "Personnel changes can require fast briefing and lines-to-take."
    if any(term in h for term in ["controversy", "urgent review", "hit with", "accused", "questions still"]):
        return "SIGNIFICANT", "FAST REACTION", "The framing is critical or unresolved and may need a quick response."
    if any(term in h for term in ["new law", "new rules", "new guidelines", "savings plan", "central bank", "tax"]):
        return "SIGNIFICANT", "POLICY", "This is policy coverage connected to Finance or Government delivery."
    return "ROUTINE", "MENTION", "Routine mention; monitor for pickup but no immediate action is obvious."


def topic_for(headline: str) -> str:
    h = headline.lower()
    topics = [
        ("Polling", ["poll", "support", "approval", "rating", "survey"]),
        ("Finance", ["finance", "budget", "exchequer", "central bank", "savings", "bank", "cash", "atm"]),
        ("Tax", ["tax", "vat", "excise", "residential zoned land", "rztl"]),
        ("Enterprise", ["enterprise", "jobs", "investment", "intel", "semiconductor", "business"]),
        ("Housing", ["housing", "rent", "homes", "planning", "land tax"]),
        ("Fine Gael", ["fine gael", "party", "ard fheis", "leader"]),
        ("Courts/security", ["court", "garda", "security", "threat", "crime"]),
        ("Foreign affairs", ["foreign", "eu", "europe", "ukraine", "middle east", "global"]),
        ("Constituency/local", ["wicklow", "greystones", "bray", "arklow", "carlow", "kilkenny"]),
    ]
    for topic, needles in topics:
        if any(term in h for term in needles):
            return topic
    return "Other"


def outlet_profile(outlet: str) -> tuple[str, int]:
    name = outlet.lower()
    national = ["irish times", "irish independent", "business post", "examiner", "journal", "breakingnews"]
    broadcast = ["rte", "rté", "virgin media", "newstalk", "today fm"]
    business = ["silicon republic", "business plus", "irishtimes business"]
    regional = ["beo", "fm", "live", "echo", "leader", "people", "advertiser"]
    aggregator = ["google news", "msn", "yahoo"]
    party = ["fine gael"]
    if any(term in name for term in broadcast):
        return "broadcast", 3
    if any(term in name for term in national):
        return "national", 3
    if any(term in name for term in business):
        return "business", 2
    if any(term in name for term in regional):
        return "regional", 1
    if any(term in name for term in aggregator):
        return "aggregator", 1
    if any(term in name for term in party):
        return "party", 1
    return "other", 1


def apply_overrides(item: Item) -> Item:
    overrides = load_overrides()
    override = overrides.get(item.link) or overrides.get(item.source_link) or overrides.get(item.google_link)
    if not isinstance(override, dict):
        return item
    allowed = {field.name for field in Item.__dataclass_fields__.values()}
    for key, value in override.items():
        if key in allowed:
            setattr(item, key, value)
    return item


def attention_flags(item: Item) -> list[str]:
    flags: list[str] = []
    category = category_label(item)
    if item.tag == "SIGNIFICANT":
        flags.append(category.title())
    if item.favourability == "unfavourable":
        flags.append("Critical framing")
    if item.topic == "Polling":
        flags.append("Polling")
    if item.outlet_weight >= 3:
        flags.append("High-reach outlet")
    if item.sentiment_confidence == "low" and item.favourability != "neutral":
        flags.append("Review tone")
    return list(dict.fromkeys(flags))


def enrich_item(item: Item) -> Item:
    source_outlet = source_outlet_name(item.source_feed)
    if source_outlet and item.outlet in {"Unknown", "Tánaiste", "Tanaiste"}:
        item.outlet = source_outlet
    if not item.google_link and item.source_feed.startswith(("Google", "Supplementary", "Fine Gael")):
        item.google_link = item.link
    if not item.source_link:
        item.source_link = item.link
    if not item.topic or item.topic == "Other":
        item.topic = topic_for(item.headline)
    item.outlet_tier, item.outlet_weight = outlet_profile(item.outlet)
    item = with_sentiment(item)
    item.attention = attention_flags(item)
    return apply_overrides(item)


def with_sentiment(item: Item) -> Item:
    favourability, score, confidence, target, rationale = assess_sentiment(
        item.headline,
        item.summary,
        item.tag,
        item.cluster_key,
    )
    item.favourability = favourability
    item.sentiment_score = score
    item.sentiment_confidence = confidence
    item.sentiment_target = target
    item.sentiment_rationale = rationale
    return item


def assess_sentiment(headline: str, summary: str, tag: str, cluster_key: str) -> tuple[str, int, str, str, str]:
    text = f"{headline} {summary}".lower()
    personal_terms = ["simon harris", "tánaiste", "tanaiste", "leader of fine gael", "finance minister"]
    government_terms = ["government", "fine gael", "central bank", "department", "finance"]
    target = "Simon Harris" if any(term in text for term in personal_terms) else "Government/policy"
    if not any(term in text for term in personal_terms + government_terms):
        target = "unclear"

    favourable_terms = [
        "announces",
        "safeguards",
        "protect",
        "protecting",
        "enabled",
        "new guidelines",
        "new rules",
        "new law",
        "welcomes",
        "praised",
        "delivers",
        "boost",
    ]
    unfavourable_terms = [
        "accused",
        "controversy",
        "criticised",
        "criticized",
        "under fire",
        "urgent review",
        "hit with",
        "questions still",
        "concerns",
        "cashless society",
    ]
    adverse_event_terms = ["threat", "threats", "worried"]
    favourable_hits = [term for term in favourable_terms if term in text]
    unfavourable_hits = [term for term in unfavourable_terms if term in text]
    adverse_hits = [term for term in adverse_event_terms if term in text]

    if adverse_hits and not favourable_hits and not unfavourable_hits:
        return (
            "neutral",
            0,
            "medium",
            target,
            f"Headline describes an adverse event or risk ({', '.join(adverse_hits[:2])}) rather than approval or criticism of Simon Harris.",
        )

    if cluster_key == "Access to cash" and favourable_hits and "concerns" in unfavourable_hits:
        return (
            "mixed",
            0,
            "medium",
            target,
            "Coverage frames a Government safeguard or reporting mechanism, but through public access-to-cash concerns.",
        )
    if favourable_hits and not unfavourable_hits:
        return (
            "favourable",
            1,
            "medium" if tag == "SIGNIFICANT" else "low",
            target,
            f"Headline uses constructive delivery language: {', '.join(favourable_hits[:2])}.",
        )
    if unfavourable_hits and not favourable_hits:
        return (
            "unfavourable",
            -1,
            "medium" if target != "unclear" else "low",
            target,
            f"Headline uses critical or risk language: {', '.join(unfavourable_hits[:2])}.",
        )
    if favourable_hits and unfavourable_hits:
        return (
            "mixed",
            0,
            "medium",
            target,
            "Headline contains both delivery language and critical or concern-based framing.",
        )
    return (
        "neutral",
        0,
        "medium" if target != "unclear" else "low",
        target,
        "Straight news mention with no clear positive or negative framing toward Simon Harris.",
    )


def cluster_for(headline: str) -> str:
    h = headline.lower()
    if any(term in h for term in ["cash", "atm", "cashless", "central bank"]):
        return "Access to cash"
    if "savings" in h:
        return "Savings plan"
    if "residential zoned land tax" in h or "land tax" in h:
        return "Residential zoned land tax"
    return re.sub(r"[^a-z0-9]+", "-", h).strip("-")[:80] or "General"


STOPWORDS = {
    "about",
    "after",
    "again",
    "against",
    "amid",
    "and",
    "are",
    "can",
    "could",
    "from",
    "has",
    "have",
    "his",
    "how",
    "ireland",
    "irish",
    "minister",
    "new",
    "not",
    "over",
    "says",
    "simon",
    "harris",
    "that",
    "the",
    "this",
    "tanaiste",
    "tánaiste",
    "their",
    "under",
    "will",
    "with",
    "you",
}


def headline_keywords(headline: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", headline.lower().replace("tánaiste", "tanaiste"))
    return [word for word in words if len(word) > 2 and word not in STOPWORDS]


def story_signature(item: Item) -> str:
    h = item.headline.lower()
    if any(term in h for term in ["cash", "atm", "cashless"]) or ("central bank" in h and "access" in h):
        return f"{item.topic.lower()}:access-to-cash"
    if "savings plan" in h or ("savings" in h and "scheme" in h):
        return f"{item.topic.lower()}:savings-plan"
    if "residential zoned land tax" in h or "land tax" in h:
        return f"{item.topic.lower()}:residential-zoned-land-tax"
    if "poll" in h or "survey" in h:
        return f"{item.topic.lower()}:polling"
    keywords = headline_keywords(item.headline)
    if not keywords:
        return f"{item.topic.lower()}:{item.cluster_key}"
    stem = "-".join(sorted(dict.fromkeys(keywords[:10]))[:6])
    digest = hashlib.sha1(" ".join(keywords).encode("utf-8")).hexdigest()[:8]
    return f"{item.topic.lower()}:{stem}:{digest}"


def hours_between(start: datetime, end: datetime) -> int:
    return max(0, round((end - start).total_seconds() / 3600))


def build_story_clusters(items: list[Item], checked_at: str, limit: int | None = None) -> list[StoryCluster]:
    try:
        now = datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
    except ValueError:
        now = now_utc()
    groups: dict[str, list[Item]] = {}
    for item in items:
        groups.setdefault(story_signature(item), []).append(item)

    clusters: list[StoryCluster] = []
    for key, group in groups.items():
        sorted_group = sorted(group, key=item_timestamp_sort)
        latest_first = list(reversed(sorted_group))
        first_dt = item_timestamp_sort(sorted_group[0])
        latest_dt = item_timestamp_sort(sorted_group[-1])
        outlets = sorted({item.outlet for item in group})
        tone_counts = {"favourable": 0, "neutral": 0, "unfavourable": 0, "mixed": 0}
        for item in group:
            tone = item.favourability if item.favourability in tone_counts else "neutral"
            tone_counts[tone] += 1
        reach_score = sum(max(1, item.outlet_weight) for item in group)
        velocity_6h = sum(1 for item in group if (now - item_timestamp_sort(item)).total_seconds() <= 6 * 3600)
        velocity_24h = sum(1 for item in group if (now - item_timestamp_sort(item)).total_seconds() <= 24 * 3600)
        significant_count = sum(1 for item in group if item.tag == "SIGNIFICANT")
        net = 0 if not group else round(((tone_counts["favourable"] - tone_counts["unfavourable"]) / len(group)) * 100)
        attention_score = significant_count * 5 + tone_counts["unfavourable"] * 4 + velocity_6h * 3 + len(outlets) + reach_score
        status = "emerging" if velocity_6h >= 2 else "active" if velocity_24h else "persistent" if hours_between(first_dt, latest_dt) >= 48 else "dormant"
        clusters.append(
            StoryCluster(
                key=key,
                title=latest_first[0].headline,
                topic=latest_first[0].topic,
                item_count=len(group),
                outlet_count=len(outlets),
                outlets=outlets[:12],
                first_seen=first_dt.isoformat().replace("+00:00", "Z"),
                latest_seen=latest_dt.isoformat().replace("+00:00", "Z"),
                lifespan_hours=hours_between(first_dt, latest_dt),
                velocity_6h=velocity_6h,
                velocity_24h=velocity_24h,
                reach_score=reach_score,
                tone_counts=tone_counts,
                net_framing=net,
                significant_count=significant_count,
                attention_score=attention_score,
                status=status,
                item_links=[item.link for item in latest_first[:20]],
            )
        )
    clusters = sorted(clusters, key=lambda cluster: (cluster.attention_score, cluster.latest_seen), reverse=True)
    return clusters[:limit] if limit else clusters


def summarize(headline: str, outlet: str) -> str:
    h = headline.rstrip(".")
    lower = headline.lower()
    if any(term in lower for term in ["atm", "cashless", "cash services", "central bank"]):
        return f"{outlet} reports on new rules or guidelines for raising local access-to-cash concerns with the Central Bank."
    if "savings plan" in lower:
        return f"{outlet} reports on unresolved details around the Government's new savings plan."
    if "residential zoned land tax" in lower:
        return f"{outlet} reports on calls for review or concern around a residential zoned land tax bill."
    return f"{outlet} reports: {h}."


def item_sort_key(item: Item) -> tuple[int, str]:
    significant = 0 if item.tag == "SIGNIFICANT" else 1
    try:
        published = parse_pubdate(item.published).isoformat()
    except (TypeError, ValueError):
        published = ""
    return (significant, published)


def fetch_items() -> tuple[list[FetchStatus], list[dict]]:
    fetches = []
    all_items = []
    for name, url in [("Google News RSS", PRIMARY_FEED), ("Supplementary web/news search", SUPPLEMENTARY_FEED)]:
        status, items = fetch_rss(name, url)
        fetches.append(status)
        all_items.extend(items)
    for name, url in BROAD_GOOGLE_FEEDS:
        status, items = fetch_rss(name, url)
        fetches.append(status)
        all_items.extend(items)
    for name, url in DIRECT_SOURCE_FEEDS:
        status, items = fetch_rss(name, url)
        fetches.append(status)
        all_items.extend([item for item in items if is_relevant_direct_source(item.get("headline", ""), item.get("outlet", ""))])
    return fetches, all_items


def build_run(force_new: bool = False) -> tuple[RunResult, list[Item], dict[str, Item]]:
    checked_at = now_utc()
    seen = load_seen()
    stored_items = load_items()
    fetches, raw_items = fetch_items()
    new_items: list[Item] = []
    old_skipped = 0
    duplicate_skipped = 0
    mismatched_skipped = 0
    links_this_run: set[str] = set()

    for raw in raw_items:
        link = raw["link"]
        if not link or link in links_this_run:
            duplicate_skipped += 1
            continue
        links_this_run.add(link)

        outlet = raw["outlet"]
        headline = clean_headline(raw["headline"], outlet)
        if not is_relevant(headline, outlet):
            mismatched_skipped += 1
            continue

        if link in seen and not force_new:
            old_skipped += 1
            continue

        tag, category, reason = classify(headline)
        item = enrich_item(Item(
            outlet=outlet,
            published=raw["published"],
            headline=headline,
            link=link,
            google_link=raw.get("google_link", ""),
            source_link=raw.get("source_link", link),
            summary=summarize(headline, outlet),
            tag=tag,
            reason=reason,
            cluster_key=cluster_for(headline),
            first_seen=checked_at.isoformat().replace("+00:00", "Z"),
            source_feed=raw["source_feed"],
        ))
        stored_items[link] = item
        new_items.append(item)
        seen.add(link)

    save_seen(seen)
    save_items(stored_items)

    stamp = checked_at.isoformat().replace("+00:00", "Z")
    run = RunResult(
        checked_at=stamp,
        checked_at_display=checked_at.strftime("%a, %d %b %Y %H:%M GMT"),
        new_count=len(new_items),
        old_skipped=old_skipped,
        duplicate_skipped=duplicate_skipped,
        mismatched_skipped=mismatched_skipped,
        fetches=fetches,
        new_links=[item.link for item in new_items],
    )
    return run, sorted(new_items, key=item_sort_key), stored_items


def group_items(items: list[Item]) -> list[tuple[str, list[Item]]]:
    groups: dict[str, list[Item]] = {}
    for item in items:
        groups.setdefault(item.cluster_key, []).append(item)
    return sorted(
        groups.items(),
        key=lambda pair: (
            0 if any(item.tag == "SIGNIFICANT" for item in pair[1]) else 1,
            min(item_sort_key(item)[1] for item in pair[1]),
        ),
    )


def item_weight(item: Item) -> int:
    category = category_label(item)
    reach = max(1, item.outlet_weight)
    if category == "FAST REACTION":
        return 3 + reach
    if item.tag == "SIGNIFICANT":
        return 2 + reach
    return reach


def date_from_iso(value: str) -> str:
    return value[:10] if value else "unknown"


def days_between(later: datetime, item: Item) -> int:
    try:
        first_seen = datetime.fromisoformat(item.first_seen.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return 99999
    return (later.date() - first_seen.date()).days


def aggregate_items(items: list[Item]) -> dict:
    total = len(items)
    counts = {"favourable": 0, "neutral": 0, "unfavourable": 0, "mixed": 0}
    weighted_counts = {"favourable": 0, "neutral": 0, "unfavourable": 0, "mixed": 0}
    targets: dict[str, int] = {}
    themes: dict[str, dict[str, int]] = {}
    weighted_score = 0
    total_weight = 0

    for item in items:
        tone = item.favourability if item.favourability in counts else "neutral"
        weight = item_weight(item)
        counts[tone] += 1
        weighted_counts[tone] += weight
        weighted_score += item.sentiment_score * weight
        total_weight += weight
        targets[item.sentiment_target] = targets.get(item.sentiment_target, 0) + 1
        theme = themes.setdefault(item.topic, {"total": 0, "favourable": 0, "neutral": 0, "unfavourable": 0, "mixed": 0})
        theme["total"] += 1
        theme[tone] += 1

    net = 0 if total == 0 else round(((counts["favourable"] - counts["unfavourable"]) / total) * 100)
    weighted_net = 0 if total_weight == 0 else round((weighted_score / total_weight) * 100)
    return {
        "total": total,
        "counts": counts,
        "weighted_counts": weighted_counts,
        "net": net,
        "weighted_net": weighted_net,
        "targets": dict(sorted(targets.items())),
        "themes": dict(sorted(themes.items(), key=lambda pair: pair[1]["total"], reverse=True)),
    }


def build_sentiment_index(stored_items: dict[str, Item], checked_at: str) -> dict:
    items = list(stored_items.values())
    now = datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
    today = now.date().isoformat()
    daily: dict[str, list[Item]] = {}
    for item in items:
        daily.setdefault(date_from_iso(item.first_seen), []).append(item)

    windows = {
        "today": [item for item in items if date_from_iso(item.first_seen) == today],
        "seven_day": [item for item in items if 0 <= days_between(now, item) <= 6],
        "thirty_day": [item for item in items if 0 <= days_between(now, item) <= 29],
        "all_time": items,
        "significant_only": [item for item in items if item.tag == "SIGNIFICANT"],
    }
    return {
        "updated_at": checked_at,
        "method": "Rule-based headline and summary classifier. Scores are auditable media-framing signals, not polling or public favourability.",
        "windows": {name: aggregate_items(window_items) for name, window_items in windows.items()},
        "daily": {day: aggregate_items(day_items) for day, day_items in sorted(daily.items())},
    }


def render_text_output(run: RunResult, new_items: list[Item]) -> str:
    if not new_items:
        lines = ["NONE"]
    else:
        lines = [f"NEW: {len(new_items)} item(s)"]
        for item in new_items:
            lines.append(
                f"[{item.tag}] {item.outlet} | {display_time(item.published)} | "
                f"{item.headline} | {item.link} | {item.summary}"
            )
    for fetch in run.fetches:
        if not fetch.ok:
            lines.append(f"FETCH FAILED: {fetch.name}: {fetch.error}")
    return "\n".join(lines)


BASE_CSS = """
    /* Media monitor — page-specific layout on top of assets/brief.css tokens. */
    main.container { padding-top: var(--s4); padding-bottom: var(--s6); }
    .page-head { margin-bottom: var(--s3); }
    .page-head h1 { margin-bottom: var(--s1); }
    .tagline { margin: 0; color: var(--ink-soft); font-size: .9rem; }
    .status-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: var(--s2); font-size: .82rem; color: var(--ink-soft); }
    .live { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; color: var(--ink); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pos); animation: pulse 2.4s infinite; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--pos) 50%, transparent); } 70% { box-shadow: 0 0 0 7px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
    .newpill { padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: .75rem; background: var(--bg-inset); color: var(--ink-soft); }
    .newpill.has-new { background: color-mix(in srgb, var(--warn) 14%, transparent); color: var(--warn); }
    .linkbtn { font: inherit; font-weight: 600; color: var(--accent); background: none; border: 0; padding: 0; cursor: pointer; }
    .page-title { margin: var(--s4) 0 var(--s1); }
    .lead { color: var(--ink-soft); margin: 0 0 var(--s3); font-size: .88rem; }
    .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 0 0 var(--s3); }
    .controls input[type=search], .controls select { font: inherit; color: var(--ink); background: var(--bg-panel); border: 1px solid var(--rule); border-radius: var(--radius-sm); padding: 9px 12px; }
    .controls input[type=search] { flex: 1; min-width: 150px; }
    .chips { display: flex; gap: 6px; }
    .chip { font: inherit; font-size: .82rem; font-weight: 600; color: var(--ink-soft); background: var(--bg-inset); border: 1px solid var(--rule); border-radius: 999px; padding: 8px 14px; cursor: pointer; }
    .chip.on { background: var(--accent-soft); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--rule)); }
    #fcount { font-size: .82rem; color: var(--ink-soft); margin-left: auto; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 0 0 var(--s3); }
    .stat, .panel { background: var(--bg-panel); border: 1px solid var(--rule-soft); border-radius: var(--radius); box-shadow: var(--shadow); }
    .stat { padding: var(--s3); }
    .stat .num { font-family: var(--font-display); font-size: 1.75rem; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
    .stat .lbl { color: var(--ink-soft); font-size: .82rem; margin-top: 2px; }
    .stat .sub { font-size: .75rem; margin-top: 7px; color: var(--ink-soft); }
    .panel { padding: var(--s3); margin: 0 0 var(--s3); }
    .panel h3 { margin: 0 0 14px; }
    .brief-list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .brief-list li { padding: 10px 0; border-top: 1px solid var(--rule-soft); }
    .brief-list li:first-child { border-top: 0; padding-top: 0; }
    .brief-k { display: block; color: var(--ink-faint); font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
    .attention-item { display: grid; grid-template-columns: 1fr auto; gap: 8px 14px; align-items: start; }
    .attention-item a { color: var(--ink); font-weight: 700; }
    .attention-flags { color: var(--neg); font-size: .75rem; font-weight: 700; text-align: right; }
    .cluster-list { display: flex; flex-direction: column; gap: 12px; }
    .cluster { padding: 13px 0; border-top: 1px solid var(--rule-soft); }
    .cluster:first-child { border-top: 0; padding-top: 0; }
    .cluster h4 { margin: 3px 0 7px; font-size: 1rem; line-height: 1.3; }
    .cluster h4 a { color: var(--ink); }
    .cluster-meta { display: flex; flex-wrap: wrap; gap: 7px; color: var(--ink-soft); font-size: .75rem; font-weight: 600; }
    .cluster-meta span { background: var(--bg-inset); border-radius: var(--radius-sm); padding: 3px 7px; }
    .cluster-life { margin: 7px 0 0; color: var(--ink-soft); font-size: .82rem; }
    .cols { display: flex; align-items: flex-end; gap: 3px; height: 120px; }
    .cols a { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; }
    .cols .bar { background: var(--accent); border-radius: 3px 3px 0 0; min-height: 0; }
    .axis { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: .75rem; color: var(--ink-soft); }
    .tone-chart { display: flex; align-items: stretch; gap: 5px; min-height: 170px; overflow-x: auto; padding: 2px 0 4px; }
    .tone-day { flex: 1 0 24px; min-width: 24px; display: grid; grid-template-rows: 1fr 1px 1fr 18px; gap: 0; color: var(--ink-soft); text-align: center; font-size: .7rem; }
    .tone-up, .tone-down { display: flex; align-items: flex-end; justify-content: center; }
    .tone-down { align-items: flex-start; }
    .tone-base { background: var(--rule); }
    .tone-pos, .tone-neg { width: 70%; border-radius: 4px; min-height: 0; }
    .tone-pos { background: var(--pos); border-radius: 4px 4px 0 0; }
    .tone-neg { background: var(--neg); border-radius: 0 0 4px 4px; }
    .tone-net { font-variant-numeric: tabular-nums; }
    .hbars { display: flex; flex-direction: column; gap: 9px; }
    .hbar { display: grid; grid-template-columns: 130px 1fr 40px; gap: 10px; align-items: center; font-size: .82rem; }
    .hbar .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hbar .track { display: block; background: var(--bg-inset); border-radius: var(--radius-sm); height: 16px; overflow: hidden; }
    .hbar .fill { display: block; background: var(--accent); height: 100%; border-radius: var(--radius-sm); min-width: 3px; }
    .hbar .n { text-align: right; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
    .feed { display: flex; flex-direction: column; gap: 14px; }
    .day-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: var(--s4) 2px 12px; padding-bottom: 7px; border-bottom: 1px solid var(--rule); font-size: .95rem; font-weight: 700; }
    .day-head .day-count { font-size: .75rem; font-weight: 600; color: var(--ink-soft); }
    .card { padding: 0; overflow: hidden; transition: transform .12s ease, border-color .12s ease; }
    .card:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--accent) 30%, var(--rule)); }
    .card.is-new { border-color: var(--warn); }
    .card-body { padding: var(--s3) var(--s3) var(--s3); }
    .card.is-new .card-body::before { content: ""; display: block; height: 3px; width: 32px; border-radius: 3px; background: var(--warn); margin-bottom: 12px; }
    .pills { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-bottom: 10px; }
    .pill { font-size: .68rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 3px 8px; border-radius: var(--radius-sm); background: var(--bg-inset); color: var(--ink-soft); }
    .pill.sig { background: color-mix(in srgb, var(--neg) 12%, transparent); color: var(--neg); }
    .pill.cat { background: var(--accent-soft); color: var(--accent); }
    .pill.new { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
    .pill.tone { background: var(--bg-inset); color: var(--ink); }
    .pill.topic { background: var(--bg-inset); color: var(--ink-soft); }
    .when { margin-left: auto; font-size: .75rem; color: var(--ink-soft); font-weight: 600; white-space: nowrap; }
    .card h2 { margin: 0 0 8px; font-size: 1.2rem; line-height: 1.25; }
    .card h2 a { color: var(--ink); }
    .why { margin: 0 0 13px; color: var(--ink-soft); font-size: .9rem; }
    .sources { display: flex; flex-wrap: wrap; gap: 7px; }
    .source { display: inline-flex; align-items: center; gap: 5px; font-size: .82rem; font-weight: 600; padding: 5px 11px; border: 1px solid var(--rule); border-radius: 999px; background: var(--bg-inset); color: var(--ink); }
    .alert { padding: 11px 13px; margin-bottom: 14px; border-radius: var(--radius-sm); border-left: 4px solid var(--neg); background: color-mix(in srgb, var(--neg) 10%, transparent); color: var(--ink); font-size: .88rem; }
    .empty { text-align: center; color: var(--ink-soft); padding: var(--s6) var(--s3); background: var(--bg-panel); border: 1px dashed var(--rule); border-radius: var(--radius); }
    main footer { margin-top: var(--s5); padding-top: var(--s3); border-top: 1px solid var(--rule); color: var(--ink-soft); font-size: .82rem; }
    table.runs { width: 100%; border-collapse: collapse; font-size: .85rem; background: var(--bg-panel); border: 1px solid var(--rule-soft); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); }
    table.runs th, table.runs td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--rule-soft); }
    table.runs th { background: var(--bg-inset); font-size: .68rem; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-faint); }
    table.runs td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .ok { color: var(--pos); font-weight: 700; }
    .degraded { color: var(--neg); font-weight: 700; }
    .months { display: flex; flex-direction: column; gap: 22px; }
    .month { background: var(--bg-panel); border: 1px solid var(--rule-soft); border-radius: var(--radius); padding: var(--s3); box-shadow: var(--shadow); }
    .month h3 { margin: 0 0 12px; }
    .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
    .cal .dow { text-align: center; font-size: .68rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-faint); padding-bottom: 2px; }
    .cal .cell { aspect-ratio: 1 / 1; min-height: 40px; border: 1px solid var(--rule-soft); border-radius: var(--radius-sm); display: flex; flex-direction: column; justify-content: space-between; padding: 6px 7px; font-size: .82rem; color: var(--ink-soft); background: var(--bg-inset); }
    .cal .cell.pad { border: 0; background: transparent; }
    .cal .cell.future { opacity: .38; }
    .cal a.cell { color: var(--ink-soft); text-decoration: none; font-weight: 600; }
    .cal a.cell .daynum { color: var(--ink); }
    .cal a.cell.has { font-weight: 700; background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 40%, var(--rule)); }
    .cal .cell.today { outline: 2px solid var(--accent); outline-offset: -1px; }
    .cal .count { align-self: flex-start; font-size: .68rem; font-weight: 700; background: var(--accent); color: var(--bg-panel); border-radius: 999px; padding: 1px 7px; line-height: 1.5; }
    .stat-row { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 0 0 var(--s3); color: var(--ink-soft); font-size: .88rem; }
    .stat-row b { color: var(--ink); }
    details { margin-top: var(--s3); }
    summary { cursor: pointer; color: var(--ink-soft); font-size: .82rem; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 10px; padding: 12px; border: 1px solid var(--rule-soft); border-radius: var(--radius-sm); background: var(--bg-panel); font-size: .78rem; line-height: 1.5; }
    @media (max-width: 520px) {
      .card h2 { font-size: 1.1rem; }
      .when { margin-left: 0; }
      table.runs { font-size: .78rem; }
      .hbar { grid-template-columns: 96px 1fr 32px; gap: 8px; font-size: .75rem; }
      #fcount { width: 100%; margin-left: 0; }
    }
"""


BASE_JS = """
  <script>
  (function () {
    function rel(ts) {
      var d = new Date(ts);
      if (isNaN(d)) return null;
      var s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
      var m = Math.round(s / 60), h = Math.round(m / 60), day = Math.round(h / 24);
      if (s < 45) return "just now";
      if (m < 60) return m + " min" + (m !== 1 ? "s" : "") + " ago";
      if (h < 24) return h + " hr" + (h !== 1 ? "s" : "") + " ago";
      if (day < 7) return day + " day" + (day !== 1 ? "s" : "") + " ago";
      return d.toLocaleDateString();
    }
    function tick() {
      document.querySelectorAll("time.rel[data-ts]").forEach(function (el) {
        var r = rel(el.getAttribute("data-ts"));
        if (!r) return;
        if (!el.dataset.abs) el.dataset.abs = el.textContent;
        el.textContent = r;
        el.title = el.dataset.abs;
      });
    }
    tick();
    setInterval(tick, 30000);
    var sb = document.getElementById("share");
    if (sb) {
      sb.addEventListener("click", function () {
        var data = { title: document.title, url: location.href };
        if (navigator.share) { navigator.share(data).catch(function () {}); }
        else if (navigator.clipboard) {
          navigator.clipboard.writeText(location.href);
          sb.textContent = "Link copied";
          setTimeout(function () { sb.textContent = "Share"; }, 1600);
        }
      });
    }
  })();
  </script>
"""


FILTER_JS = """
  <script>
  (function () {
    var q = document.getElementById("q");
    var outletSel = document.getElementById("outlet");
    var count = document.getElementById("fcount");
    var empty = document.getElementById("feed-empty");
    var cards = [].slice.call(document.querySelectorAll(".feed .card"));
    var chips = [].slice.call(document.querySelectorAll(".chip"));
    var sigOnly = false;
    function apply() {
      var term = ((q && q.value) || "").trim().toLowerCase();
      var outlet = ((outletSel && outletSel.value) || "").toLowerCase();
      var shown = 0;
      cards.forEach(function (c) {
        var ok = true;
        if (sigOnly && c.getAttribute("data-sig") !== "1") ok = false;
        if (ok && term && (c.getAttribute("data-text") || "").indexOf(term) < 0) ok = false;
        if (ok && outlet && (c.getAttribute("data-outlets") || "").indexOf(outlet) < 0) ok = false;
        c.style.display = ok ? "" : "none";
        if (ok) shown++;
      });
      document.querySelectorAll(".day-section").forEach(function (sec) {
        var vis = [].slice.call(sec.querySelectorAll(".card")).some(function (c) { return c.style.display !== "none"; });
        sec.style.display = vis ? "" : "none";
      });
      if (count) count.textContent = shown + " of " + cards.length + " stories";
      if (empty) empty.style.display = shown ? "none" : "";
    }
    if (q) q.addEventListener("input", apply);
    if (outletSel) outletSel.addEventListener("change", apply);
    chips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        chips.forEach(function (x) { x.classList.remove("on"); });
        ch.classList.add("on");
        sigOnly = ch.getAttribute("data-sig") === "1";
        apply();
      });
    });
    apply();
  })();
  </script>
"""


def iso_for_item(item: Item) -> str:
    try:
        return parse_pubdate(item.published).isoformat()
    except (TypeError, ValueError):
        return item.first_seen


def short_time(item: Item) -> str:
    try:
        return parse_pubdate(item.published).strftime("%-d %b, %H:%M")
    except (TypeError, ValueError):
        return display_time(item.published)


SECTION_TABS = [
    ("monitor", "Monitor", "index.html"),
    ("fine-gael", "Fine Gael", "fine-gael.html"),
    ("dashboard", "Dashboard", "dashboard.html"),
    ("briefing", "Briefing", "weekly-briefing.html"),
    ("calendar", "Calendar", "calendar.html"),
    ("history", "History", "history.html"),
]


def render_tabrow(active: str, prefix: str = "") -> str:
    links = []
    for key, label, href in SECTION_TABS:
        cls = ' class="active"' if key == active else ""
        links.append(f'<a href="{prefix}{href}"{cls}>{label}</a>')
    return f'<nav class="tabrow" aria-label="Media monitor pages">{"".join(links)}</nav>'


def page_shell(title: str, tagline: str, body: str, status: str = "", active: str = "monitor", description: str = "", extra_head: str = "", include_filter_js: bool = False, prefix: str = "") -> str:
    """Shared page shell.

    ``prefix`` is the relative path back to docs/media/ ("" for root pages,
    "../" for pages in day/ or archive/); asset links resolve one level above
    that, at docs/assets/.
    """
    description = description or "Simon Harris media monitoring dashboard."
    scripts = BASE_JS + (FILTER_JS if include_filter_js else "")
    status_bar = f'<div class="status-bar">{status}</div>' if status else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="900">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(description)}">
  <meta name="theme-color" content="#0B5D4E">
  <link rel="stylesheet" href="{prefix}../assets/brief.css">
  <link rel="icon" href="{prefix}../assets/icon.svg">
  <script src="{prefix}../assets/header.js"></script>
  <style>{BASE_CSS}</style>
  {extra_head}
</head>
<body>
  <brief-header current="media" root="{prefix}../"></brief-header>
  <main class="container">
    <header class="page-head">
      <h1>{html.escape(title)}</h1>
      <p class="tagline">{html.escape(tagline)}</p>
      {status_bar}
    </header>
    {render_tabrow(active, prefix)}
    {body}
  </main>
  {scripts}
</body>
</html>
"""


def render_sentiment_dashboard(sentiment_index: dict) -> str:
    today = sentiment_index["windows"]["today"]
    seven_day = sentiment_index["windows"]["seven_day"]
    significant = sentiment_index["windows"]["significant_only"]
    all_time = sentiment_index["windows"]["all_time"]
    top_theme = next(iter(all_time["themes"].items()), ("None yet", {"total": 0}))
    return f"""
    <section aria-label="Media framing index">
      <div class="stats">
        {render_metric("Today net framing", percent(today["net"]), f'{today["total"]} classified item(s)')}
        {render_metric("7-day weighted framing", percent(seven_day["weighted_net"]), f'{seven_day["total"]} item(s), reach/significance-weighted')}
        {render_metric("Significant-only framing", percent(significant["weighted_net"]), f'{significant["total"]} significant item(s)')}
        {render_metric("Top theme", html.escape(top_theme[0]), f'{top_theme[1]["total"]} item(s) tracked')}
      </div>
      <div class="panel">
        <h3>7-day framing mix</h3>
        {render_hbars(display_tone_counts(seven_day["counts"]))}
      </div>
      <div class="panel">
        <h3>Supportive / critical framing over time</h3>
        {render_tone_timeline(sentiment_index)}
      </div>
    </section>
"""


def render_tone_timeline(sentiment_index: dict, days: int = 30) -> str:
    daily = sentiment_index.get("daily", {})
    try:
        end = datetime.fromisoformat(sentiment_index["updated_at"].replace("Z", "+00:00")).date()
    except (KeyError, ValueError):
        end = now_utc().date()
    series = []
    for offset in range(days - 1, -1, -1):
        day = (end - timedelta(days=offset)).isoformat()
        aggregate = daily.get(day, {})
        counts = aggregate.get("counts", {})
        pos = counts.get("favourable", 0)
        neg = counts.get("unfavourable", 0)
        mixed = counts.get("mixed", 0)
        neutral = counts.get("neutral", 0)
        total = aggregate.get("total", pos + neg + mixed + neutral)
        net = pos - neg
        series.append((day, pos, neg, mixed, neutral, total, net))
    scale = max([max(pos, neg) for _, pos, neg, _, _, _, _ in series] + [1])
    columns = []
    for day, pos, neg, mixed, neutral, total, net in series:
        label = datetime.fromisoformat(day).strftime("%-d %b")
        pos_height = round((pos / scale) * 100)
        neg_height = round((neg / scale) * 100)
        title = f"{label}: supportive {pos}, critical {neg}, net {net}, total {total}"
        tag = "a" if total else "span"
        href = f' href="day/{day}.html"' if total else ""
        columns.append(
            f"""<{tag} class="tone-day"{href} title="{html.escape(title)}">
          <span class="tone-up"><span class="tone-pos" style="height:{pos_height}%"></span></span>
          <span class="tone-base"></span>
          <span class="tone-down"><span class="tone-neg" style="height:{neg_height}%"></span></span>
          <span class="tone-net">{net:+d}</span>
        </{tag}>"""
        )
    start_label = datetime.fromisoformat(series[0][0]).strftime("%-d %b") if series else ""
    end_label = datetime.fromisoformat(series[-1][0]).strftime("%-d %b") if series else ""
    return f"""
      <div class="tone-chart" aria-label="Daily supportive and critical media framing">{''.join(columns)}</div>
      <div class="axis"><span>{html.escape(start_label)}</span><span>green = supportive, orange = critical, number = net</span><span>{html.escape(end_label)}</span></div>
"""


def display_tone(value: str) -> str:
    return {
        "favourable": "supportive",
        "unfavourable": "critical",
        "neutral": "neutral factual",
        "mixed": "mixed framing",
    }.get(value, value or "neutral factual")


def display_tone_counts(values: dict[str, int]) -> dict[str, int]:
    return {display_tone(key): value for key, value in values.items()}


def percent(value: int) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value}%"


def render_metric(label: str, value: str, detail: str) -> str:
    return f"""
        <div class="stat">
          <div class="num">{value}</div>
          <div class="lbl">{html.escape(label)}</div>
          <div class="sub">{html.escape(detail)}</div>
        </div>
"""


def render_hbars(values: dict[str, int], limit: int = 10) -> str:
    if not values:
        return '<p class="lead">No data yet.</p>'
    top = sorted(values.items(), key=lambda pair: pair[1], reverse=True)[:limit]
    max_value = max(value for _, value in top) or 1
    rows = []
    for name, value in top:
        width = max(3, round((value / max_value) * 100))
        rows.append(
            f'<div class="hbar"><span class="name" title="{html.escape(str(name))}">{html.escape(str(name).title())}</span><span class="track"><span class="fill" style="width:{width}%"></span></span><span class="n">{value}</span></div>'
        )
    return f'<div class="hbars">{"".join(rows)}</div>'


def item_timestamp_sort(item: Item) -> datetime:
    try:
        return parse_pubdate(item.published)
    except (TypeError, ValueError):
        try:
            return datetime.fromisoformat(item.first_seen.replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return datetime.min.replace(tzinfo=timezone.utc)


def item_day(item: Item) -> str:
    return item_timestamp_sort(item).date().isoformat()


def day_label(day: str) -> str:
    try:
        parsed = datetime.fromisoformat(day).date()
    except ValueError:
        return day
    today = now_utc().date()
    if parsed == today:
        return "Today"
    return parsed.strftime("%A, %-d %B")


def build_attention_queue(items: list[Item], limit: int = 8) -> list[Item]:
    grouped: dict[str, int] = {}
    for item in items:
        grouped[item.cluster_key] = grouped.get(item.cluster_key, 0) + 1

    def score(item: Item) -> tuple[int, datetime]:
        points = 0
        points += 5 if item.tag == "SIGNIFICANT" else 0
        points += 4 if item.favourability == "unfavourable" else 0
        points += 3 if item.topic == "Polling" else 0
        points += 2 if grouped.get(item.cluster_key, 0) >= 3 else 0
        points += item.outlet_weight
        return points, item_timestamp_sort(item)

    candidates = [
        item
        for item in items
        if item.attention
        or item.tag == "SIGNIFICANT"
        or item.favourability == "unfavourable"
        or grouped.get(item.cluster_key, 0) >= 3
    ]
    return sorted(candidates, key=score, reverse=True)[:limit]


def render_attention_queue(items: list[Item]) -> str:
    queue = build_attention_queue(items)
    if not queue:
        return '<div class="panel"><h3>Needs attention</h3><p class="lead">No high-priority items flagged by the current rules.</p></div>'
    rows = []
    for item in queue:
        flags = item.attention or [category_label(item)]
        rows.append(
            f"""<li class="attention-item">
              <span><span class="brief-k">{html.escape(item.outlet)} · {html.escape(short_time(item))}</span><a href="{html.escape(item.source_link or item.link)}" rel="noopener">{html.escape(item.headline)}</a></span>
              <span class="attention-flags">{html.escape(", ".join(flags[:3]))}</span>
            </li>"""
        )
    return f'<div class="panel"><h3>Needs attention</h3><ul class="brief-list">{"".join(rows)}</ul></div>'


def cluster_lead_item(cluster: StoryCluster, items_by_link: dict[str, Item]) -> Item | None:
    for link in cluster.item_links:
        if link in items_by_link:
            return items_by_link[link]
    return None


def render_story_clusters(clusters: list[StoryCluster], stored_items: dict[str, Item], limit: int = 8) -> str:
    if not clusters:
        return '<div class="panel"><h3>Story clusters</h3><p class="lead">No story clusters yet.</p></div>'
    rows = []
    for cluster in clusters[:limit]:
        lead = cluster_lead_item(cluster, stored_items)
        href = (lead.source_link or lead.link) if lead else "#"
        tone = display_tone_counts(cluster.tone_counts)
        tone_label = ", ".join(f"{name}: {count}" for name, count in tone.items() if count)
        outlet_label = ", ".join(cluster.outlets[:5]) + ("..." if len(cluster.outlets) > 5 else "")
        rows.append(
            f"""<article class="cluster">
              <span class="brief-k">{html.escape(cluster.status)} · {html.escape(cluster.topic)}</span>
              <h4><a href="{html.escape(href)}" rel="noopener">{html.escape(cluster.title)}</a></h4>
              <div class="cluster-meta">
                <span>{cluster.item_count} item(s)</span>
                <span>{cluster.outlet_count} outlet(s)</span>
                <span>{cluster.velocity_6h} in 6h</span>
                <span>{cluster.velocity_24h} in 24h</span>
                <span>reach {cluster.reach_score}</span>
                <span>net {percent(cluster.net_framing)}</span>
              </div>
              <p class="cluster-life">First seen {html.escape(cluster.first_seen[:16].replace("T", " "))} · latest {html.escape(cluster.latest_seen[:16].replace("T", " "))} · {cluster.lifespan_hours}h lifecycle · {html.escape(tone_label or "neutral factual")} · {html.escape(outlet_label)}</p>
            </article>"""
        )
    return f'<div class="panel"><h3>Story clusters</h3><div class="cluster-list">{"".join(rows)}</div></div>'


def trend_summary(items: list[Item], sentiment_index: dict) -> list[tuple[str, str]]:
    today = now_utc()
    last_7 = [item for item in items if 0 <= days_between(today, item) <= 6]
    prev_7 = [item for item in items if 7 <= days_between(today, item) <= 13]
    seven = sentiment_index["windows"]["seven_day"]
    topics = count_by(last_7, lambda item: item.topic)
    outlets = count_by(last_7, lambda item: item.outlet)
    critical_topics = count_by([item for item in last_7 if item.favourability == "unfavourable"], lambda item: item.topic)
    top_topic = next(iter(topics.items()), ("None yet", 0))
    top_outlet = next(iter(outlets.items()), ("None yet", 0))
    top_critical = next(iter(critical_topics.items()), ("None flagged", 0))
    return [
        ("Coverage volume", f"{len(last_7)} item(s) in the last 7 days; {trend_text_plain(len(last_7), len(prev_7))}."),
        ("Net framing", f"{percent(seven['weighted_net'])} weighted over 7 days, separating coverage volume from supportive/critical wording."),
        ("Main topic", f"{top_topic[0]} leads recent coverage with {top_topic[1]} item(s)."),
        ("Critical concentration", f"{top_critical[0]} accounts for {top_critical[1]} recent critical item(s)."),
        ("Leading outlet", f"{top_outlet[0]} has the most recent pickups with {top_outlet[1]} item(s)."),
    ]


def cluster_summary(clusters: list[StoryCluster]) -> list[tuple[str, str]]:
    active = [cluster for cluster in clusters if cluster.status in {"emerging", "active"}]
    emerging = [cluster for cluster in clusters if cluster.status == "emerging"]
    top = clusters[0] if clusters else None
    persistent = [cluster for cluster in clusters if cluster.lifespan_hours >= 48]
    if not top:
        return [("Story clusters", "No clusters have been created yet.")]
    return [
        ("Active narratives", f"{len(active)} active cluster(s), including {len(emerging)} emerging in the last 6 hours."),
        ("Top cluster", f"{top.title} across {top.outlet_count} outlet(s), {top.item_count} item(s), reach score {top.reach_score}."),
        ("Persistence", f"{len(persistent)} cluster(s) have lasted at least 48 hours."),
    ]


def render_trend_summary(items: list[Item], sentiment_index: dict) -> str:
    rows = [
        f'<li><span class="brief-k">{html.escape(label)}</span>{html.escape(text)}</li>'
        for label, text in trend_summary(items, sentiment_index)
    ]
    return f'<div class="panel"><h3>Trend summary</h3><ul class="brief-list">{"".join(rows)}</ul></div>'


def render_cluster_summary(clusters: list[StoryCluster]) -> str:
    rows = [
        f'<li><span class="brief-k">{html.escape(label)}</span>{html.escape(text)}</li>'
        for label, text in cluster_summary(clusters)
    ]
    return f'<div class="panel"><h3>Narrative summary</h3><ul class="brief-list">{"".join(rows)}</ul></div>'


def render_controls(items: list[Item], placeholder: str) -> str:
    outlets = sorted({item.outlet for item in items})
    options = ['<option value="">All outlets</option>'] + [
        f'<option value="{html.escape(outlet.lower())}">{html.escape(outlet)}</option>' for outlet in outlets
    ]
    return f"""
    <div class="controls">
      <input id="q" type="search" placeholder="{html.escape(placeholder)}" autocomplete="off">
      <div class="chips">
        <button type="button" class="chip on" data-sig="0">All</button>
        <button type="button" class="chip" data-sig="1">Significant</button>
      </div>
      <select id="outlet" aria-label="Filter by outlet">{''.join(options)}</select>
      <span id="fcount"></span>
    </div>
"""


def render_feed(items: list[Item], new_links: set[str] | None = None, show_tone: bool = True) -> str:
    new_links = new_links or set()
    if not items:
        return '<div class="empty">No stories captured yet.</div>'
    sorted_items = sorted(items, key=item_timestamp_sort, reverse=True)
    sections = []
    for day in sorted({item_day(item) for item in sorted_items}, reverse=True):
        day_items = [item for item in sorted_items if item_day(item) == day]
        cards = "".join(render_card(item, item.link in new_links, show_tone) for item in day_items)
        sections.append(
            f"""<section class="day-section" data-day="{html.escape(day)}">
      <h3 class="day-head"><span>{html.escape(day_label(day))}</span><span class="day-count">{len(day_items)} hit(s)</span></h3>
      <div class="feed">{cards}</div>
    </section>"""
        )
    return "\n".join(sections) + '<div id="feed-empty" class="empty" style="display:none">No stories match your filter.</div>'


def render_card(item: Item, is_new: bool = False, show_tone: bool = True) -> str:
    category = category_label(item)
    sig = "1" if item.tag == "SIGNIFICANT" else "0"
    read_link = item.source_link or item.link
    search = " ".join([item.cluster_key, item.topic, item.headline, item.summary, item.outlet, item.favourability, category]).lower()
    pills = []
    if is_new:
        pills.append('<span class="pill new">New</span>')
    if item.tag == "SIGNIFICANT":
        pills.append('<span class="pill sig">Significant</span>')
    pills.append(f'<span class="pill cat">{html.escape(category)}</span>')
    pills.append(f'<span class="pill topic">{html.escape(item.topic)}</span>')
    if show_tone:
        pills.append(f'<span class="pill tone">{html.escape(display_tone(item.favourability).title())} {item.sentiment_score:+d}</span>')
    pills_html = "".join(pills)
    tone = ""
    if show_tone:
        tone = f'<p class="why"><strong>Framing:</strong> {html.escape(item.sentiment_rationale)} Target: {html.escape(item.sentiment_target)}; confidence: {html.escape(item.sentiment_confidence)}.</p>'
    google_link = ""
    if item.google_link and item.google_link != read_link:
        google_link = f'<a class="source" href="{html.escape(item.google_link)}" rel="noopener">Google News <span class="arr">&rsaquo;</span></a>'
    return f"""
    <article class="card{' is-new' if is_new else ''}" data-sig="{sig}" data-cat="{html.escape(category.lower())}" data-outlets="{html.escape(item.outlet.lower())}" data-text="{html.escape(search)}">
      <div class="card-body">
        <div class="pills">{pills_html}<time class="when rel" data-ts="{html.escape(iso_for_item(item))}">{html.escape(short_time(item))}</time></div>
        <h2><a href="{html.escape(read_link)}" rel="noopener">{html.escape(item.headline)}</a></h2>
        <p class="why">{html.escape(item.reason)}</p>
        {tone}
        <div class="sources"><a class="source" href="{html.escape(read_link)}" rel="noopener">{html.escape(item.outlet)} <span class="arr">&rsaquo;</span></a>{google_link}</div>
      </div>
    </article>
"""


def category_label(item: Item) -> str:
    _, category, _ = classify(item.headline)
    if item.cluster_key != re.sub(r"[^a-z0-9]+", "-", item.headline.lower()).strip("-")[:80] and item.cluster_key:
        if item.cluster_key in {"Access to cash", "Savings plan", "Residential zoned land tax"}:
            return category
    return category


def category_for_group(items: list[Item]) -> str:
    categories = [category_label(item) for item in items]
    return categories[0] if categories else "MENTION"


def why_for_group(items: list[Item]) -> str:
    if len(items) > 1:
        return "Multiple outlets are carrying the same theme, so pickup and framing should be watched together."
    return items[0].reason if items else "No immediate press-office action is obvious."


def status_nav(run: RunResult, new_count: int, fine_gael: bool = False) -> str:
    new_class = "newpill has-new" if new_count else "newpill"
    new_text = f"{new_count} new item(s)" if new_count else "No new items in last check"
    return (
        f'<span class="live"><span class="dot"></span> Updated <time class="rel" data-ts="{html.escape(run.checked_at)}">{html.escape(run.checked_at_display)}</time></span>'
        f'<span class="{new_class}">{html.escape(new_text)}</span>'
        '<button id="share" class="linkbtn" type="button">Share</button>'
    )


def render_index_page(run: RunResult, new_items: list[Item], stored_items: dict[str, Item], sentiment_index: dict, clusters: list[StoryCluster], prefix: str = "") -> str:
    items = list(stored_items.values())
    fetch_failures = "".join(
        f'<p class="alert">FETCH FAILED: {html.escape(fetch.name)}: {html.escape(fetch.error)}</p>'
        for fetch in run.fetches
        if not fetch.ok
    )
    body = f"""
    <h2 class="page-title">Latest news</h2>
    {render_sentiment_dashboard(sentiment_index)}
    {render_trend_summary(items, sentiment_index)}
    {render_cluster_summary(clusters)}
    {render_attention_queue(items)}
    {render_story_clusters(clusters, stored_items, limit=6)}
    {render_controls(items, "Search coverage...")}
    {fetch_failures}
    {render_feed(items, set(run.new_links), show_tone=True)}
    <details>
      <summary>Plain-text output</summary>
      <pre>{html.escape(render_text_output(run, new_items))}</pre>
    </details>
    <footer>
      <p>Automated media monitor · feeds checked every 30 minutes · <a href="dashboard.html">dashboard</a> · <a href="weekly-briefing.html">weekly briefing</a> · <a href="calendar.html">archive</a> · <a href="history.html">run history</a></p>
      <p>{html.escape(feed_health(run))} · last check {html.escape(run.checked_at_display)}</p>
    </footer>
"""
    return page_shell(
        "Simon Harris Media Monitor",
        "Tracking Simon Harris across the news, updated automatically.",
        body,
        status=status_nav(run, run.new_count),
        active="monitor",
        description=latest_description(items),
        include_filter_js=True,
        prefix=prefix,
    )


def feed_health(run: RunResult) -> str:
    failed = [fetch.name for fetch in run.fetches if not fetch.ok]
    return "all feeds healthy" if not failed else "feed issue: " + ", ".join(failed)


def latest_description(items: list[Item]) -> str:
    heads = [item.headline for item in sorted(items, key=item_timestamp_sort, reverse=True)[:3]]
    return "Latest: " + " • ".join(heads) if heads else "Simon Harris media monitoring dashboard."


def render_dashboard_page(run: RunResult, stored_items: dict[str, Item], sentiment_index: dict, clusters: list[StoryCluster]) -> str:
    items = list(stored_items.values())
    total = len(items)
    today = now_utc()
    last_7 = [item for item in items if 0 <= days_between(today, item) <= 6]
    prev_7 = [item for item in items if 7 <= days_between(today, item) <= 13]
    outlets = count_by(items, lambda item: item.outlet)
    topics = count_by(items, lambda item: item.topic)
    tones = display_tone_counts(sentiment_index["windows"]["all_time"]["counts"])
    tiers = count_by(items, lambda item: item.outlet_tier)
    significant = [item for item in items if item.tag == "SIGNIFICANT"]
    daily = count_by(items, item_day)
    active_clusters = [cluster for cluster in clusters if cluster.status in {"emerging", "active"}]
    top_cluster = clusters[0] if clusters else None
    body = f"""
    <h2 class="page-title">Coverage dashboard</h2>
    <p class="lead">Computed from {total} tracked stories across {len(load_runs())} monitoring runs.</p>
    <div class="stats">
      <div class="stat"><div class="num">{total}</div><div class="lbl">Total media hits</div></div>
      <div class="stat"><div class="num">{len(last_7)}</div><div class="lbl">Last 7 days</div><div class="sub">{trend_text(len(last_7), len(prev_7))}</div></div>
      <div class="stat"><div class="num">{len(outlets)}</div><div class="lbl">Outlets covering</div></div>
      <div class="stat"><div class="num">{percent_int(len(significant), total)}</div><div class="lbl">Significant share</div><div class="sub">{len(significant)} of {total}</div></div>
      <div class="stat"><div class="num">{len(active_clusters)}</div><div class="lbl">Active story clusters</div><div class="sub">{html.escape(top_cluster.title[:72]) if top_cluster else "No clusters yet"}</div></div>
    </div>
    {render_trend_summary(items, sentiment_index)}
    {render_cluster_summary(clusters)}
    {render_attention_queue(items)}
    {render_story_clusters(clusters, stored_items, limit=12)}
    <div class="panel"><h3>Supportive / critical framing over time</h3>{render_tone_timeline(sentiment_index)}</div>
    <div class="panel"><h3>Coverage over time</h3>{render_coverage_columns(daily)}</div>
    <div class="panel"><h3>Media reach — coverage by outlet</h3>{render_hbars(outlets)}</div>
    <div class="panel"><h3>Coverage by outlet tier</h3>{render_hbars(tiers)}</div>
    <div class="panel"><h3>Coverage by topic</h3>{render_hbars(topics)}</div>
    <div class="panel"><h3>Media framing</h3>{render_hbars(tones)}</div>
    <footer><p>Analytics are derived from Google News and direct RSS coverage tracked by this monitor. Framing is a headline/summary signal, not polling.</p></footer>
"""
    return page_shell(
        "Simon Harris Media Monitor - Dashboard",
        "Coverage analytics",
        body,
        active="dashboard",
        description="Coverage analytics for Simon Harris Media Monitor: volume, media reach, topic mix, and media framing.",
    )


def count_by(items: list[Item], key_fn) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        key = str(key_fn(item))
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items(), key=lambda pair: pair[1], reverse=True))


def trend_text(current: int, previous: int) -> str:
    diff = current - previous
    if diff > 0:
        return f'<span class="ok">up {diff} vs previous 7 days</span>'
    if diff < 0:
        return f'<span class="degraded">down {abs(diff)} vs previous 7 days</span>'
    return "unchanged vs previous 7 days"


def trend_text_plain(current: int, previous: int) -> str:
    diff = current - previous
    if diff > 0:
        return f"up {diff} vs previous 7 days"
    if diff < 0:
        return f"down {abs(diff)} vs previous 7 days"
    return "unchanged vs previous 7 days"


def percent_int(part: int, total: int) -> str:
    return "0%" if total == 0 else f"{round((part / total) * 100)}%"


def render_coverage_columns(daily: dict[str, int]) -> str:
    today = now_utc().date()
    days = [(today - timedelta(days=offset)).isoformat() for offset in range(29, -1, -1)]
    max_count = max([daily.get(day, 0) for day in days] + [1])
    bars = []
    for day in days:
        count = daily.get(day, 0)
        height = round((count / max_count) * 100)
        label = datetime.fromisoformat(day).strftime("%-d %b")
        bars.append(f'<a href="day/{day}.html" title="{html.escape(label)}: {count} hit(s)" style="height:100%"><span class="bar" style="height:{height}%"></span></a>')
    return f'<div class="cols">{"".join(bars)}</div><div class="axis"><span>{datetime.fromisoformat(days[0]).strftime("%-d %b")}</span><span>busiest: {max(daily, key=daily.get) if daily else "none"} ({max_count})</span><span>{datetime.fromisoformat(days[-1]).strftime("%-d %b")}</span></div>'


def render_history_page(run: RunResult) -> str:
    runs = load_runs()
    rows = []
    for entry in runs:
        fetch_items = sum(fetch.get("count", 0) for fetch in entry.get("fetches", []))
        healthy = all(fetch.get("ok") for fetch in entry.get("fetches", []))
        archive_file = entry.get("archive_file", "")
        # older per-run snapshots are pruned; only link the ones still on disk
        if archive_file and (ROOT / archive_file).exists():
            snapshot_cell = f'<a href="{html.escape(archive_file)}">snapshot</a>'
        else:
            snapshot_cell = '<span class="muted">pruned</span>'
        rows.append(
            f'<tr><td>{html.escape(entry.get("checked_at_display", entry.get("checked_at", "")))}</td><td class="num">{entry.get("new_count", 0)}</td><td class="num">{entry.get("old_skipped", 0)}</td><td class="num">{entry.get("duplicate_skipped", 0)}</td><td class="num">{entry.get("mismatched_skipped", 0)}</td><td class="num">{fetch_items}</td><td class="{"ok" if healthy else "degraded"}">{"ok" if healthy else "issue"}</td><td>{snapshot_cell}</td></tr>'
        )
    body = f"""
    <h2 class="page-title">Run history</h2>
    <p class="lead">{len(runs)} run(s) recorded · {sum(entry.get("new_count", 0) for entry in runs)} new item(s) found in total</p>
    <table class="runs">
      <thead><tr><th>Checked at</th><th>New</th><th>Old skipped</th><th>Duplicates</th><th>Off-topic</th><th>Feed items</th><th>Feeds</th><th>Snapshot</th></tr></thead>
      <tbody>{''.join(rows)}</tbody>
    </table>
"""
    return page_shell(
        "Simon Harris Media Monitor - Run history",
        "Run history",
        body,
        "",
        active="history",
        description="Monitoring run history for Simon Harris Media Monitor.",
    )


def render_calendar_page(stored_items: dict[str, Item]) -> str:
    items = list(stored_items.values())
    counts = count_by(items, item_day)
    today = now_utc().date()
    start = min((item_timestamp_sort(item).date() for item in items), default=today)
    months = []
    cursor = start.replace(day=1)
    while cursor <= today.replace(day=1):
        months.append(render_month(cursor.year, cursor.month, counts, today))
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)
    body = f"""
    <h2 class="page-title">Archive by day</h2>
    <div class="stat-row"><span><b>{len(counts)}</b> day(s) with coverage</span><span><b>{len(items)}</b> media hit(s) total</span><span>tracking since <b>{html.escape(start.strftime("%-d %B %Y"))}</b></span></div>
    <div class="months">{''.join(months)}</div>
"""
    return page_shell(
        "Simon Harris Media Monitor - Archive by day",
        "Archive by day",
        body,
        "",
        active="calendar",
        description="Browse Simon Harris Media Monitor coverage day by day.",
    )


def render_month(year: int, month: int, counts: dict[str, int], today) -> str:
    cal = calendar.Calendar(firstweekday=0)
    cells = ['<div class="dow">Mon</div><div class="dow">Tue</div><div class="dow">Wed</div><div class="dow">Thu</div><div class="dow">Fri</div><div class="dow">Sat</div><div class="dow">Sun</div>']
    for date in cal.itermonthdates(year, month):
        if date.month != month:
            cells.append('<div class="cell pad"></div>')
            continue
        day = date.isoformat()
        count = counts.get(day, 0)
        if date > today:
            cells.append(f'<div class="cell future"><span class="daynum">{date.day}</span></div>')
        elif count:
            cls = "cell today has" if date == today else "cell has"
            cells.append(f'<a class="{cls}" href="day/{day}.html" title="{count} media hit(s)"><span class="daynum">{date.day}</span><span class="count">{count}</span></a>')
        else:
            cls = "cell today" if date == today else "cell"
            cells.append(f'<a class="{cls}" href="day/{day}.html" title="No media hits captured"><span class="daynum">{date.day}</span></a>')
    return f'<div class="month"><h3>{calendar.month_name[month]} {year}</h3><div class="cal">{"".join(cells)}</div></div>'


def render_day_page(day: str, items: list[Item]) -> str:
    day_items = [item for item in items if item_day(item) == day]
    body = f"""
    <h2 class="page-title">{html.escape(day_label(day))}</h2>
    <div class="stat-row"><span><b>{len(day_items)}</b> media hit(s)</span><span><b>{len({item.outlet for item in day_items})}</b> outlet(s)</span></div>
    {render_feed(day_items, show_tone=True)}
"""
    return page_shell(
        f"Simon Harris Media Monitor - {day}",
        "Daily archive",
        body,
        '<a href="../calendar.html">&larr; Archive by day</a>',
        description=f"Simon Harris media coverage for {day}.",
        include_filter_js=True,
        prefix="../",
    )


def load_fine_gael_items() -> dict[str, Item]:
    if not FINE_GAEL_ITEMS_PATH.exists():
        return {}
    raw = json.loads(FINE_GAEL_ITEMS_PATH.read_text(encoding="utf-8"))
    return {link: item_from_raw(item) for link, item in raw.items()}


def save_fine_gael_items(items: dict[str, Item]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    FINE_GAEL_ITEMS_PATH.write_text(json.dumps({link: asdict(item) for link, item in sorted(items.items())}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_fine_gael_seen() -> set[str]:
    if not FINE_GAEL_SEEN_PATH.exists():
        return set()
    return {line.strip() for line in FINE_GAEL_SEEN_PATH.read_text(encoding="utf-8").splitlines() if line.strip()}


def save_fine_gael_seen(links: set[str]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    FINE_GAEL_SEEN_PATH.write_text("\n".join(sorted(links)) + ("\n" if links else ""), encoding="utf-8")


def update_fine_gael(run: RunResult) -> tuple[list[Item], dict[str, Item], FetchStatus]:
    status, raw_items = fetch_rss("Fine Gael RSS", FINE_GAEL_FEED)
    seen = load_fine_gael_seen()
    stored = load_fine_gael_items()
    new_items: list[Item] = []
    for raw in raw_items:
        link = raw["link"]
        if not link or link in seen:
            continue
        outlet = raw["outlet"]
        headline = clean_headline(raw["headline"], outlet)
        tag, _, reason = classify(headline)
        item = enrich_item(Item(
            outlet=outlet,
            published=raw["published"],
            headline=headline,
            link=link,
            google_link=raw.get("google_link", ""),
            source_link=raw.get("source_link", link),
            summary=summarize(headline, outlet),
            tag=tag,
            reason=reason,
            cluster_key=cluster_for(headline),
            first_seen=run.checked_at,
            source_feed="Fine Gael RSS",
        ))
        stored[link] = item
        new_items.append(item)
        seen.add(link)
    save_fine_gael_seen(seen)
    save_fine_gael_items(stored)
    return new_items, stored, status


def render_fine_gael_page(run: RunResult, new_items: list[Item], stored_items: dict[str, Item], status: FetchStatus) -> str:
    items = list(stored_items.values())
    failure = "" if status.ok else f'<p class="alert">FETCH FAILED: {html.escape(status.name)}: {html.escape(status.error)}</p>'
    body = f"""
    <h2 class="page-title">Fine Gael news</h2>
    {render_controls(items, "Search Fine Gael coverage...")}
    {failure}
    {render_feed(items, {item.link for item in new_items}, show_tone=False)}
    <footer><p>Fine Gael coverage from Google News · part of the <a href="index.html">Simon Harris Media Monitor</a> · checked every 30 minutes.</p></footer>
"""
    return page_shell(
        "Fine Gael News Monitor",
        "Fine Gael media coverage, updated automatically.",
        body,
        status_nav(run, len(new_items), fine_gael=True),
        description=latest_description(items),
        include_filter_js=True,
    )


def recent_window_items(items: list[Item], days: int = 7) -> list[Item]:
    today = now_utc()
    return [item for item in items if 0 <= days_between(today, item) <= days - 1]


def render_weekly_briefing_markdown(run: RunResult, stored_items: dict[str, Item], sentiment_index: dict, clusters: list[StoryCluster]) -> str:
    items = list(stored_items.values())
    recent = sorted(recent_window_items(items, 7), key=item_timestamp_sort, reverse=True)
    attention = build_attention_queue(recent or items, limit=10)
    topics = count_by(recent, lambda item: item.topic)
    outlets = count_by(recent, lambda item: item.outlet)
    tone = sentiment_index["windows"]["seven_day"]
    lines = [
        "# Simon Harris Media Briefing",
        "",
        f"Updated: {run.checked_at_display}",
        "",
        "## Snapshot",
        "",
        f"- Recent coverage: {len(recent)} item(s) in the last 7 days.",
        f"- Weighted net framing: {percent(tone['weighted_net'])} (supportive minus critical, reach/significance-weighted).",
        f"- Significant items: {len([item for item in recent if item.tag == 'SIGNIFICANT'])}.",
        "",
        "## Trend Summary",
        "",
    ]
    for label, text in trend_summary(items, sentiment_index):
        lines.append(f"- {label}: {text}")
    lines.extend(["", "## Narrative Summary", ""])
    for label, text in cluster_summary(clusters):
        lines.append(f"- {label}: {text}")
    lines.extend(["", "## Needs Attention", ""])
    if attention:
        for item in attention:
            flags = ", ".join(item.attention or [category_label(item)])
            lines.append(f"- [{flags}] {item.outlet}: {item.headline} ({item.source_link or item.link})")
    else:
        lines.append("- No high-priority items flagged by the current rules.")
    lines.extend(["", "## Top Topics", ""])
    for topic, count in list(topics.items())[:8]:
        lines.append(f"- {topic}: {count}")
    lines.extend(["", "## Top Outlets", ""])
    for outlet, count in list(outlets.items())[:8]:
        lines.append(f"- {outlet}: {count}")
    lines.extend(["", "## Story Clusters", ""])
    for cluster in clusters[:10]:
        outlets_text = ", ".join(cluster.outlets[:6])
        lines.append(
            f"- [{cluster.status}] {cluster.title} — {cluster.item_count} item(s), {cluster.outlet_count} outlet(s), "
            f"{cluster.velocity_6h} in 6h, {cluster.velocity_24h} in 24h, net {percent(cluster.net_framing)}. Outlets: {outlets_text}"
        )
    lines.extend(["", "## Recent Items", ""])
    for item in recent[:20]:
        lines.append(f"- [{display_tone(item.favourability)}] {item.outlet}: {item.headline} ({item.source_link or item.link})")
    lines.append("")
    return "\n".join(lines)


def render_weekly_briefing_page(run: RunResult, stored_items: dict[str, Item], sentiment_index: dict, clusters: list[StoryCluster]) -> str:
    items = list(stored_items.values())
    recent = sorted(recent_window_items(items, 7), key=item_timestamp_sort, reverse=True)
    tone = sentiment_index["windows"]["seven_day"]
    topic_rows = render_hbars(count_by(recent, lambda item: item.topic))
    outlet_rows = render_hbars(count_by(recent, lambda item: item.outlet))
    body = f"""
    <h2 class="page-title">Weekly briefing</h2>
    <p class="lead">A press-office readout of the last 7 days, refreshed with each monitoring run.</p>
    <div class="stats">
      <div class="stat"><div class="num">{len(recent)}</div><div class="lbl">Recent media hits</div></div>
      <div class="stat"><div class="num">{percent(tone["weighted_net"])}</div><div class="lbl">Weighted net framing</div><div class="sub">supportive minus critical</div></div>
      <div class="stat"><div class="num">{len([item for item in recent if item.tag == "SIGNIFICANT"])}</div><div class="lbl">Significant items</div></div>
      <div class="stat"><div class="num">{len({item.outlet for item in recent})}</div><div class="lbl">Outlets</div></div>
    </div>
    {render_trend_summary(items, sentiment_index)}
    {render_cluster_summary(clusters)}
    {render_attention_queue(recent or items)}
    {render_story_clusters(clusters, stored_items, limit=10)}
    <div class="panel"><h3>Top topics this week</h3>{topic_rows}</div>
    <div class="panel"><h3>Top outlets this week</h3>{outlet_rows}</div>
    <div class="panel"><h3>Recent coverage</h3>{render_feed(recent, show_tone=True)}</div>
    <footer><p><a href="weekly-briefing.md">Markdown briefing</a> · generated {html.escape(run.checked_at_display)}</p></footer>
"""
    return page_shell(
        "Simon Harris Media Monitor - Weekly briefing",
        "Weekly briefing",
        body,
        "",
        description="Weekly Simon Harris media briefing with trend summary, attention queue, topics, outlets, and recent coverage.",
        include_filter_js=True,
    )


def prune_archive(keep_all_days: int = 14) -> None:
    """Cap archive growth: keep every snapshot from the last `keep_all_days`
    days, and only the last snapshot per day before that (~285KB/day instead
    of ~5.5MB/day)."""
    cutoff = (now_utc() - timedelta(days=keep_all_days)).strftime("%Y%m%d")
    by_day: dict[str, list[Path]] = {}
    for f in sorted(ARCHIVE_DIR.glob("*.html")):
        match = re.match(r"(\d{8})T", f.name)
        if match:
            by_day.setdefault(match.group(1), []).append(f)
    for day, files in by_day.items():
        if day < cutoff:
            for f in files[:-1]:
                f.unlink()


def write_outputs(run: RunResult, new_items: list[Item], stored_items: dict[str, Item]) -> None:
    ensure_override_files()
    stored_items = {link: enrich_item(item) for link, item in stored_items.items()}
    save_items(stored_items)
    sentiment_index = build_sentiment_index(stored_items, run.checked_at)
    clusters = build_story_clusters(list(stored_items.values()), run.checked_at)
    save_sentiment(sentiment_index)
    save_clusters(clusters)
    fg_new, fg_items, fg_status = update_fine_gael(run)
    ARCHIVE_DIR.mkdir(exist_ok=True)
    DAY_DIR.mkdir(exist_ok=True)
    archive_name = f"{run.checked_at.replace(':', '').replace('-', '')}.html"
    run.archive_file = f"archive/{archive_name}"
    runs = load_runs()
    runs.insert(0, asdict(run))
    save_runs(runs)

    html_text = render_index_page(run, new_items, stored_items, sentiment_index, clusters)
    INDEX_PATH.write_text(html_text, encoding="utf-8")
    # archive copies live one level deeper, so relative asset/nav paths differ
    archive_text = render_index_page(run, new_items, stored_items, sentiment_index, clusters, prefix="../")
    (ARCHIVE_DIR / archive_name).write_text(archive_text, encoding="utf-8")
    prune_archive()
    DASHBOARD_PATH.write_text(render_dashboard_page(run, stored_items, sentiment_index, clusters), encoding="utf-8")
    WEEKLY_BRIEFING_MD_PATH.write_text(render_weekly_briefing_markdown(run, stored_items, sentiment_index, clusters), encoding="utf-8")
    WEEKLY_BRIEFING_HTML_PATH.write_text(render_weekly_briefing_page(run, stored_items, sentiment_index, clusters), encoding="utf-8")
    HISTORY_PATH.write_text(render_history_page(run), encoding="utf-8")
    CALENDAR_PATH.write_text(render_calendar_page(stored_items), encoding="utf-8")
    FINE_GAEL_INDEX_PATH.write_text(render_fine_gael_page(run, fg_new, fg_items, fg_status), encoding="utf-8")
    all_items = list(stored_items.values())
    for day in sorted({item_day(item) for item in all_items}):
        (DAY_DIR / f"{day}.html").write_text(render_day_page(day, all_items), encoding="utf-8")


def seed_current_items() -> None:
    """Seed state from the existing June 4 run, useful for first deployment."""
    if ITEMS_PATH.exists():
        return
    seed_time = "2026-06-04T12:03:04Z"
    seeds = [
        (
            "The Irish Times",
            "Thu, 04 Jun 2026 11:32:10 GMT",
            "A dozen questions still to be answered about the Government's new savings plan",
            "https://news.google.com/rss/articles/CBMixgFBVV95cUxNU3R4TGlLUEdDSnZqSWdDa0hqNWxHblhIM2oyd3dmVXVjSEVkcEpuMVpoTnB4eW9lWm85VEx6VHl1Z2NnUkNJbk9wOFhLOEJ5TW52M0NZTkpzbWlRelBHV3ozX2Rid19BeTFqaDRRUmVDb0lKanprczFGNXBFeFctYU5lVzZHY2VZTmJvSEZJbWpaSGY4ZDNpVEszYWpBM3dBX1RfeDhocjlyOWNrYjdLUDIzdUw5MWdCZXBaRXNSQVlOLUxFaVE?oc=5",
        ),
        (
            "Irish Independent",
            "Thu, 04 Jun 2026 11:20:00 GMT",
            "Call for urgent review as Wicklow council hit with EUR1m residential zoned land tax bill",
            "https://news.google.com/rss/articles/CBMi3AFBVV95cUxOak9wT0dUVWpkSHZXdm1YQlNrb2EtT25VcWdIWHQ4S3ZvcTNOM24wTkJ2RXZxblR0bklFdUl4YlRPUUFyWWs4bi00QmlFMzFUU2tDdGJLQ25DR2VOZEdRMF9MbEZfU0sxSjhYMm5wZEtERnI5eHhORld2U3JQd3JXeWpNTk5uMGNzdDhoSnB1UmtCSTNJRG1mbXppRlV3ZU5mN2NFVnRMVnMteS1meFJ2Q04tdzFrZldYMUFZemlGMEd5S1lHeWFSZ3lvTzlxZU5Lem53SlZjRFdWVGNE?oc=5",
        ),
        (
            "The Irish Sun",
            "Thu, 04 Jun 2026 11:17:06 GMT",
            "Public to be enabled to raise concerns to Central Bank under new law",
            "https://news.google.com/rss/articles/CBMijgFBVV95cUxPa2F1dzZMSmxXXzhMUEJlSFB2SmNMM3Z5cU1WZGhoVDYyRUJFWWxMOFpMY1BvMVZhVjR5TDh5N2hJeWdNejB1eE9GMkRTQXZ6NzBXbWtFUF9wV3p2bEJxUUN5WnE2VDdDN3ltREtIdGJOTWdPR014c0U2WE9ieUJyWjdvVXlubGUtMW5sZmVB?oc=5",
        ),
        (
            "Cork Beo",
            "Thu, 04 Jun 2026 11:13:24 GMT",
            "New rules to allow people to raise 'cashless society' concerns with Central Bank",
            "https://news.google.com/rss/articles/CBMiggFBVV95cUxQWG1TQWtEdW5hMmMzdXRNTUFQTnBGbkZLdmFHUzhfclRkOW1BWGNGQ21FNXczUlVjUVhtd0FhS2kxWmhHeXRKTlNkUFhuR0NuQUhYREozVGVJMS1UZFVhOVlmVi1BcUJWeGFra3VzOTlwRlF1VmhocDZMSW1vbjRRNlVB?oc=5",
        ),
        (
            "The Journal",
            "Thu, 04 Jun 2026 11:12:00 GMT",
            "Struggling to find an ATM near you? You'll be able to tell the Central Bank under new rules",
            "https://news.google.com/rss/articles/CBMipgFBVV95cUxPLWVGcl93TW9zLVJEYnBXMVRLc1BxSVdWUS1UaTVNQ3ZHdVFxeERqaFZHbUJVb09GVFM4b1RGQURDZlI5bk1PUEg0TlN0WWM4b2FMOWVsZWVva0xkRjc0a2k0YjJPRnVuYlFfdXIzU2laOWRJUFozbmZkVFY2SURqV0JYR3NLQXRJeUR4VnF2czFPZVo0S3MxYlFQMEZkVFZjX0oxakRB?oc=5",
        ),
        (
            "KCLR 96FM",
            "Thu, 04 Jun 2026 11:08:21 GMT",
            "New guidelines to protect access to cash services in communities in Carlow, Kilkenny and across the country",
            "https://news.google.com/rss/articles/CBMixwFBVV95cUxOV0daWE9sYXRzVkJQU2lRUDVaMnVnVENCa0ZmN3UyQWpka1I5cEhGNnIxeFNkLTNLM2plVVlXZlBoNUhfeXZqOUxqb1NHOFFCQ2JtYzIwQTZoQ2t2SWl1aGdUQVJuQXdCUXFMTzVFRmtEODdXUlZxenY2MWhLQVQ4WlhxZHZJTks3NmtIVHA3bmJlWHJqRHZSbEExd3B6X3lYQmpBVk5xeC11TWJEUHZhdVJTTEFvblJpZHNTSUtxM0laX29rMzFF?oc=5",
        ),
    ]
    items = {}
    seen = load_seen()
    for outlet, published, headline, link in seeds:
        tag, _, reason = classify(headline)
        items[link] = enrich_item(Item(
            outlet=outlet,
            published=published,
            headline=headline,
            link=link,
            google_link=link,
            source_link=link,
            summary=summarize(headline, outlet),
            tag=tag,
            reason=reason,
            cluster_key=cluster_for(headline),
            first_seen=seed_time,
            source_feed="Google News RSS",
        ))
        seen.add(link)
    save_seen(seen)
    save_items(items)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Update the Simon Harris media-monitoring GitHub Pages site.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """
            Examples:
              python3 scripts/monitor.py
              python3 scripts/monitor.py --seed-current --force-new
            """
        ),
    )
    parser.add_argument("--seed-current", action="store_true", help="seed state with the current 2026-06-04 items")
    parser.add_argument("--force-new", action="store_true", help="treat fetched items as new even if already seen")
    args = parser.parse_args()

    if args.seed_current:
        seed_current_items()

    run, new_items, stored_items = build_run(force_new=args.force_new)
    write_outputs(run, new_items, stored_items)
    print(render_text_output(run, new_items))
    return 0


if __name__ == "__main__":
    sys.exit(main())
