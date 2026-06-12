#!/usr/bin/env python3
"""
ceo_dashboard.py — GitHub Actions version
Even/Cornerstone OS — Daily CEO Dashboard

Runs daily at 7am EST via GitHub Actions.
Writes to "EvenOS CEO Dashboard" Google Sheet (or CSV fallback if creds unavailable):
  - Tab "App Stats"           → daily Supabase + Stripe snapshot
  - Tab "Contractor Outreach" → contractor leads (deduplicated by license #)

DBPR covers FL licenses only. NC/GA/TX/AZ use their respective state boards —
stubs in place with notes; add scrapers per-state when ready.

Tiered scraping (evaluated at runtime):
  Tier 1 — every run:    Miami-Dade FL, Broward FL, Palm Beach FL,
                          Mecklenburg NC*, Charleston SC*
  Tier 2 — Mondays only: Hillsborough FL, Orange FL, Duval FL,
                          Fulton GA*, Dallas TX*, Harris TX*, Maricopa AZ*
  Tier 3 — 1st of month: Travis TX*, Pima AZ*, Wake NC*, Richland SC*,
                          Davidson TN*
  * = non-FL; DBPR not applicable — logged with state board note
"""

import os, json, time, datetime, re, csv, pathlib, requests
from google.oauth2 import service_account
from googleapiclient.discovery import build
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────
SCOPES        = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
TAB_APP_STATS = "App Stats"
TAB_OUTREACH  = "Contractor Outreach"

APP_STATS_HEADERS = [
    "Date", "Total Users", "New Signups (24h)", "User Emails",
    "MRR ($)", "Active Subscribers", "New Subscribers (24h)", "Churn (24h)", "Total Revenue ($)",
]
OUTREACH_HEADERS = [
    "Name", "License #", "Trade", "City", "County", "State",
    "Phone", "Email", "Source", "Date Added", "Market Tier", "Status", "Notes",
]

TODAY     = datetime.date.today().strftime("%-m/%-d/%y")
NOW_UTC   = datetime.datetime.utcnow()
SINCE_TS  = int((NOW_UTC - datetime.timedelta(hours=24)).timestamp())
IS_MONDAY = NOW_UTC.weekday() == 0
IS_FIRST  = NOW_UTC.day == 1

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://klgofcqrncabfhskiijn.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
STRIPE_KEY   = os.environ.get("STRIPE_SECRET_KEY", "")

_csv_mode = False
_csv_dir  = pathlib.Path("dashboard-output")

DBPR_URL = "https://www.myfloridalicense.com/wl11.asp"

DBPR_LICENSE_TYPES = [
    "Certified General Contractor",
    "Certified Roofing Contractor",
    "Certified Plumbing Contractor",
    "Certified Mechanical Contractor",
    "Certified Air Conditioning Contractor",
    "Registered Residential Contractor",
    "Registered Roofing Contractor",
]

TIER_1 = [
    {"county": "MIAMI-DADE",  "display": "Miami-Dade",  "state": "FL", "tier": 1},
    {"county": "BROWARD",     "display": "Broward",      "state": "FL", "tier": 1},
    {"county": "PALM BEACH",  "display": "Palm Beach",   "state": "FL", "tier": 1},
    {"county": "MECKLENBURG", "display": "Mecklenburg",  "state": "NC", "tier": 1},
    {"county": "CHARLESTON",  "display": "Charleston",   "state": "SC", "tier": 1},
]
TIER_2 = [
    {"county": "HILLSBOROUGH","display": "Hillsborough", "state": "FL", "tier": 2},
    {"county": "ORANGE",      "display": "Orange",        "state": "FL", "tier": 2},
    {"county": "DUVAL",       "display": "Duval",         "state": "FL", "tier": 2},
    {"county": "FULTON",      "display": "Fulton",        "state": "GA", "tier": 2},
    {"county": "DALLAS",      "display": "Dallas",        "state": "TX", "tier": 2},
    {"county": "HARRIS",      "display": "Harris",        "state": "TX", "tier": 2},
    {"county": "MARICOPA",    "display": "Maricopa",      "state": "AZ", "tier": 2},
]
TIER_3 = [
    {"county": "TRAVIS",      "display": "Travis",        "state": "TX", "tier": 3},
    {"county": "PIMA",        "display": "Pima",          "state": "AZ", "tier": 3},
    {"county": "WAKE",        "display": "Wake",          "state": "NC", "tier": 3},
    {"county": "RICHLAND",    "display": "Richland",      "state": "SC", "tier": 3},
    {"county": "DAVIDSON",    "display": "Davidson",      "state": "TN", "tier": 3},
]

STATE_BOARD_NOTES = {
    "NC": "NC Licensing Board for GCs: nclbgc.org",
    "SC": "SC Contractor's Licensing Board: llr.sc.gov",
    "GA": "GA Professional Licensing: sos.ga.gov",
    "TX": "TX Dept of Licensing & Regulation: tdlr.texas.gov",
    "AZ": "AZ Registrar of Contractors: azroc.gov",
    "TN": "TN Board for Licensing Contractors: tn.gov/commerce",
}


# ── Google Auth ───────────────────────────────────────────────────────────────
def get_services():
    global _csv_mode
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not creds_json:
        print("  ⚑ GOOGLE_CREDENTIALS_JSON not set — CSV fallback mode")
        _csv_mode = True
        _csv_dir.mkdir(exist_ok=True)
        return None, None
    try:
        info  = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        return build("sheets", "v4", credentials=creds), build("drive", "v3", credentials=creds)
    except Exception as e:
        print(f"  ⚑ Google auth error: {e} — CSV fallback mode")
        _csv_mode = True
        _csv_dir.mkdir(exist_ok=True)
        return None, None


def get_or_create_sheet(drive, sheets):
    q     = ("name='EvenOS CEO Dashboard' "
              "and mimeType='application/vnd.google-apps.spreadsheet' "
              "and trashed=false")
    files = drive.files().list(q=q, fields="files(id,name)").execute().get("files", [])
    if files:
        sid = files[0]["id"]
        print(f"✓ Found sheet: {sid}")
        return sid
    body = {
        "properties": {"title": "EvenOS CEO Dashboard"},
        "sheets": [
            {"properties": {"title": TAB_APP_STATS}},
            {"properties": {"title": TAB_OUTREACH}},
        ],
    }
    sid = sheets.spreadsheets().create(body=body).execute()["spreadsheetId"]
    print(f"✓ Created sheet: {sid}")
    _write_headers(sheets, sid, TAB_APP_STATS, APP_STATS_HEADERS)
    _write_headers(sheets, sid, TAB_OUTREACH,  OUTREACH_HEADERS)
    return sid


def ensure_tabs(sheets, sheet_id):
    meta     = sheets.spreadsheets().get(spreadsheetId=sheet_id).execute()
    existing = {s["properties"]["title"] for s in meta["sheets"]}
    adds     = [
        {"addSheet": {"properties": {"title": t}}}
        for t in [TAB_APP_STATS, TAB_OUTREACH] if t not in existing
    ]
    if adds:
        sheets.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body={"requests": adds}).execute()
    for tab, headers in [(TAB_APP_STATS, APP_STATS_HEADERS), (TAB_OUTREACH, OUTREACH_HEADERS)]:
        r = sheets.spreadsheets().values().get(
            spreadsheetId=sheet_id, range=f"'{tab}'!A1:Z1"
        ).execute()
        if not r.get("values"):
            _write_headers(sheets, sheet_id, tab, headers)


def _write_headers(sheets, sheet_id, tab, headers):
    sheets.spreadsheets().values().update(
        spreadsheetId=sheet_id, range=f"'{tab}'!A1",
        valueInputOption="USER_ENTERED", body={"values": [headers]},
    ).execute()


def append_rows(sheets, sheet_id, tab, rows, headers=None):
    if not rows:
        return
    if _csv_mode or sheets is None:
        safe = tab.replace(" ", "_")
        path = _csv_dir / f"{safe}.csv"
        write_header = not path.exists() and headers
        with open(path, "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if write_header:
                w.writerow(headers)
            w.writerows(rows)
        print(f"  ✓ {len(rows)} rows → {path}")
        return
    sheets.spreadsheets().values().append(
        spreadsheetId=sheet_id, range=f"'{tab}'!A1",
        valueInputOption="USER_ENTERED", insertDataOption="INSERT_ROWS",
        body={"values": rows},
    ).execute()
    print(f"  ✓ {len(rows)} rows → {tab}")


def get_existing_license_nums(sheets, sheet_id):
    if _csv_mode or sheets is None:
        path = _csv_dir / "Contractor_Outreach.csv"
        if not path.exists():
            return set()
        with open(path, newline="", encoding="utf-8") as f:
            rows = list(csv.reader(f))
        return {r[1].strip() for r in rows[1:] if len(r) > 1 and r[1].strip()}
    try:
        r = sheets.spreadsheets().values().get(
            spreadsheetId=sheet_id, range=f"'{TAB_OUTREACH}'!B:B"
        ).execute()
        return {row[0].strip() for row in r.get("values", [])[1:] if row and row[0].strip()}
    except Exception:
        return set()


# ── Supabase ──────────────────────────────────────────────────────────────────
def fetch_supabase_stats():
    if not SUPABASE_KEY:
        print("  ⚑ SUPABASE_SERVICE_KEY not set — skipping")
        return {"total": "N/A", "new_24h": "N/A", "emails": ""}
    try:
        headers = {
            "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
            "Range-Unit": "items", "Range": "0-9999",
        }
        resp  = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"select": "id,email,created_at"},
            headers=headers, timeout=15,
        )
        users = resp.json() if resp.ok else []
        if not isinstance(users, list):
            print(f"  ⚑ Supabase error: {users}")
            return {"total": "error", "new_24h": "error", "emails": ""}
        since = (NOW_UTC - datetime.timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%S")
        new   = sum(1 for u in users if u.get("created_at", "") >= since)
        emails = [u["email"] for u in users if u.get("email")]
        print(f"  ✓ Supabase: {len(users)} total, {new} new (24h)")
        return {"total": len(users), "new_24h": new, "emails": "; ".join(emails[:100])}
    except Exception as e:
        print(f"  ⚑ Supabase error: {e}")
        return {"total": "error", "new_24h": "error", "emails": ""}


# ── Stripe ────────────────────────────────────────────────────────────────────
def fetch_stripe_metrics():
    if not STRIPE_KEY:
        print("  ⚑ STRIPE_SECRET_KEY not set — skipping")
        return {"mrr": "N/A", "active_subs": "N/A", "new_subs_24h": "N/A",
                "churn_24h": "N/A", "total_rev": "N/A"}
    base = "https://api.stripe.com/v1"
    auth = (STRIPE_KEY, "")
    try:
        mrr = 0.0; active_count = 0; new_subs = 0; after = None
        while True:
            params = {"status": "active", "limit": 100, "expand[]": "data.items"}
            if after:
                params["starting_after"] = after
            data = requests.get(f"{base}/subscriptions", params=params, auth=auth, timeout=15).json()
            for sub in data.get("data", []):
                active_count += 1
                if sub.get("created", 0) >= SINCE_TS:
                    new_subs += 1
                for item in sub.get("items", {}).get("data", []):
                    price = item.get("price", {})
                    amt   = (price.get("unit_amount") or 0) * (item.get("quantity") or 1)
                    ivl   = price.get("recurring", {}).get("interval", "month")
                    mrr  += (amt / 100) / (12 if ivl == "year" else 1)
            if not data.get("has_more"):
                break
            after = data["data"][-1]["id"]

        churn = len(requests.get(
            f"{base}/subscriptions",
            params={"status": "canceled", "limit": 100, "created[gte]": SINCE_TS},
            auth=auth, timeout=15,
        ).json().get("data", []))

        total_rev = 0.0; after = None
        while True:
            params = {"limit": 100}
            if after:
                params["starting_after"] = after
            data = requests.get(f"{base}/charges", params=params, auth=auth, timeout=15).json()
            for c in data.get("data", []):
                if c.get("status") == "succeeded" and not c.get("refunded"):
                    total_rev += (c.get("amount") or 0) / 100
            if not data.get("has_more"):
                break
            after = data["data"][-1]["id"]

        print(f"  ✓ Stripe: MRR=${mrr:.2f}, {active_count} active subs, {churn} churn (24h)")
        return {"mrr": round(mrr, 2), "active_subs": active_count,
                "new_subs_24h": new_subs, "churn_24h": churn, "total_rev": round(total_rev, 2)}
    except Exception as e:
        print(f"  ⚑ Stripe error: {e}")
        return {"mrr": "error", "active_subs": "error", "new_subs_24h": "error",
                "churn_24h": "error", "total_rev": "error"}


# ── DBPR Scraping (FL only) ───────────────────────────────────────────────────
def _asp_hidden_fields(session):
    resp = session.get(DBPR_URL, timeout=20)
    soup = BeautifulSoup(resp.text, "html.parser")
    return {i["name"]: i.get("value", "") for i in soup.find_all("input", type="hidden") if i.get("name")}


def _parse_dbpr_page(html):
    soup  = BeautifulSoup(html, "html.parser")
    table = None
    for t in soup.find_all("table"):
        row = t.find("tr")
        if row and re.search(r"license|name", row.get_text(), re.I):
            table = t
            break
    if not table:
        return [], False
    rows = []
    for tr in table.find_all("tr")[1:]:
        cells = [td.get_text(strip=True) for td in tr.find_all("td")]
        if len(cells) < 3:
            continue
        rows.append({
            "name":        cells[0] if len(cells) > 0 else "",
            "license_num": cells[1] if len(cells) > 1 else "",
            "city":        cells[4] if len(cells) > 4 else "",
            "county":      cells[5] if len(cells) > 5 else "",
        })
    has_next = bool(soup.find("a", string=re.compile(r"next|>", re.I)))
    return rows, has_next


def scrape_dbpr(county_code, county_display, state, lic_type):
    if state != "FL":
        note = STATE_BOARD_NOTES.get(state, f"{state} state licensing board")
        print(f"  ℹ  {county_display}, {state} — DBPR is FL-only. Use {note}")
        return []

    session = requests.Session()
    session.headers["User-Agent"] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    try:
        hidden = _asp_hidden_fields(session)
    except Exception as e:
        print(f"  ⚑ DBPR load failed [{county_display}]: {e}")
        return []

    leads = []
    for page in range(1, 10000):
        try:
            payload = {
                **hidden,
                "t_APPLICATION_STATUS": "Current,Active",
                "t_COUNTY":             county_code,
                "t_LICENSE_TYPE":       lic_type,
                "t_page":               str(page),
                "searchType":           "byLicenseType",
                "t_last_name": "", "t_first_name": "", "t_lic_number": "",
                "submit": "Search",
            }
            resp = session.post(DBPR_URL, data=payload, headers={"Referer": DBPR_URL}, timeout=20)
            rows, has_next = _parse_dbpr_page(resp.text)
            leads.extend(rows)
            if not rows or not has_next:
                break
            time.sleep(1)
        except Exception as e:
            print(f"  ⚑ DBPR [{county_display}/{lic_type}/p{page}]: {e}")
            break
    return leads


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("EVEN CEO DASHBOARD — Cornerstone OS / Black Lab Holdings")
    print(f"Run: {TODAY}  UTC: {NOW_UTC.strftime('%Y-%m-%d %H:%M')}")
    print(f"Tiers: 1{' + 2 (Monday)' if IS_MONDAY else ''}{' + 3 (1st of month)' if IS_FIRST else ''}")
    print("=" * 60)

    sheets_svc, drive_svc = get_services()
    sheet_id = None
    if not _csv_mode:
        sheet_id = get_or_create_sheet(drive_svc, sheets_svc)
        ensure_tabs(sheets_svc, sheet_id)

    print("\n── Supabase ──")
    sb = fetch_supabase_stats()

    print("\n── Stripe ──")
    st = fetch_stripe_metrics()

    append_rows(sheets_svc, sheet_id, TAB_APP_STATS, [[
        TODAY, sb["total"], sb["new_24h"], sb["emails"],
        st["mrr"], st["active_subs"], st["new_subs_24h"], st["churn_24h"], st["total_rev"],
    ]], headers=APP_STATS_HEADERS)

    print("\n── Contractor Leads ──")
    existing = get_existing_license_nums(sheets_svc, sheet_id)
    print(f"  {len(existing)} license numbers already on file")

    markets   = TIER_1 + (TIER_2 if IS_MONDAY else []) + (TIER_3 if IS_FIRST else [])
    new_leads = []

    for m in markets:
        for lic_type in DBPR_LICENSE_TYPES:
            print(f"  T{m['tier']} → {m['display']}, {m['state']} / {lic_type}")
            raw   = scrape_dbpr(m["county"], m["display"], m["state"], lic_type)
            added = 0
            for r in raw:
                lic = r["license_num"].strip()
                if lic and lic not in existing:
                    new_leads.append([
                        r["name"], lic, lic_type,
                        r["city"], r.get("county", m["display"]), m["state"],
                        "", "",  # phone, email — not in DBPR search results
                        f"DBPR — {m['display']}, {m['state']}", TODAY,
                        f"Tier {m['tier']}", "", "",  # status, notes
                    ])
                    existing.add(lic)
                    added += 1
            if m["state"] == "FL":
                print(f"     {len(raw)} scraped, {added} new")

    if new_leads:
        append_rows(sheets_svc, sheet_id, TAB_OUTREACH, new_leads, headers=OUTREACH_HEADERS)
        print(f"\n  ✓ {len(new_leads)} new leads written")
    else:
        print("\n  No new FL leads this run")

    if _csv_mode:
        print(f"\n  📁 CSV output → ./{_csv_dir}/ (upload as Actions artifact)")

    print(f"\n{'=' * 60}")
    if sheet_id:
        print(f"Sheet ID: {sheet_id}")
    print("Complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
