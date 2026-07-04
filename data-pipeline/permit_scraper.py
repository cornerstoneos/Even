#!/usr/bin/env python3
"""
permit_scraper.py — plain (no-AI) permit fee schedule scraper.

Fetches each market's permit fee-schedule URL directly (no Anthropic calls,
no cost) and does a best-effort structured extraction of fee line items.
Every market also gets its full extracted text saved for manual review,
since heterogeneous government fee schedules (PDF tables, JS calculators,
plain prose) can't all be parsed reliably — this tool surfaces what it can
find and gets the raw source in front of a human for the rest.

Nothing is written to Google Sheets or Supabase. Output only:
  data-pipeline/permit-research/<market>.json   — one file per market
  data-pipeline/permit-research/_summary.json   — pass/fail overview
"""

import ast, json, pathlib, re, sys, time
import requests
from bs4 import BeautifulSoup

try:
    import pdfplumber
except Exception:
    # Broadest possible catch: pdfplumber pulls in cryptography/cffi, which
    # can fail with native/runtime errors (not just ImportError) on some
    # systems. PDF parsing is best-effort — the rest of the scraper (HTML
    # pages, which are most of them) should still run fine without it.
    pdfplumber = None

HERE = pathlib.Path(__file__).parent
OUT_DIR = HERE / "permit-research"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; EvenPermitResearch/1.0)"}

WORK_TYPES = [
    "New Construction", "Remodel", "Alteration", "Roofing", "Electrical",
    "Plumbing", "Mechanical", "HVAC", "Demolition", "Building Permit",
]
FEE_LINE_RE = re.compile(
    r"([A-Za-z][A-Za-z /&\-]{2,60}?)\s*[:\-–]?\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:per|/)?\s*([A-Za-z0-9$%. ]{0,20})",
)


def load_markets():
    """Extract MARKETS from even_data_sweep.py via AST — avoids importing
    that module, which instantiates an Anthropic client at import time and
    would require ANTHROPIC_API_KEY for a script that needs neither."""
    tree = ast.parse((HERE / "even_data_sweep.py").read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "MARKETS" for t in node.targets):
            return ast.literal_eval(node.value)
    raise RuntimeError("MARKETS not found in even_data_sweep.py")


def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return r


def extract_text(resp):
    ctype = resp.headers.get("Content-Type", "")
    if "pdf" in ctype or resp.url.lower().endswith(".pdf"):
        if not pdfplumber:
            return None, "pdf (pdfplumber not installed)"
        import io
        with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        return text, "pdf"
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text("\n", strip=True), "html"


def guess_fee_lines(text):
    """Best-effort structured guess — only kept if it looks like a real fee
    line (a work-type keyword near a dollar amount on the same line)."""
    guesses = []
    for line in text.split("\n"):
        if not any(w.lower() in line.lower() for w in WORK_TYPES):
            continue
        m = FEE_LINE_RE.search(line)
        if m:
            label, amount, unit = m.groups()
            guesses.append({"label": label.strip(), "amount": amount.strip(), "unit": unit.strip(), "raw_line": line.strip()})
    return guesses


def scrape_city(city, url):
    result = {"city": city, "url": url, "status": None, "guessed_fees": [], "raw_text": None, "error": None}
    try:
        resp = fetch(url)
        text, kind = extract_text(resp)
        if text is None:
            result["status"] = "unsupported"
            result["error"] = kind
            return result
        result["raw_text"] = text[:20000]
        result["guessed_fees"] = guess_fee_lines(text)
        result["status"] = "confident" if len(result["guessed_fees"]) >= 3 else "needs_review"
    except Exception as e:
        result["status"] = "failed"
        result["error"] = str(e)
    return result


def main():
    markets = load_markets()
    limit = sys.argv[1] if len(sys.argv) > 1 else None
    if limit:
        markets = markets[: int(limit)]

    OUT_DIR.mkdir(exist_ok=True)
    summary = []

    for market in markets:
        name = market["market"]
        cities = market.get("permit_cities", [])
        if not cities:
            continue
        print(f"── {name}, {market['state']} ──")
        market_result = {"market": name, "state": market["state"], "zone": market["zone"], "cities": []}
        for c in cities:
            print(f"  Fetching: {c['city']} — {c['url']}")
            r = scrape_city(c["city"], c["url"])
            print(f"    → {r['status']}" + (f" ({len(r['guessed_fees'])} guessed lines)" if r["guessed_fees"] else ""))
            market_result["cities"].append(r)
            time.sleep(0.5)

        (OUT_DIR / f"{name.replace(' ', '_').replace('/', '-')}.json").write_text(
            json.dumps(market_result, indent=2)
        )
        summary.append({
            "market": name,
            "cities": [{"city": c["city"], "status": c["status"], "guessed_lines": len(c["guessed_fees"])} for c in market_result["cities"]],
        })

    (OUT_DIR / "_summary.json").write_text(json.dumps(summary, indent=2))

    confident = sum(1 for m in summary for c in m["cities"] if c["status"] == "confident")
    needs_review = sum(1 for m in summary for c in m["cities"] if c["status"] == "needs_review")
    failed = sum(1 for m in summary for c in m["cities"] if c["status"] in ("failed", "unsupported"))
    total = confident + needs_review + failed

    print("\n" + "=" * 55)
    print(f"Permit scrape complete: {total} city fee-schedules attempted")
    print(f"  ✓ confident (auto-structured): {confident}")
    print(f"  ⚑ needs manual review:         {needs_review}")
    print(f"  ✗ failed/unsupported:          {failed}")
    print(f"Output → {OUT_DIR}/")
    print("=" * 55)


if __name__ == "__main__":
    main()
