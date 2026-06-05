#!/usr/bin/env python3
"""
ceo_dashboard.py — GitHub Actions version
Even/Cornerstone OS — Daily CEO Dashboard

Runs daily at 7am EST via GitHub Actions.
Writes to "EvenOS CEO Dashboard" Google Sheet:
  - Tab "App Stats"           → daily Supabase + Stripe snapshot (one row per run)
  - Tab "Contractor Outreach" → DBPR-licensed FL contractor leads (deduplicated by license #)

Charlotte NC: DBPR covers FL only. NC contractor leads require the NC Licensing Board
(nclbgc.org). Add a separate scraper if needed — flagged in output each run.
"""

import os, json, time, datetime, requests
from google.oauth2 import service_account
from googleapiclient.discovery import build
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────
SCOPES = [
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
    "Name", "License #", "Trade", "City", "Phone", "Email",
    "Source", "Date Added", "Status", "Notes",
]

TODAY    = datetime.date.today().strftime("%-m/%-d/%y")
NOW_UTC  = datetime.datetime.utcnow()
SINCE_TS = int((NOW_UTC - datetime.timedelta(hours=24)).timestamp())

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://klgofcqrncabfhskiijn.supabase.co")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
STRIPE_KEY   = os.environ["STRIPE_SECRET_KEY"]

# FL counties to scrape — all are Tier 1 (pull all pages)
FL_COUNTIES = [
    {"county": "MIAMI-DADE", "display": "Miami-Dade, FL"},
    {"county": "BROWARD",    "display": "Broward, FL"},
    {"county": "PALM BEACH", "display": "Palm Beach, FL"},
]

DBPR_LICENSE_TYPES = [
    "Certified General Contractor",
    "Certified Roofing Contractor",
    "Certified Plumbing Contractor",
    "Certified Mechanical Contractor",
    "Certified Air Conditioning Contractor",
    "Registered Residential Contractor",
    "Registered Roofing Contractor",
]

DBPR_URL = "https://www.myfloridalicense.com/wl11.asp"


# ── Google Auth ───────────────────────────────────────────────────────────────
def get_services():
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not creds_json:
        raise EnvironmentError("GOOGLE_CREDENTIALS_JSON secret not set")
    info  = json.loads(creds_json)
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds), build("drive", "v3", credentials=creds)


def get_or_create_sheet(drive, sheets):
    """Find 'EvenOS CEO Dashboard' in Drive or create it. Returns sheet_id."""
    q = ("name='EvenOS CEO Dashboard' "
         "and mimeType='application/vnd.google-apps.spreadsheet' "
         "and trashed=false")
    files = drive.files().list(q=q, fields="files(id,name)").execute().get("files", [])
    if files:
        sid = files[0]["id"]
        print(f"✓ Found existing sheet: {sid}")
        return sid

    body = {
        "properties": {"title": "EvenOS CEO Dashboard"},
        "sheets": [
            {"properties": {"title": TAB_APP_STATS}},
            {"properties": {"title": TAB_OUTREACH}},
        ],
    }
    sid = sheets.spreadsheets().create(body=body).execute()["spreadsheetId"]
    print(f"✓ Created new sheet: {sid}")
    _write_headers(sheets, sid, TAB_APP_STATS, APP_STATS_HEADERS)
    _write_headers(sheets, sid, TAB_OUTREACH,  OUTREACH_HEADERS)
    return sid


def ensure_tabs(sheets, sheet_id):
    """Add any missing tabs and write headers if a tab is empty."""
    meta     = sheets.spreadsheets().get(spreadsheetId=sheet_id).execute()
    existing = {s["properties"]["title"] for s in meta["sheets"]}

    adds = [
        {"addSheet": {"properties": {"title": t}}}
        for t in [TAB_APP_STATS, TAB_OUTREACH]
        if t not in existing
    ]
    if adds:
        sheets.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id, body={"requests": adds}
        ).execute()

    for tab, headers in [(TAB_APP_STATS, APP_STATS_HEADERS), (TAB_OUTREACH, OUTREACH_HEADERS)]:
        r = sheets.spreadsheets().values().get(
            spreadsheetId=sheet_id, range=f"'{tab}'!A1:Z1"
        ).execute()
        if not r.get("values"):
            _write_headers(sheets, sheet_id, tab, headers)


def _write_headers(sheets, sheet_id, tab, headers):
    sheets.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range=f"'{tab}'!A1",
        valueInputOption="USER_ENTERED",
        body={"values": [headers]},
    ).execute()


def append_rows(sheets, sheet_id, tab, rows):
    if not rows:
        return
    sheets.spreadsheets().values().append(
        spreadsheetId=sheet_id,
        range=f"'{tab}'!A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": rows},
    ).execute()
    print(f"  ✓ {len(rows)} rows → {tab}")


# ── Supabase ──────────────────────────────────────────────────────────────────
def fetch_supabase_stats():
    headers = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Range-Unit":    "items",
        "Range":         "0-9999",
    }
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/users",
        params={"select": "id,email,created_at"},
        headers=headers,
        timeout=15,
    )
    users = resp.json() if resp.ok else []
    if not isinstance(users, list):
        print(f"  ⚑ Supabase error: {users}")
        users = []

    since_iso = (NOW_UTC - datetime.timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%S")
    new_24h   = sum(1 for u in users if u.get("created_at", "") >= since_iso)
    emails    = [u["email"] for u in users if u.get("email")]

    print(f"  ✓ Supabase: {len(users)} total, {new_24h} new (24h), {len(emails)} emails")
    return {
        "total":   len(users),
        "new_24h": new_24h,
        "emails":  "; ".join(emails[:100]),
    }


# ── Stripe ────────────────────────────────────────────────────────────────────
def fetch_stripe_metrics():
    base = "https://api.stripe.com/v1"
    auth = (STRIPE_KEY, "")

    # Active subscriptions → MRR + new subs (24h)
    mrr = 0.0
    active_count = 0
    new_subs_24h = 0
    after = None
    while True:
        params = {"status": "active", "limit": 100, "expand[]": "data.items"}
        if after:
            params["starting_after"] = after
        data = requests.get(f"{base}/subscriptions", params=params, auth=auth, timeout=15).json()
        for sub in data.get("data", []):
            active_count += 1
            if sub.get("created", 0) >= SINCE_TS:
                new_subs_24h += 1
            for item in sub.get("items", {}).get("data", []):
                price    = item.get("price", {})
                amount   = price.get("unit_amount", 0) or 0
                qty      = item.get("quantity", 1) or 1
                interval = price.get("recurring", {}).get("interval", "month")
                monthly  = (amount * qty / 100) / (12 if interval == "year" else 1)
                mrr     += monthly
        if not data.get("has_more"):
            break
        after = data["data"][-1]["id"]

    # Canceled in last 24h
    churn_data = requests.get(
        f"{base}/subscriptions",
        params={"status": "canceled", "limit": 100, "created[gte]": SINCE_TS},
        auth=auth, timeout=15,
    ).json()
    churn_24h = len(churn_data.get("data", []))

    # Total lifetime revenue from succeeded charges
    total_rev = 0.0
    after = None
    while True:
        params = {"limit": 100}
        if after:
            params["starting_after"] = after
        data = requests.get(f"{base}/charges", params=params, auth=auth, timeout=15).json()
        for charge in data.get("data", []):
            if charge.get("status") == "succeeded" and not charge.get("refunded"):
                total_rev += (charge.get("amount", 0) or 0) / 100
        if not data.get("has_more"):
            break
        after = data["data"][-1]["id"]

    print(f"  ✓ Stripe: MRR=${mrr:.2f}, {active_count} active, "
          f"{new_subs_24h} new (24h), {churn_24h} churn, ${total_rev:.2f} total rev")
    return {
        "mrr":          round(mrr, 2),
        "active_subs":  active_count,
        "new_subs_24h": new_subs_24h,
        "churn_24h":    churn_24h,
        "total_rev":    round(total_rev, 2),
    }


# ── DBPR Scraping ─────────────────────────────────────────────────────────────
def _get_asp_hidden_fields(session):
    """Load the DBPR search page and extract ASP.NET hidden form fields."""
    resp = session.get(DBPR_URL, timeout=20)
    soup = BeautifulSoup(resp.text, "html.parser")
    return {
        inp["name"]: inp.get("value", "")
        for inp in soup.find_all("input", type="hidden")
        if inp.get("name")
    }


def _parse_dbpr_results(html):
    """
    Parse one DBPR results page.
    Returns (list_of_dicts, has_next_page).
    """
    soup    = BeautifulSoup(html, "html.parser")
    results = []

    # Locate the results table — try multiple selectors
    table = (
        soup.find("table", {"id": "searchResults"})
        or soup.find("table", class_=lambda c: c and "search" in c.lower())
    )
    if not table:
        for t in soup.find_all("table"):
            first_row = t.find("tr")
            if first_row and re.search(r"license|name", first_row.get_text(), re.I):
                table = t
                break

    if not table:
        return results, False

    rows = table.find_all("tr")[1:]  # skip header
    for row in rows:
        cells = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cells) < 3:
            continue
        # DBPR columns (typical): Name, License #, License Type, Address, City, County, Status, Exp
        results.append({
            "name":        cells[0] if len(cells) > 0 else "",
            "license_num": cells[1] if len(cells) > 1 else "",
            "city":        cells[4] if len(cells) > 4 else cells[3] if len(cells) > 3 else "",
            "phone":       "",  # not exposed in DBPR search results
            "email":       "",  # not exposed in DBPR search results
        })

    has_next = bool(
        soup.find("a", string=re.compile(r"next|>", re.I))
        or soup.find("input", {"value": re.compile(r"next", re.I)})
    )
    return results, has_next


def scrape_dbpr(county_code, county_display, lic_type, max_pages=9999):
    """Scrape DBPR for one county + license type combo. Returns list of contractor dicts."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/124.0.0.0 Safari/537.36"),
    })

    try:
        hidden = _get_asp_hidden_fields(session)
    except Exception as e:
        print(f"  ⚑ DBPR page load failed [{county_display}]: {e}")
        return []

    all_leads = []
    for page in range(1, max_pages + 1):
        try:
            payload = {
                **hidden,
                "t_APPLICATION_STATUS": "Current,Active",
                "t_COUNTY":             county_code,
                "t_LICENSE_TYPE":       lic_type,
                "t_page":               str(page),
                "searchType":           "byLicenseType",
                "t_last_name":          "",
                "t_first_name":         "",
                "t_lic_number":         "",
                "submit":               "Search",
            }
            resp    = session.post(DBPR_URL, data=payload, headers={"Referer": DBPR_URL}, timeout=20)
            rows, has_next = _parse_dbpr_results(resp.text)
            all_leads.extend(rows)

            if not rows or not has_next:
                break
            time.sleep(1)

        except Exception as e:
            print(f"  ⚑ DBPR error [{county_display} / {lic_type} / p{page}]: {e}")
            break

    return all_leads


def get_existing_license_nums(sheets, sheet_id):
    """Read column B of Contractor Outreach for deduplication."""
    try:
        r = sheets.spreadsheets().values().get(
            spreadsheetId=sheet_id, range=f"'{TAB_OUTREACH}'!B:B"
        ).execute()
        return {row[0].strip() for row in r.get("values", [])[1:] if row and row[0].strip()}
    except Exception:
        return set()


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("EVEN CEO DASHBOARD — Cornerstone OS / Black Lab Holdings")
    print(f"Run date: {TODAY}  |  UTC: {NOW_UTC.strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)

    sheets_svc, drive_svc = get_services()
    print("✓ Google authenticated\n")

    sheet_id = get_or_create_sheet(drive_svc, sheets_svc)
    ensure_tabs(sheets_svc, sheet_id)

    # ── App Stats ──────────────────────────────────────────────────────────────
    print("\n── Supabase ──")
    sb = fetch_supabase_stats()

    print("\n── Stripe ──")
    st = fetch_stripe_metrics()

    append_rows(sheets_svc, sheet_id, TAB_APP_STATS, [[
        TODAY,
        sb["total"],
        sb["new_24h"],
        sb["emails"],
        st["mrr"],
        st["active_subs"],
        st["new_subs_24h"],
        st["churn_24h"],
        st["total_rev"],
    ]])

    # ── DBPR Contractor Leads ──────────────────────────────────────────────────
    print("\n── DBPR Contractor Leads ──")
    existing = get_existing_license_nums(sheets_svc, sheet_id)
    print(f"  {len(existing)} license numbers already on file (dedup)")

    new_leads = []
    for county in FL_COUNTIES:
        for lic_type in DBPR_LICENSE_TYPES:
            print(f"  → {county['display']} / {lic_type}")
            leads = scrape_dbpr(county["county"], county["display"], lic_type)
            added = 0
            for lead in leads:
                lic = lead["license_num"].strip()
                if lic and lic not in existing:
                    new_leads.append({**lead, "trade": lic_type, "source": f"DBPR — {county['display']}", "date_added": TODAY})
                    existing.add(lic)
                    added += 1
            print(f"     {len(leads)} scraped, {added} new")

    print(f"\n  ℹ  Charlotte NC: DBPR is FL-only. "
          f"NC leads require nclbgc.org (General Contractors) + "
          f"individual NC trade boards. Add separately if needed.")

    if new_leads:
        append_rows(sheets_svc, sheet_id, TAB_OUTREACH, [
            [
                l["name"], l["license_num"], l["trade"], l["city"],
                l["phone"], l["email"], l["source"], l["date_added"],
                "", "",  # Status + Notes left blank for manual outreach tracking
            ]
            for l in new_leads
        ])
        print(f"\n  ✓ {len(new_leads)} new leads written to Contractor Outreach")
    else:
        print("\n  No new leads — all contractors already on file")

    print(f"\n{'=' * 60}")
    print(f"Complete. Sheet ID: {sheet_id}")
    print("=" * 60)


if __name__ == "__main__":
    main()
