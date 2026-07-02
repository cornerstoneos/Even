#!/usr/bin/env python3
"""
even_data_sweep.py — GitHub Actions version
Even/Cornerstone OS — Full Market Data Population Script

Runs in GitHub Actions (no browser, no local files, no key).
Auth via Workload Identity Federation (google-github-actions/auth step
in the workflow) — this script just reads Application Default Credentials.
Anthropic API via ANTHROPIC_API_KEY secret.

Writes to Even Data Sheet:
  - Tab "Material Costs"  → materials per market
  - Tab "Labor Rates"     → BLS labor per market
  - Tab "Sheet3"          → permit fees per market
  - Tab "Review Flags"    → anything needing manual cleanup
"""

import os, json, time, datetime, re, requests
import google.auth
from googleapiclient.discovery import build
import anthropic

# ── Config ────────────────────────────────────────────────────────────────────
SCOPES   = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = "1BXFEoSDMY-E_IBkv_Pv8dulP0lx7L8MQk1Z8MS8XNWY"

TAB_MATERIALS = "Material Costs"
TAB_LABOR     = "Labor Rates"
TAB_PERMITS   = "Sheet3"
TAB_FLAGS     = "Review Flags"

TODAY = datetime.date.today().strftime("%-m/%-d/%y")
AI    = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
FLAGS = []

# ── Google Auth — Workload Identity Federation via Application Default Creds ──
_sheets_service = None

def get_sheets_service():
    global _sheets_service
    try:
        creds, _ = google.auth.default(scopes=SCOPES)
    except Exception as e:
        raise RuntimeError(
            "Failed to load Application Default Credentials. In CI this means "
            "the google-github-actions/auth step (Workload Identity Federation) "
            "didn't run before this script, or the workflow lacks 'id-token: "
            "write' permission — there is no other auth path."
        ) from e
    _sheets_service = build("sheets", "v4", credentials=creds)
    return _sheets_service

def append_rows(service, tab, rows):
    if not rows:
        return
    service.spreadsheets().values().append(
        spreadsheetId=SHEET_ID,
        range=f"'{tab}'!A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": rows},
    ).execute()
    print(f"  ✓ {len(rows)} rows → {tab}")

def flag(market, dtype, item, reason):
    FLAGS.append({"market": market, "type": dtype, "item": item, "reason": reason})
    print(f"  ⚑ FLAG [{market}] {dtype} — {item}: {reason}")

# ── Market Registry ───────────────────────────────────────────────────────────
MARKETS = [

    # ── FLORIDA ───────────────────────────────────────────────────────────────
    {
        "market": "Miami-Dade", "zone": "Miami Proper", "state": "FL",
        "bls_area_code": "33100", "bls_area_name": "Miami-Fort Lauderdale-West Palm Beach, FL",
        "home_depot_zip": "33101",
        "skip_labor": True, "skip_materials": True,  # already in sheet
        "permit_cities": [
            {"city": "City of Miami",     "url": "https://www.miamidade.gov/permits/fees.asp"},
            {"city": "Miami-Dade County", "url": "https://www.miamidade.gov/permits/fees.asp"},
        ],
        "market_notes": [
            "HURRICANE/WIND: High-Velocity Hurricane Zone (HVHZ). All roofing requires HVHZ-approved products — standard shingles from other markets are NOT code-compliant.",
            "IMPACT WINDOWS: All openings require impact-rated glazing or approved storm shutters. Add $80–$150/sqft premium over standard window cost.",
            "FLOOD/ELEVATION: FEMA flood zones cover large portions of Miami-Dade. Elevation certificates and stem wall/pier foundation upgrades may be required.",
            "HUMIDITY/MOLD: Mold-resistant drywall (Dens-Armor or equivalent) is best practice, often required.",
            "CONCRETE BLOCK: CBS (Concrete Block Structure) is dominant — framing costs differ significantly from wood frame.",
            "ROOFING SUBSTRATE: Peel-and-stick underlayment required in HVHZ, not felt. Adds $0.25–$0.40/sqft.",
            "PERMITS: Miami-Dade and City of Miami are separate jurisdictions — always confirm which has authority.",
            "INSURANCE SURCHARGE: Contractor insurance premiums 30–50% above national average.",
        ],
    },
    {
        "market": "Broward", "zone": "Fort Lauderdale", "state": "FL",
        "bls_area_code": "33100", "bls_area_name": "Miami-Fort Lauderdale-West Palm Beach, FL",
        "home_depot_zip": "33301",
        "permit_cities": [
            {"city": "City of Fort Lauderdale", "url": "https://www.fortlauderdale.gov/departments/building-services/permit-fee-schedule"},
            {"city": "Broward County",           "url": "https://www.broward.org/Building/Pages/PermitFees.aspx"},
        ],
        "market_notes": [
            "HURRICANE/WIND: Same HVHZ zone as Miami-Dade. Impact-rated products required throughout.",
            "IMPACT WINDOWS: Same requirement as Miami-Dade — no standard windows.",
            "FLOOD: Significant AE and VE flood zones. Check FEMA FIRM maps before estimating foundation work.",
            "SALTWATER CORROSION: Within 3,000 ft of ocean, specify corrosion-resistant fasteners, coated rebar, marine-grade hardware.",
        ],
    },
    {
        "market": "Palm Beach", "zone": "Palm Beach County", "state": "FL",
        "bls_area_code": "33100", "bls_area_name": "Miami-Fort Lauderdale-West Palm Beach, FL",
        "home_depot_zip": "33401",
        "permit_cities": [
            {"city": "Palm Beach County",        "url": "https://discover.pbcgov.org/pzb/building/Pages/Fee-Schedules.aspx"},
            {"city": "City of West Palm Beach",  "url": "https://www.wpb.org/government/development-services/building"},
        ],
        "market_notes": [
            "HURRICANE/WIND: HVHZ applies coastal; inland transitions to standard FL wind zone. Verify by address.",
            "IMPACT WINDOWS: Required in HVHZ zones; strongly recommended everywhere in Palm Beach County.",
            "LUXURY SEGMENT: Premium material pricing is market-standard in many Palm Beach neighborhoods.",
            "SOIL: Sandy coastal to muck/organic inland (Glades). Organic soils need compaction, pilings, or deep footings.",
        ],
    },
    {
        "market": "Tampa", "zone": "Tampa Bay", "state": "FL",
        "bls_area_code": "45300", "bls_area_name": "Tampa-St. Petersburg-Clearwater, FL",
        "home_depot_zip": "33602",
        "permit_cities": [
            {"city": "City of Tampa",       "url": "https://www.tampagov.net/construction-services/fee-schedule"},
            {"city": "Hillsborough County", "url": "https://www.hillsboroughcounty.org/en/residents/property-owners-and-renters/building-and-construction"},
        ],
        "market_notes": [
            "HURRICANE/WIND: Not HVHZ but still high wind zone. FL Building Code wind requirements apply.",
            "FLOOD: Tampa Bay is highly flood-prone. Post-Ian/Helene compliance requirements have tightened.",
            "SINKHOLES: Hillsborough County is active sinkhole territory. Foundation inspections often required.",
            "HUMIDITY: Same mold/moisture considerations as South FL.",
            "GROWTH MARKET: One of the fastest-growing metros in the US.",
        ],
    },
    {
        "market": "Orlando", "zone": "Central Florida", "state": "FL",
        "bls_area_code": "36740", "bls_area_name": "Orlando-Kissimmee-Sanford, FL",
        "home_depot_zip": "32801",
        "permit_cities": [
            {"city": "City of Orlando", "url": "https://www.orlando.gov/Building-Development/Permit-Fees"},
            {"city": "Orange County",   "url": "https://www.orangecountyfl.net/PermitsLicenses/BuildingPermitFees.aspx"},
        ],
        "market_notes": [
            "HURRICANE/WIND: Inland — not HVHZ. Standard FL Building Code.",
            "SINKHOLES: Orange and Osceola counties have sinkhole activity.",
            "SHORT-TERM RENTAL: High STR demand — faster renovation cycles, higher finish standards.",
            "CLAY SOIL: Parts of Central FL have expansive clay — monitor foundation cracking and drainage.",
        ],
    },
    {
        "market": "Jacksonville", "zone": "Northeast Florida", "state": "FL",
        "bls_area_code": "27260", "bls_area_name": "Jacksonville, FL",
        "home_depot_zip": "32202",
        "permit_cities": [
            {"city": "City of Jacksonville / Duval County", "url": "https://www.coj.net/departments/planning-and-development/building-inspection-division/permit-fee-schedule.aspx"},
        ],
        "market_notes": [
            "HURRICANE/WIND: Coastal wind zone — not HVHZ but wind-rated products required near coast.",
            "FLOOD: St. Johns River and coastal proximity create significant flood zones.",
            "MILITARY: Large military population drives steady rental and remodel demand.",
            "OLDER STOCK: Large inventory of 1950s–1980s CBS and wood-frame homes — strong fix-and-flip pipeline.",
        ],
    },

    # ── NORTH CAROLINA ────────────────────────────────────────────────────────
    {
        "market": "Charlotte", "zone": "Mecklenburg County", "state": "NC",
        "bls_area_code": "16740", "bls_area_name": "Charlotte-Concord-Gastonia, NC-SC",
        "home_depot_zip": "28201",
        "permit_cities": [
            {"city": "Mecklenburg County", "url": "https://www.mecknc.gov/LUESA/BuildingStandardsDivision/Pages/FeeSchedule.aspx"},
            {"city": "City of Charlotte",  "url": "https://charlottenc.gov/growth-development/permits-inspections/permitting-fee-schedule"},
        ],
        "market_notes": [
            "RED CLAY SOIL: Piedmont red clay is expansive and poorly draining. Budget for French drains, grading, and foundation repair on flips.",
            "CRAWL SPACE: Dominant construction type. Encapsulation is a high-value flip upgrade (~$5,000–$12,000).",
            "HVAC: Heat pump dominant in new construction. Budget full replacement on most flips.",
            "TERMITES: Subterranean termites active throughout the Piedmont.",
            "BETA ADVISORS: Angel (remodeling/decks) and Eduardo (siding/roofing) — real cost data available here.",
        ],
    },
    {
        "market": "Greensboro", "zone": "Guilford County", "state": "NC",
        "bls_area_code": "24660", "bls_area_name": "Greensboro-High Point, NC",
        "home_depot_zip": "27401",
        "permit_cities": [
            {"city": "City of Greensboro", "url": "https://www.greensboro-nc.gov/departments/planning-community-development/building-inspections/permit-fee-schedule"},
        ],
        "market_notes": [
            "RED CLAY SOIL: Same Piedmont clay as Charlotte.",
            "CRAWL SPACE: Dominant construction type.",
            "OLDER STOCK: Significant pre-1980 inventory — active fix-and-flip at lower price points.",
            "LEAD/ASBESTOS: Pre-1978 homes common — testing required.",
        ],
    },
    {
        "market": "Raleigh", "zone": "Wake County", "state": "NC",
        "bls_area_code": "39580", "bls_area_name": "Raleigh-Cary, NC",
        "home_depot_zip": "27601",
        "permit_cities": [
            {"city": "Wake County",     "url": "https://www.wake.gov/departments-agencies/inspections/fee-schedule"},
            {"city": "City of Raleigh", "url": "https://raleighnc.gov/permits/permit-fees"},
        ],
        "market_notes": [
            "TECH CORRIDOR: Research Triangle Park drives high-income buyer demand. Premium finishes expected.",
            "RED CLAY SOIL: Same Piedmont clay issues.",
            "RAPID GROWTH: One of the top-growth counties in the US. Longer permit review times.",
        ],
    },

    # ── SOUTH CAROLINA ────────────────────────────────────────────────────────
    {
        "market": "Charleston", "zone": "Charleston County", "state": "SC",
        "bls_area_code": "16700", "bls_area_name": "Charleston-North Charleston, SC",
        "home_depot_zip": "29401",
        "permit_cities": [
            {"city": "City of Charleston",    "url": "https://www.charleston-sc.gov/271/Building-Permits"},
            {"city": "Charleston County",     "url": "https://www.charlestoncounty.org/departments/building-codes/fee-schedule.php"},
            {"city": "North Charleston",      "url": "https://www.northcharleston.org/residents/building-permit-fees/"},
        ],
        "market_notes": [
            "FLOOD: One of the most flood-prone cities in the US. Tidal flooding increasing. Many properties need elevated mechanicals and flood vents.",
            "HURRICANE/WIND: Coastal wind zone — wind-rated products required near coast.",
            "HISTORIC DISTRICT: Downtown has strict preservation overlay — HPC approval adds time and cost.",
            "SALTWATER CORROSION: Marine-grade hardware and corrosion-resistant fasteners near coast.",
            "TERMITES: Subterranean and Formosan termites highly active.",
            "BETA ADVISOR: Uncle (master plumber) — real plumbing cost data available in Charleston.",
        ],
    },
    {
        "market": "Columbia", "zone": "Richland County", "state": "SC",
        "bls_area_code": "17900", "bls_area_name": "Columbia, SC",
        "home_depot_zip": "29201",
        "permit_cities": [
            {"city": "City of Columbia (SC)", "url": "https://www.columbiasc.gov/departments/planning-development/building-permits"},
            {"city": "Richland County",       "url": "https://www.richlandcountysc.gov/Departments/Building-Services"},
        ],
        "market_notes": [
            "RED CLAY/EXPANSIVE SOIL: Heavy clay — foundation movement and drainage issues common.",
            "TERMITES: Extremely active — Formosan termites present.",
            "MILITARY: Fort Jackson drives stable rental demand.",
            "AFFORDABLE MARKET: Active investor community targeting $80–$150K flips.",
        ],
    },

    # ── GEORGIA ───────────────────────────────────────────────────────────────
    {
        "market": "Atlanta", "zone": "Fulton County", "state": "GA",
        "bls_area_code": "12060", "bls_area_name": "Atlanta-Sandy Springs-Roswell, GA",
        "home_depot_zip": "30301",
        "permit_cities": [
            {"city": "City of Atlanta", "url": "https://www.atlantaga.gov/government/departments/city-planning/office-of-buildings/permit-fees"},
            {"city": "Fulton County",   "url": "https://www.fultoncountyga.gov/services/building-permits"},
        ],
        "market_notes": [
            "RED CLAY SOIL (GEORGIA CLAY): Dense, poorly draining, highly expansive. #1 construction complication in Atlanta flips. Budget for French drains, grading, downspout extensions, crawl space moisture barriers.",
            "CRAWL SPACE: Dominant construction type. Encapsulation is high-ROI flip upgrade.",
            "TREE CANOPY: Root intrusion into sewer lines and foundations common. Budget for root inspection and line clearing.",
            "TERMITES: Georgia is one of the highest-risk termite states. Pre-treat all new construction.",
            "HVAC: Georgia summers are brutal. Budget HVAC replacement on most flips.",
            "GRANITE/QUARTZ COUNTERTOPS: Atlanta buyers expect this at mid-range and above. Laminate hurts resale.",
        ],
    },
    {
        "market": "Savannah", "zone": "Chatham County", "state": "GA",
        "bls_area_code": "42340", "bls_area_name": "Savannah, GA",
        "home_depot_zip": "31401",
        "permit_cities": [
            {"city": "City of Savannah", "url": "https://www.savannahga.gov/1121/Permits-Licensing"},
            {"city": "Chatham County",   "url": "https://www.chathamcounty.org/468/Building-Safety-Regulatory-Services"},
        ],
        "market_notes": [
            "HISTORIC DISTRICT: Strict preservation rules — material/design approvals add lead time.",
            "FLOOD: Coastal and tidal flooding significant. Many properties in AE flood zones.",
            "HURRICANE/WIND: Coastal wind zone.",
            "RED CLAY + COASTAL SAND: Soil varies — know your parcel before estimating foundation work.",
            "TERMITES: Same high-activity zone as Atlanta.",
        ],
    },

    # ── TEXAS ─────────────────────────────────────────────────────────────────
    {
        "market": "Dallas", "zone": "Dallas County", "state": "TX",
        "bls_area_code": "19100", "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "75201",
        "permit_cities": [
            {"city": "City of Dallas", "url": "https://dallascityhall.com/departments/sustainabledevelopment/buildinginspection/pages/fee-schedule.aspx"},
        ],
        "market_notes": [
            "EXPANSIVE CLAY (BLACK COTTON SOIL): #1 construction issue in DFW. Foundations move with moisture changes. Foundation repair is near-universal on Dallas flips.",
            "FOUNDATION WATERING: Soaker hoses around foundations maintain moisture consistency. Advise contractor clients.",
            "HAIL CORRIDOR: Class 4 impact-resistant shingles worth specifying — roof replacement from hail is extremely common.",
            "PIER AND BEAM: Many older Dallas homes. Leveling costs should be assessed on every flip.",
        ],
    },
    {
        "market": "Fort Worth", "zone": "Tarrant County", "state": "TX",
        "bls_area_code": "19100", "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "76102",
        "permit_cities": [
            {"city": "City of Fort Worth", "url": "https://www.fortworthtexas.gov/departments/development-services/permitting/fee-schedule"},
        ],
        "market_notes": [
            "EXPANSIVE CLAY: Same black cotton soil as Dallas.",
            "HAIL CORRIDOR: Tarrant County receives significant hail.",
            "GAS/OIL INFRASTRUCTURE: Barnett Shale underlies much of Tarrant County — easements and mineral rights considerations.",
        ],
    },
    {
        "market": "Prosper", "zone": "Collin County", "state": "TX",
        "bls_area_code": "19100", "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "75078",
        "permit_cities": [
            {"city": "Town of Prosper", "url": "https://www.prospertx.gov/departments/development-services/"},
        ],
        "market_notes": [
            "RAPIDLY GROWING SUBURB: One of the fastest-growing towns in the US.",
            "EXPANSIVE CLAY: Same North Texas clay.",
            "HIGH-END MARKET: Buyers expect premium finishes.",
        ],
    },
    {
        "market": "Frisco", "zone": "Collin/Denton County", "state": "TX",
        "bls_area_code": "19100", "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "75034",
        "permit_cities": [
            {"city": "City of Frisco", "url": "https://www.friscotexas.gov/1262/Building-Inspection"},
        ],
        "market_notes": [
            "PREMIUM SUBURB: Top-tier DFW — high income, top schools, tech employers.",
            "EXPANSIVE CLAY: North Texas clay — foundation maintenance ongoing.",
            "HAIL: Collin County is in the hail corridor.",
        ],
    },
    {
        "market": "McKinney", "zone": "Collin County", "state": "TX",
        "bls_area_code": "19100", "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "75069",
        "permit_cities": [
            {"city": "City of McKinney", "url": "https://www.mckinneytexas.org/1218/Permits-Inspections"},
        ],
        "market_notes": [
            "HISTORIC DOWNTOWN + GROWTH SUBURBS: Different product expectations by submarket.",
            "EXPANSIVE CLAY: Same North Texas clay.",
        ],
    },
    {
        "market": "Houston", "zone": "Harris County", "state": "TX",
        "bls_area_code": "26420", "bls_area_name": "Houston-The Woodlands-Sugar Land, TX",
        "home_depot_zip": "77001",
        "permit_cities": [
            {"city": "City of Houston", "url": "https://www.houstontx.gov/permits/feeinfo.html"},
        ],
        "market_notes": [
            "FLOOD (CRITICAL): Most flood-prone major city in the US. Always verify FEMA flood zone and flood history before estimating. Repeated flood claims = sold cheap for a reason.",
            "EXPANSIVE CLAY: Houston clay is significant — foundation movement common after wet/dry cycles.",
            "HURRICANE: Gulf Coast exposure — wind and storm surge risk near coast.",
            "HUMIDITY/MOLD: Rivals South Florida. Mold-resistant materials and vapor management essential.",
            "NO ZONING: Houston has no city zoning code — unique renovation and conversion opportunities.",
        ],
    },
    {
        "market": "Austin", "zone": "Travis County", "state": "TX",
        "bls_area_code": "12420", "bls_area_name": "Austin-Round Rock-Georgetown, TX",
        "home_depot_zip": "78701",
        "permit_cities": [
            {"city": "City of Austin", "url": "https://www.austintexas.gov/department/development-services/permit-fee-schedules"},
        ],
        "market_notes": [
            "WATCH MARKET: Austin had negative flip ROI in recent quarters. Viable with right buy price but requires discipline.",
            "LIMESTONE/ROCK: Austin sits on limestone karst. Rock during excavation can significantly increase trenching costs — always budget a rock contingency.",
            "TECH WORKER BUYER: High-spec finishes expected. Builder-grade materials underperform.",
            "PERMIT DELAYS: Austin permit office has historically long review times.",
        ],
    },

    # ── ARIZONA ───────────────────────────────────────────────────────────────
    {
        "market": "Phoenix", "zone": "Maricopa County", "state": "AZ",
        "bls_area_code": "38060", "bls_area_name": "Phoenix-Mesa-Chandler, AZ",
        "home_depot_zip": "85001",
        "permit_cities": [
            {"city": "City of Phoenix",    "url": "https://www.phoenix.gov/pdd/permits/fees"},
            {"city": "City of Mesa",       "url": "https://www.mesaaz.gov/business/development-services/permit-fees"},
            {"city": "City of Scottsdale", "url": "https://www.scottsdaleaz.gov/building/permit-fees"},
            {"city": "City of Chandler",   "url": "https://www.chandleraz.gov/residents/building-and-development/permits/permit-fees"},
            {"city": "City of Tempe",      "url": "https://www.tempe.gov/government/community-development/permits-fees"},
        ],
        "market_notes": [
            "DESERT CLIMATE: 115°F+ summers. HVAC sizing, attic ventilation, and cool-roof products are critical to resale value.",
            "COOL ROOF: Specify light-colored or reflective roofing — dark shingles absorb heat and hurt energy performance.",
            "STUCCO DOMINANT: Wood-frame stucco exterior is standard. Cracking, improper flashing, and moisture intrusion are common flip issues.",
            "FLAT ROOF: Many homes have flat or low-slope sections — TPO, modified bitumen, or foam roofing, not shingles.",
            "CALICHE SOIL: Hard caliche layer throughout the Valley. Trenching and excavation can be much more expensive than expected.",
            "SOLAR: Buyers increasingly expect solar-ready homes. Factor solar conduit rough-in into renovation plans.",
            "YEAR-ROUND CONSTRUCTION: No winter shutdown.",
        ],
    },
    {
        "market": "Tucson", "zone": "Pima County", "state": "AZ",
        "bls_area_code": "46060", "bls_area_name": "Tucson, AZ",
        "home_depot_zip": "85701",
        "permit_cities": [
            {"city": "City of Tucson", "url": "https://www.tucsonaz.gov/departments/planning-development-services/permits/permit-fees"},
            {"city": "Pima County",    "url": "https://webcms.pima.gov/government/development_services_department/permits/"},
        ],
        "market_notes": [
            "AFFORDABLE ENTRY: Lowest acquisition costs in AZ — widest potential gross spread.",
            "DESERT CLIMATE: Same heat management, cool-roof, and stucco considerations as Phoenix.",
            "CALICHE SOIL: Same hard caliche layer — excavation contingency required.",
            "UNIVERSITY OF ARIZONA + DAVIS-MONTHAN AFB: Stable institutional demand base.",
        ],
    },

    # ── TENNESSEE ─────────────────────────────────────────────────────────────
    {
        "market": "Nashville", "zone": "Davidson County", "state": "TN",
        "bls_area_code": "34980", "bls_area_name": "Nashville-Davidson-Murfreesboro-Franklin, TN",
        "home_depot_zip": "37201",
        "permit_cities": [
            {"city": "Metro Nashville / Davidson County", "url": "https://www.nashville.gov/departments/codes/fee-schedule"},
        ],
        "market_notes": [
            "EXPLOSIVE GROWTH: One of the top-growth metros in the US. Active fix-and-flip with rising ARVs.",
            "LIMESTONE/KARST: Similar to Austin — rock encounters possible during excavation.",
            "CLAY SOIL: Middle Tennessee clay — crawl space moisture and drainage are ongoing issues.",
            "SHORT-TERM RENTAL: High Airbnb demand — investors need different finish spec than typical flip.",
        ],
    },
    {
        "market": "Memphis", "zone": "Shelby County", "state": "TN",
        "bls_area_code": "32820", "bls_area_name": "Memphis, TN-MS-AR",
        "home_depot_zip": "38103",
        "permit_cities": [
            {"city": "City of Memphis / Shelby County", "url": "https://www.shelbycountytn.gov/1032/Building-Codes"},
        ],
        "market_notes": [
            "HIGH FLIP ACTIVITY: Consistently ranks among the most active fix-and-flip markets nationally.",
            "AFFORDABLE ACQUISITION: Active at the $50–$120K buy range.",
            "OLDER HOUSING STOCK: 1940s–1970s homes — lead paint and asbestos testing required on pre-1978 properties.",
            "SEISMIC ZONE: New Madrid Seismic Zone — unique foundation and structural considerations.",
        ],
    },
]

# ── BLS Occupations ───────────────────────────────────────────────────────────
BLS_OCCUPATIONS = [
    ("47-2061", "Construction Laborers"),
    ("47-2031", "Carpenters"),
    ("47-2081", "Drywall Installers"),
    ("47-2111", "Electricians"),
    ("47-2141", "Painters"),
    ("47-2152", "Plumbers/Pipefitters"),
    ("47-2181", "Roofers"),
    ("47-2044", "Tile and Stone Setters"),
    ("47-2051", "Cement Masons/Concrete Finishers"),
    ("47-2161", "Plasterers/Stucco Masons"),
    ("47-2211", "Sheet Metal Workers"),
    ("47-1011", "First-Line Supervisors"),
]

# ── Material Items ────────────────────────────────────────────────────────────
MATERIAL_ITEMS = [
    ("Architectural Shingles",                  "roofing",    "per bundle (33.33 sf)"),
    ("Roof Underlayment",                        "roofing",    "per roll"),
    ("Ridge Cap Shingles",                       "roofing",    "per bundle"),
    ("Drywall 1/2 inch 4x8",                     "interior",   "per sheet"),
    ("2x4x8 Stud",                               "framing",    "per piece"),
    ("3/4 inch Plywood",                         "framing",    "per sheet"),
    ("Cement Board (Durock/HardieBacker)",        "interior",   "per sheet"),
    ("Luxury Vinyl Plank Flooring",              "flooring",   "per sqft"),
    ("Ceramic Floor Tile",                       "flooring",   "per sqft"),
    ("24x24 Porcelain Tile",                     "flooring",   "per sqft"),
    ("Behr Premium Interior Paint",              "finishes",   "per gallon"),
    ("4 inch PVC Pipe",                          "plumbing",   "per 10 ft"),
    ("3/4 inch Copper Pipe",                     "plumbing",   "per 10 ft"),
    ("60 lb Concrete Mix",                       "concrete",   "per bag"),
    ("Impact Window (standard slider)",          "windows",    "per sqft — FL coastal markets only"),
    ("Peel-and-Stick Underlayment",              "roofing",    "per roll — FL HVHZ markets only"),
    ("TPO Roofing Membrane",                     "roofing",    "per sqft — AZ/TX flat roof markets"),
    ("Crawl Space Encapsulation Vapor Barrier",  "foundation", "per sqft — SE/NC/SC/GA/TN markets"),
]

# ── TX Permit Data (from your screenshotting session, April 2026) ─────────────
TX_PERMIT_DATA = [
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"New Residential Construction","min_fee":50,"rate":0.16,"method":"Per sqft","notes":"Type V wood frame residential","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Residential Remodel/Alteration","min_fee":50,"rate":"Tiered on valuation","method":"Tiered on cost","notes":"$50 base; rate increases by valuation tier","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Roofing","min_fee":50,"rate":0.04,"method":"Per sqft","notes":"Re-roof residential","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Electrical","min_fee":50,"rate":"Per service/unit","method":"Per unit","notes":"Based on amperage and fixture count","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Plumbing","min_fee":50,"rate":7,"method":"Per fixture","notes":"$7/fixture minimum","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Mechanical/HVAC","min_fee":50,"rate":"Per ton/unit","method":"Per ton","notes":"Based on tonnage","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"New Residential (Type V wood frame)","min_fee":69,"rate":0.15,"method":"Per sqft","notes":"From Table 1C-1","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"Residential Remodel/Alteration","min_fee":69,"rate":"Tiered on valuation","method":"Tiered on cost","notes":"Table 1A-1; tiered by trade","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"Mechanical/HVAC","min_fee":69,"rate":"Per unit/ton","method":"Per unit","notes":"Table 1-H; full schedule captured","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"Plumbing","min_fee":69,"rate":"Per fixture","method":"Per fixture","notes":"Table 1-I; full schedule captured","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"Electrical","min_fee":69,"rate":"Per service/outlet","method":"Per unit","notes":"FLAG: Electrical table not captured in session — needs manual verify","date":"4/26"},
    {"market":"Prosper","zone":"Collin County","state":"TX","municipality":"Town of Prosper","work_type":"New Residential Construction","min_fee":25,"rate":0.15,"method":"Per sqft","notes":"From ecode360.com","date":"4/26"},
    {"market":"Prosper","zone":"Collin County","state":"TX","municipality":"Town of Prosper","work_type":"Electrical","min_fee":25,"rate":"Per service/circuit","method":"Per unit","notes":"Flat schedule by service size","date":"4/26"},
    {"market":"Prosper","zone":"Collin County","state":"TX","municipality":"Town of Prosper","work_type":"Plumbing","min_fee":25,"rate":6,"method":"Per fixture","notes":"$6/fixture","date":"4/26"},
    {"market":"Prosper","zone":"Collin County","state":"TX","municipality":"Town of Prosper","work_type":"Mechanical/HVAC","min_fee":25,"rate":"Per unit","method":"Per unit","notes":"Flat per system/unit","date":"4/26"},
    {"market":"Frisco","zone":"Collin/Denton County","state":"TX","municipality":"City of Frisco","work_type":"New Residential Construction","min_fee":30,"rate":"Tiered by sqft (7 tiers)","method":"Tiered per sqft","notes":"Full schedule from friscotexas.gov","date":"4/26"},
    {"market":"Frisco","zone":"Collin/Denton County","state":"TX","municipality":"City of Frisco","work_type":"Electrical","min_fee":30,"rate":"Full unit schedule","method":"Per unit","notes":"Complete electrical fee table captured","date":"4/26"},
    {"market":"Frisco","zone":"Collin/Denton County","state":"TX","municipality":"City of Frisco","work_type":"Plumbing","min_fee":30,"rate":"Per fixture","method":"Per fixture","notes":"Full plumbing schedule captured","date":"4/26"},
    {"market":"Frisco","zone":"Collin/Denton County","state":"TX","municipality":"City of Frisco","work_type":"Mechanical/HVAC","min_fee":30,"rate":"Per unit/ton","method":"Per unit","notes":"Full mechanical schedule captured","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"New Single Family Residential","min_fee":0,"rate":0.68,"method":"Per gross sqft","notes":"$0.68/gsf from mckinneytexas.org","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Residential Addition/Alteration","min_fee":0,"rate":0.68,"method":"Per gross sqft","notes":"Same rate as new construction","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Electrical","min_fee":40,"rate":"$40 min + $0.03/sqft","method":"Base + per sqft","notes":"","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Plumbing","min_fee":40,"rate":"Per fixture","method":"Per fixture","notes":"Full fixture schedule captured","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Mechanical/HVAC","min_fee":40,"rate":"Per unit schedule","method":"Per unit","notes":"Full mechanical schedule captured","date":"4/26"},
    {"market":"Houston","zone":"Harris County","state":"TX","municipality":"City of Houston","work_type":"New Residential (Type V wood frame)","min_fee":91.06,"rate":"Tiered by valuation","method":"Tiered on value x type","notes":"9 construction types x 9 valuation tiers. Type V = primary residential. Min $91.06","date":"4/26"},
    {"market":"Houston","zone":"Harris County","state":"TX","municipality":"City of Houston","work_type":"Electrical","min_fee":91.06,"rate":"Per outlet/fixture/motor HP","method":"Per unit","notes":"Full schedule captured","date":"4/26"},
    {"market":"Houston","zone":"Harris County","state":"TX","municipality":"City of Houston","work_type":"Mechanical/HVAC","min_fee":91.06,"rate":"Per ton + 2% of valuation","method":"Per ton + pct","notes":"","date":"4/26"},
    {"market":"Houston","zone":"Harris County","state":"TX","municipality":"City of Houston","work_type":"Plumbing","min_fee":91.06,"rate":"Per fixture","method":"Per fixture","notes":"Gas, sprinklers, tanks included","date":"4/26"},
    {"market":"Austin","zone":"Travis County","state":"TX","municipality":"City of Austin","work_type":"New Residential — Building (per sqft tier)","min_fee":200,"rate":"Tiered by sqft (6 tiers)","method":"Tiered per sqft — by trade","notes":"Austin splits fees by trade within each sqft tier: Building + Electrical + Mechanical + Plumbing + Energy. Full 6-page schedule captured.","date":"4/26"},
    {"market":"Austin","zone":"Travis County","state":"TX","municipality":"City of Austin","work_type":"Residential Remodel — Electrical","min_fee":200,"rate":"Per sqft tier","method":"Tiered per sqft","notes":"Trade-specific within Austin's tiered structure","date":"4/26"},
    {"market":"Austin","zone":"Travis County","state":"TX","municipality":"City of Austin","work_type":"Residential Remodel — Mechanical/HVAC","min_fee":200,"rate":"Per sqft tier","method":"Tiered per sqft","notes":"Trade-specific within Austin's tiered structure","date":"4/26"},
    {"market":"Austin","zone":"Travis County","state":"TX","municipality":"City of Austin","work_type":"Residential Remodel — Plumbing","min_fee":200,"rate":"Per sqft tier","method":"Tiered per sqft","notes":"Trade-specific within Austin's tiered structure","date":"4/26"},
]

# ── Labor ─────────────────────────────────────────────────────────────────────
def fetch_bls_labor(market):
    area_code = market["bls_area_code"]
    area_name = market["bls_area_name"]
    results   = []
    print(f"  Pulling BLS labor: {area_name}")
    for occ_code, occ_name in BLS_OCCUPATIONS:
        try:
            resp = requests.post(
                "https://api.bls.gov/publicAPI/v2/timeseries/data/",
                json={
                    "seriesid": [
                        f"OEUM{area_code}{occ_code}1",  # mean
                        f"OEUM{area_code}{occ_code}4",  # p10
                        f"OEUM{area_code}{occ_code}8",  # p90
                    ],
                    "startyear": "2023", "endyear": "2025", "latest": True,
                },
                headers={"Content-Type": "application/json"},
                timeout=15,
            )
            vals = {}
            for series in resp.json().get("Results", {}).get("series", []):
                sid = series["seriesID"]
                for d in series.get("data", []):
                    try:
                        v = float(d["value"])
                        if   sid.endswith("1"): vals["mid"]  = v
                        elif sid.endswith("4"): vals["low"]  = v
                        elif sid.endswith("8"): vals["high"] = v
                    except (ValueError, KeyError):
                        pass
            if vals:
                results.append({
                    "trade": occ_name,
                    "low": vals.get("low", ""), "mid": vals.get("mid", ""), "high": vals.get("high", ""),
                    "source": "BLS OES 2024", "date": TODAY,
                })
            else:
                flag(market["market"], "Labor", occ_name,
                     f"BLS no data for {area_name} — pull manually from bls.gov/oes")
            time.sleep(0.3)
        except Exception as e:
            flag(market["market"], "Labor", occ_name, f"BLS API error: {e}")
    return results

# ── Materials ─────────────────────────────────────────────────────────────────
def fetch_materials_ai(market):
    state       = market["state"]
    market_name = market["market"]
    zip_code    = market["home_depot_zip"]

    items = []
    for item, cat, unit in MATERIAL_ITEMS:
        if "FL HVHZ"      in unit and state != "FL":           continue
        if "FL coastal"   in unit and state != "FL":           continue
        if "AZ/TX flat"   in unit and state not in ("AZ","TX"): continue
        if "SE/NC/SC/GA"  in unit and state not in ("NC","SC","GA","TN","FL"): continue
        items.append((item, cat, unit))

    item_list = "\n".join(f"- {i} ({u})" for i, _, u in items)
    prompt = f"""You are a construction materials pricing researcher for Even/Cornerstone OS.

Market: {market_name}, {state}  |  Home Depot zip: {zip_code}

Pull current Home Depot pricing for these items. Use web search.
Give Low/Mid/High based on product grade (basic/standard/premium).
If price cannot be confirmed, set all three to "" and add a FLAG note.

Items:
{item_list}

Return ONLY a JSON array:
[{{"item":"","category":"","unit":"","low":0.00,"mid":0.00,"high":0.00,"source":"","flag":""}}]"""

    print(f"  Pulling materials: {market_name} (zip {zip_code})")
    try:
        resp = AI.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=2000,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in resp.content if hasattr(b, "text"))
        data = json.loads(re.sub(r"```json|```", "", text).strip())
        out  = []
        for r in data:
            if r.get("flag"):
                flag(market_name, "Materials", r["item"], r["flag"])
            if r.get("low") or r.get("mid") or r.get("high"):
                out.append(r)
        return out
    except Exception as e:
        flag(market_name, "Materials", "ALL ITEMS", f"AI pull failed: {e}")
        return []

# ── Permits ───────────────────────────────────────────────────────────────────
def fetch_permits(market):
    state       = market["state"]
    market_name = market["market"]

    if state == "TX":
        rows = [r for r in TX_PERMIT_DATA if r["market"] == market_name]
        if rows:
            print(f"  Using session permit data: {market_name} ({len(rows)} rows)")
            return rows
        flag(market_name, "Permits", "ALL", "TX market not in session data — scraping live")

    results = []
    for city_info in market.get("permit_cities", []):
        city, url = city_info["city"], city_info["url"]
        prompt = f"""Fetch and parse the permit fee schedule for {city} from: {url}

Return ONLY a JSON array of residential permit fees:
[{{"municipality":"{city}","work_type":"","min_fee":null,"rate":"","method":"","notes":"","flag":""}}]

Include: New Construction, Remodel/Alteration, Roofing, Electrical, Plumbing, Mechanical/HVAC, Demolition.
Skip commercial-only types."""
        print(f"  Scraping permits: {city}")
        try:
            resp = AI.messages.create(
                model="claude-sonnet-4-20250514", max_tokens=2000,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(b.text for b in resp.content if hasattr(b, "text"))
            rows = json.loads(re.sub(r"```json|```", "", text).strip())
            for r in rows:
                if r.get("flag"):
                    flag(market_name, "Permits", f"{city} — {r.get('work_type','')}", r["flag"])
                r.update({"market": market_name, "zone": market["zone"], "state": state, "date": TODAY})
                results.append(r)
            time.sleep(1)
        except Exception as e:
            flag(market_name, "Permits", city, f"Scrape failed: {e} — check {url}")
    return results

# ── Write helpers ─────────────────────────────────────────────────────────────
def write_labor(svc, market, rows):
    if not rows: return
    append_rows(svc, TAB_LABOR, [
        [market["market"], market["zone"], r["trade"],
         r.get("low",""), r.get("mid",""), r.get("high",""),
         r.get("source","BLS OES"), r.get("date", TODAY)]
        for r in rows
    ])

def write_materials(svc, market, rows):
    if not rows: return
    append_rows(svc, TAB_MATERIALS, [
        [market["market"], market["zone"], r.get("category",""), r.get("item",""),
         r.get("unit",""), r.get("low",""), r.get("mid",""), r.get("high",""),
         r.get("source", f"Home Depot {market['home_depot_zip']}"), r.get("date", TODAY)]
        for r in rows
    ])

def write_permits(svc, market, rows):
    if not rows: return
    append_rows(svc, TAB_PERMITS, [
        [r.get("market", market["market"]), r.get("zone", market["zone"]),
         r.get("municipality",""), r.get("work_type",""), r.get("min_fee",""),
         r.get("rate",""), r.get("method",""), r.get("notes",""), r.get("date", TODAY)]
        for r in rows
    ])

def write_flags(svc):
    if not FLAGS:
        print("\n✓ No flags — clean sweep.")
        return
    print(f"\n⚑ {len(FLAGS)} flags for manual review")
    try:
        append_rows(svc, TAB_FLAGS, [
            [f["market"], f["type"], f["item"], f["reason"], TODAY]
            for f in FLAGS
        ])
    except Exception:
        print("  (Add a 'Review Flags' tab to the sheet to auto-capture these)")

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("EVEN DATA SWEEP — Black Lab Holdings / Cornerstone OS")
    print(f"Date: {TODAY}  |  Markets: {len(MARKETS)}")
    print("=" * 55)

    svc = get_sheets_service()
    print("✓ Google Sheets authenticated\n")

    for market in MARKETS:
        name = market["market"]
        print(f"\n── {name}, {market['state']} ──")

        if not market.get("skip_labor"):
            write_labor(svc, market, fetch_bls_labor(market))
        else:
            print(f"  ↷ Labor: skipping (already in sheet)")

        if not market.get("skip_materials"):
            write_materials(svc, market, fetch_materials_ai(market))
        else:
            print(f"  ↷ Materials: skipping (already in sheet)")

        write_permits(svc, market, fetch_permits(market))

    write_flags(svc)
    print(f"\n{'='*55}")
    print(f"Sweep complete. {len(FLAGS)} items flagged for review.")
    print("=" * 55)

if __name__ == "__main__":
    main()
