#!/usr/bin/env python3
"""
even_data_sweep.py
------------------
Even/Cornerstone OS — Full Market Data Population Script
One sweep: Labor + Materials + Permits across all target markets.
Writes directly to Even Data Sheet via Google Sheets API (OAuth).
Flags anything that needs manual review in a separate log.

SETUP:
  pip install google-auth google-auth-oauthlib google-auth-httplib2
              google-api-python-client requests anthropic

  First run: opens browser for Google OAuth consent.
  Subsequent runs: uses saved token (token.json).

USAGE:
  python even_data_sweep.py                  # full sweep all markets
  python even_data_sweep.py --market Dallas  # single market
  python even_data_sweep.py --type labor     # one data type only
  python even_data_sweep.py --dry-run        # preview without writing
"""

import os, json, time, datetime, argparse, re, requests
from pathlib import Path

# ── Google Sheets auth ────────────────────────────────────────────────────────
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = "1BXFEoSDMY-E_IBkv_Pv8dulP0lx7L8MQk1Z8MS8XNWY"  # Even Data Sheet

# Tab names (must match exactly in your Google Sheet)
TAB_MATERIALS = "Material Costs"
TAB_LABOR     = "Labor Rates"
TAB_PERMITS   = "Sheet3"          # rename to "Permit Fees" when ready

TODAY = datetime.date.today().strftime("%-m/%-d/%y")

# ── Anthropic (for materials + permit scraping) ───────────────────────────────
import anthropic
AI = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# ─────────────────────────────────────────────────────────────────────────────
# MARKET REGISTRY
# Every market Even will ever serve. Add new markets here — the sweep picks
# them all up automatically.
#
# Fields:
#   bls_area_code  — BLS OES metro area code (https://www.bls.gov/oes/current/msa_def.htm)
#   bls_area_name  — display name for BLS lookups
#   home_depot_zip — representative zip for HD pricing
#   permit_cities  — list of {city, url} for permit fee pages
#   zone           — Even's internal zone label
#   market_notes   — CONSTRUCTION CONTEXT FLAGS (the killer differentiator)
# ─────────────────────────────────────────────────────────────────────────────

MARKETS = [

    # ── FLORIDA ───────────────────────────────────────────────────────────────
    {
        "market": "Miami-Dade",
        "zone": "Miami Proper",
        "state": "FL",
        "bls_area_code": "33100",
        "bls_area_name": "Miami-Fort Lauderdale-West Palm Beach, FL",
        "home_depot_zip": "33101",
        "permit_cities": [
            {"city": "City of Miami",       "url": "https://www.miamidade.gov/permits/fees.asp"},
            {"city": "Miami-Dade County",   "url": "https://www.miamidade.gov/permits/fees.asp"},
        ],
        "skip_labor": True,   # already in sheet — flag to skip re-pull
        "skip_materials": True,
        "market_notes": [
            "HURRICANE/WIND: Miami-Dade and Broward have the most stringent wind codes in the US (High-Velocity Hurricane Zone — HVHZ). All roofing requires HVHZ-approved products; standard shingles from other markets are NOT code-compliant here.",
            "IMPACT WINDOWS: Standard windows cannot be used. All openings require either impact-rated glazing (PGT, CGI, Windoor) or approved storm shutters. Add $80–$150/sqft premium over standard window cost.",
            "FLOOD/ELEVATION: FEMA flood zones cover large portions of Miami-Dade. Many projects require elevation certificates and may need stem wall or pier foundation upgrades vs slab-on-grade.",
            "HUMIDITY/MOLD: Continuous vapor barrier and mold-resistant drywall (Dens-Armor or equivalent) are best practice, often required. Standard drywall absorbs moisture rapidly in this climate.",
            "CONCRETE BLOCK: CBS (Concrete Block Structure) is dominant construction type, not wood frame. Framing costs differ significantly — factor masonry labor vs carpentry labor.",
            "ROOFING SUBSTRATE: Peel-and-stick (self-adhering) underlayment required under all roofing in HVHZ, not felt. Adds $0.25–$0.40/sqft to roofing underlayment cost.",
            "PERMITS: Miami-Dade and City of Miami are separate jurisdictions with separate permit fees. Always confirm which entity has authority for the parcel.",
            "INSURANCE SURCHARGE: Contractor insurance premiums are 30–50% higher than national average due to hurricane exposure. Factor into overhead.",
        ],
    },
    {
        "market": "Broward",
        "zone": "Fort Lauderdale",
        "state": "FL",
        "bls_area_code": "33100",
        "bls_area_name": "Miami-Fort Lauderdale-West Palm Beach, FL",
        "home_depot_zip": "33301",
        "permit_cities": [
            {"city": "City of Fort Lauderdale", "url": "https://www.fortlauderdale.gov/departments/building-services/permit-fee-schedule"},
            {"city": "Broward County",           "url": "https://www.broward.org/Building/Pages/PermitFees.aspx"},
        ],
        "market_notes": [
            "HURRICANE/WIND: Same HVHZ zone as Miami-Dade. Impact-rated products required throughout.",
            "IMPACT WINDOWS: Same requirement as Miami-Dade — no standard windows.",
            "SOIL: Sandy/coastal soil means shallow utilities and slab-on-grade are standard, but coastal properties near Intracoastal may require pilings.",
            "FLOOD: Significant portions of Broward are AE and VE flood zones. Check FEMA FIRM maps before estimating foundation work.",
            "SALTWATER CORROSION: Within 3,000 ft of ocean, specify corrosion-resistant fasteners, coated rebar, and marine-grade hardware.",
        ],
    },
    {
        "market": "Palm Beach",
        "zone": "Palm Beach County",
        "state": "FL",
        "bls_area_code": "33100",
        "bls_area_name": "Miami-Fort Lauderdale-West Palm Beach, FL",
        "home_depot_zip": "33401",
        "permit_cities": [
            {"city": "Palm Beach County",   "url": "https://discover.pbcgov.org/pzb/building/Pages/Fee-Schedules.aspx"},
            {"city": "City of West Palm Beach", "url": "https://www.wpb.org/government/development-services/building"},
        ],
        "market_notes": [
            "HURRICANE/WIND: High-Velocity Hurricane Zone applies to coastal areas; inland areas transition to Florida Building Code standard wind zone. Verify by address.",
            "IMPACT WINDOWS: Required in HVHZ zones; strongly recommended everywhere in Palm Beach County.",
            "LUXURY SEGMENT: Higher-end finishes are market-standard in many Palm Beach neighborhoods. Premium material pricing is often the norm, not the exception.",
            "SOIL: Varies from sandy coastal to muck/organic inland (Glades area). Organic soils require special foundation treatment — compaction, pilings, or deep footings.",
        ],
    },
    {
        "market": "Tampa",
        "zone": "Tampa Bay",
        "state": "FL",
        "bls_area_code": "45300",
        "bls_area_name": "Tampa-St. Petersburg-Clearwater, FL",
        "home_depot_zip": "33602",
        "permit_cities": [
            {"city": "City of Tampa",       "url": "https://www.tampagov.net/construction-services/fee-schedule"},
            {"city": "Hillsborough County", "url": "https://www.hillsboroughcounty.org/en/residents/property-owners-and-renters/building-and-construction"},
        ],
        "market_notes": [
            "HURRICANE/WIND: Not HVHZ but still high wind zone. Florida Building Code wind requirements apply; impact or shutter protection strongly recommended.",
            "FLOOD: Tampa Bay is highly flood-prone. Significant AE/VE zones; post-Hurricane Ian/Helene compliance requirements have tightened.",
            "SINKHOLES: Hillsborough and surrounding counties are in active sinkhole territory. Foundation inspections and sinkhole endorsements are common requirements. May affect permit approval timeline.",
            "HUMIDITY: Same mold/moisture considerations as South FL — use mold-resistant materials.",
            "GROWTH MARKET: One of the fastest-growing metros in the US. Contractor demand is high, labor is tighter than national average.",
        ],
    },
    {
        "market": "Orlando",
        "zone": "Central Florida",
        "state": "FL",
        "bls_area_code": "36740",
        "bls_area_name": "Orlando-Kissimmee-Sanford, FL",
        "home_depot_zip": "32801",
        "permit_cities": [
            {"city": "City of Orlando",   "url": "https://www.orlando.gov/Building-Development/Permit-Fees"},
            {"city": "Orange County",     "url": "https://www.orangecountyfl.net/PermitsLicenses/BuildingPermitFees.aspx"},
        ],
        "market_notes": [
            "HURRICANE/WIND: Inland — lower wind zone than coastal FL, but still Florida Building Code. Not HVHZ.",
            "SINKHOLES: Orange and Osceola counties have sinkhole activity. Same precautions as Tampa.",
            "TOURISM/SHORT-TERM RENTAL: High short-term rental activity means faster renovation cycles and higher finish standards expected by owners.",
            "CLAY SOIL: Parts of Central FL have expansive clay soils that shift seasonally — monitor foundation cracking and drainage closely.",
            "GROWTH: Orlando is a top-5 growth metro. New construction is heavy; trade labor is competitive.",
        ],
    },
    {
        "market": "Jacksonville",
        "zone": "Northeast Florida",
        "state": "FL",
        "bls_area_code": "27260",
        "bls_area_name": "Jacksonville, FL",
        "home_depot_zip": "32202",
        "permit_cities": [
            {"city": "City of Jacksonville / Duval County", "url": "https://www.coj.net/departments/planning-and-development/building-inspection-division/permit-fee-schedule.aspx"},
        ],
        "market_notes": [
            "HURRICANE/WIND: Coastal wind zone — not HVHZ but requires wind-rated products along coast.",
            "FLOOD: St. Johns River and coastal proximity create significant flood zones.",
            "MILITARY PRESENCE: Large military contractor and support worker population drives steady rental and remodel demand.",
            "OLDER STOCK: Jacksonville has a large inventory of 1950s–1980s CBS and wood-frame homes with deferred maintenance — strong fix-and-flip pipeline.",
        ],
    },

    # ── NORTH CAROLINA ────────────────────────────────────────────────────────
    {
        "market": "Charlotte",
        "zone": "Mecklenburg County",
        "state": "NC",
        "bls_area_code": "16740",
        "bls_area_name": "Charlotte-Concord-Gastonia, NC-SC",
        "home_depot_zip": "28201",
        "permit_cities": [
            {"city": "Mecklenburg County", "url": "https://www.mecknc.gov/LUESA/BuildingStandardsDivision/Pages/FeeSchedule.aspx"},
            {"city": "City of Charlotte",  "url": "https://charlottenc.gov/growth-development/permits-inspections/permitting-fee-schedule"},
        ],
        "market_notes": [
            "RED CLAY SOIL: Piedmont red clay is expansive and poorly draining. Foundation cracks and drainage issues are common on older homes. Budget for French drains, grading, and foundation repair on flips.",
            "CRAWL SPACE: Majority of homes in Charlotte area are crawl space construction, not slab. Crawl space encapsulation is a common and high-value flip upgrade (~$5,000–$12,000).",
            "HVAC: Gas and heat pump are both common. Heat pump is dominant in new construction. Older homes often have aging HVAC — budget for full replacement on flips.",
            "TERMITES: Subterranean termites are active throughout the Piedmont. Pre-treat on all new construction; inspect and treat on all flips.",
            "GROWTH MARKET: One of the fastest-growing metros in the Southeast. Labor is competitive but available. Material prices generally 5–10% below Miami.",
            "FIRST EXPANSION MARKET: Angel (remodeling/decks) and Eduardo (siding/roofing) are beta contractor advisors here — real cost data available.",
        ],
    },
    {
        "market": "Greensboro",
        "zone": "Guilford County",
        "state": "NC",
        "bls_area_code": "24660",
        "bls_area_name": "Greensboro-High Point, NC",
        "home_depot_zip": "27401",
        "permit_cities": [
            {"city": "City of Greensboro", "url": "https://www.greensboro-nc.gov/departments/planning-community-development/building-inspections/permit-fee-schedule"},
        ],
        "market_notes": [
            "RED CLAY SOIL: Same Piedmont clay as Charlotte — drainage and foundation issues common.",
            "CRAWL SPACE: Dominant construction type in this region.",
            "OLDER HOUSING STOCK: Greensboro has significant pre-1980 inventory with deferred maintenance — active fix-and-flip market at lower price points than Charlotte.",
            "TOBACCO/TEXTILE LEGACY: Some older industrial properties converting to residential — may encounter asbestos, lead paint in pre-1978 homes.",
        ],
    },
    {
        "market": "Raleigh",
        "zone": "Wake County",
        "state": "NC",
        "bls_area_code": "39580",
        "bls_area_name": "Raleigh-Cary, NC",
        "home_depot_zip": "27601",
        "permit_cities": [
            {"city": "Wake County",      "url": "https://www.wake.gov/departments-agencies/inspections/fee-schedule"},
            {"city": "City of Raleigh",  "url": "https://raleighnc.gov/permits/permit-fees"},
        ],
        "market_notes": [
            "TECH CORRIDOR: Research Triangle Park drives high-income buyer demand. Premium finishes expected on flips targeting professional buyers.",
            "RED CLAY SOIL: Same Piedmont clay issues as Charlotte and Greensboro.",
            "RAPID GROWTH: Wake County is one of the top-growth counties in the US. Permit office is busy — longer review times than less-active markets.",
            "CRAWL SPACE: Dominant but slab construction is increasing in new builds.",
        ],
    },

    # ── SOUTH CAROLINA ────────────────────────────────────────────────────────
    {
        "market": "Charleston",
        "zone": "Charleston County",
        "state": "SC",
        "bls_area_code": "16700",
        "bls_area_name": "Charleston-North Charleston, SC",
        "home_depot_zip": "29401",
        "permit_cities": [
            {"city": "City of Charleston",    "url": "https://www.charleston-sc.gov/271/Building-Permits"},
            {"city": "Charleston County",     "url": "https://www.charlestoncounty.org/departments/building-codes/fee-schedule.php"},
            {"city": "North Charleston",      "url": "https://www.northcharleston.org/residents/building-permit-fees/"},
        ],
        "market_notes": [
            "FLOOD: Charleston is one of the most flood-prone cities in the US. Tidal flooding ('sunny day flooding') is increasing. Many properties require flood vents, elevated mechanicals, and flood-proofing.",
            "HURRICANE/WIND: Coastal wind zone. Not HVHZ but wind-rated products required near coast.",
            "HISTORIC DISTRICT: Downtown Charleston has strict historic preservation overlay — materials, colors, and design elements may require HPC approval. Adds time and cost.",
            "CRAWL SPACE: Dominant construction type; elevated crawl space is common due to flood risk.",
            "SALTWATER CORROSION: Coastal exposure means corrosion-resistant fasteners, coated metal, and pressure-treated lumber rated for ground contact and marine exposure.",
            "PALMETTO BUGS / TERMITES: Subterranean and Formosan termites are highly active. Pre-treat all new construction; budget termite treatment on every flip.",
            "UNCLE (MASTER PLUMBER): Beta contractor advisor in Charleston — real plumbing cost data available.",
        ],
    },
    {
        "market": "Columbia",
        "zone": "Richland County",
        "state": "SC",
        "bls_area_code": "17900",
        "bls_area_name": "Columbia, SC",
        "home_depot_zip": "29201",
        "permit_cities": [
            {"city": "City of Columbia (SC)", "url": "https://www.columbiasc.gov/departments/planning-development/building-permits"},
            {"city": "Richland County",       "url": "https://www.richlandcountysc.gov/Departments/Building-Services"},
        ],
        "market_notes": [
            "RED CLAY / EXPANSIVE SOIL: Columbia sits on heavy clay soils — foundation movement, poor drainage, and cracking are common on older homes.",
            "TERMITES: Extremely active termite zone — Formosan termites are present. Pre-treat all construction.",
            "HURRICANE/WIND: Inland — reduced wind requirements vs coast. Standard SC Building Code applies.",
            "MILITARY: Fort Jackson is a significant economic driver — stable rental demand.",
            "AFFORDABLE MARKET: Lower price points than Charlotte or Charleston, with active investor community targeting $80–$150K flips.",
        ],
    },

    # ── GEORGIA ───────────────────────────────────────────────────────────────
    {
        "market": "Atlanta",
        "zone": "Fulton County",
        "state": "GA",
        "bls_area_code": "12060",
        "bls_area_name": "Atlanta-Sandy Springs-Roswell, GA",
        "home_depot_zip": "30301",
        "permit_cities": [
            {"city": "City of Atlanta",  "url": "https://www.atlantaga.gov/government/departments/city-planning/office-of-buildings/permit-fees"},
            {"city": "Fulton County",    "url": "https://www.fultoncountyga.gov/services/building-permits"},
        ],
        "market_notes": [
            "RED CLAY SOIL (GEORGIA CLAY): Georgia red clay is dense, poorly draining, and highly expansive when wet. This is the #1 construction complication in Atlanta-area flips. Budget for: French drains, grading corrections, downspout extensions away from foundation, and crawl space moisture barriers.",
            "CRAWL SPACE: Dominant construction type in Atlanta metro. Crawl space encapsulation is a high-ROI flip upgrade.",
            "TREE CANOPY: Atlanta is known for its dense urban tree canopy. Root intrusion into sewer lines and foundations is common on older properties. Budget for root inspection and line clearing on all flips.",
            "TERMITES: Georgia is one of the highest-risk termite states in the US. Subterranean termites are extremely active. Pre-treat all new construction and inspect every flip.",
            "HVAC: Georgia summers are brutal. HVAC is a critical system — older homes often have undersized or failing units. Budget HVAC replacement on most flips.",
            "GRANITE COUNTERTOPS: Atlanta buyers expect granite or quartz at mid-range and above. Laminate hurts resale value.",
            "GROWTH MARKET: Atlanta MSA continues strong in-migration. Active fix-and-flip market in Fulton, DeKalb, Clayton, and Gwinnett counties.",
            "SUBURBAN SPRAWL: Outer markets (Marietta, Smyrna, Alpharetta, Duluth) have active new construction and high flip competition.",
        ],
    },
    {
        "market": "Savannah",
        "zone": "Chatham County",
        "state": "GA",
        "bls_area_code": "42340",
        "bls_area_name": "Savannah, GA",
        "home_depot_zip": "31401",
        "permit_cities": [
            {"city": "City of Savannah",  "url": "https://www.savannahga.gov/1121/Permits-Licensing"},
            {"city": "Chatham County",    "url": "https://www.chathamcounty.org/468/Building-Safety-Regulatory-Services"},
        ],
        "market_notes": [
            "HISTORIC DISTRICT: Savannah's historic squares and downtown are under strict preservation rules. Material and design approvals required — adds lead time.",
            "FLOOD: Coastal and tidal flooding is significant. Many properties are in AE flood zones.",
            "HURRICANE/WIND: Coastal wind zone — wind-rated products required near coast.",
            "RED CLAY + COASTAL SAND: Soil varies from inland clay to coastal sandy marsh. Know your parcel before estimating foundation work.",
            "SALTWATER CORROSION: Near-coast properties require marine-grade hardware and corrosion-resistant fasteners.",
            "TERMITES: Same high-activity zone as Atlanta.",
            "GROWING FLIP MARKET: Port of Savannah expansion driving population growth and housing demand.",
        ],
    },

    # ── TEXAS ─────────────────────────────────────────────────────────────────
    {
        "market": "Dallas",
        "zone": "Dallas County",
        "state": "TX",
        "bls_area_code": "19100",
        "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "75201",
        "permit_cities": [
            {"city": "City of Dallas",    "url": "https://dallascityhall.com/departments/sustainabledevelopment/buildinginspection/pages/fee-schedule.aspx"},
            {"city": "Dallas County",     "url": "https://www.dallascounty.org/departments/dcccd/"},
        ],
        "market_notes": [
            "EXPANSIVE CLAY (BLACK COTTON SOIL): North Texas has some of the most expansive clay soils in the world. This is the #1 construction issue in DFW. Foundations move significantly with moisture changes — pier-and-beam and post-tension slabs are common. Foundation repair is a near-universal line item on Dallas flips.",
            "FOUNDATION WATERING: Homeowners in Dallas often use soaker hoses around foundations to maintain consistent soil moisture and prevent differential settling. Mention this to contractor clients.",
            "HAIL: DFW is in a major hail corridor. Roof replacement due to hail damage is extremely common — Class 4 impact-resistant shingles are worth specifying for long-term value.",
            "TORNADO: Tornado shelters and safe rooms are a value-add on Dallas flips, especially in outer suburbs.",
            "NO STATE INCOME TAX: Labor market behaves differently — workers retain more take-home, but contractor competition for skilled trades is high.",
            "PIER AND BEAM: Many older Dallas homes are pier-and-beam. Leveling costs should be assessed on every flip.",
        ],
    },
    {
        "market": "Fort Worth",
        "zone": "Tarrant County",
        "state": "TX",
        "bls_area_code": "19100",
        "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "76102",
        "permit_cities": [
            {"city": "City of Fort Worth", "url": "https://www.fortworthtexas.gov/departments/development-services/permitting/fee-schedule"},
            {"city": "Tarrant County",     "url": "https://www.tarrantcounty.com/en/development-services.html"},
        ],
        "market_notes": [
            "EXPANSIVE CLAY: Same black cotton soil as Dallas — foundation movement is the primary risk on all projects.",
            "HAIL CORRIDOR: Tarrant County receives significant hail — Class 4 roofing is smart spec.",
            "GAS/OIL INFRASTRUCTURE: Barnett Shale underlies much of Tarrant County. Some properties have existing easements or mineral rights considerations.",
            "WEST TX WIND: More wind exposure than Dallas proper — roof fastening and flashing details matter.",
        ],
    },
    {
        "market": "Prosper",
        "zone": "Collin County",
        "state": "TX",
        "bls_area_code": "19100",
        "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "75078",
        "permit_cities": [
            {"city": "Town of Prosper", "url": "https://www.prospertx.gov/departments/development-services/"},
        ],
        "market_notes": [
            "RAPIDLY GROWING SUBURB: Prosper is one of the fastest-growing towns in the US. New construction dominates but remodel demand is rising as first wave of homes ages.",
            "EXPANSIVE CLAY: Same North Texas clay issues as Dallas/Fort Worth.",
            "HIGH-END MARKET: Prosper buyers expect premium finishes. Builder-grade materials reduce resale value significantly.",
            "PERMITTING BACKLOG: Fast growth = busy permit office. Plan for longer review times on new construction.",
        ],
    },
    {
        "market": "Frisco",
        "zone": "Collin/Denton County",
        "state": "TX",
        "bls_area_code": "19100",
        "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "75034",
        "permit_cities": [
            {"city": "City of Frisco", "url": "https://www.friscotexas.gov/1262/Building-Inspection"},
        ],
        "market_notes": [
            "PREMIUM SUBURB: Frisco is a top-tier DFW suburb — high income, top schools, tech employers. Buyers expect high-end finishes.",
            "EXPANSIVE CLAY: North Texas clay — foundation maintenance is ongoing.",
            "HAIL: Collin County is in the hail corridor.",
            "HIGH COMPETITION: Active investor market. Speed and quality of finish determine spread.",
        ],
    },
    {
        "market": "McKinney",
        "zone": "Collin County",
        "state": "TX",
        "bls_area_code": "19100",
        "bls_area_name": "Dallas-Fort Worth-Arlington, TX",
        "home_depot_zip": "75069",
        "permit_cities": [
            {"city": "City of McKinney", "url": "https://www.mckinneytexas.org/1218/Permits-Inspections"},
        ],
        "market_notes": [
            "HISTORIC DOWNTOWN + GROWTH SUBURBS: Mix of older historic core and fast-growing outer areas. Different product and finish expectations by submarket.",
            "EXPANSIVE CLAY: Same North Texas clay.",
            "HAIL CORRIDOR: Class 4 shingles worth specifying.",
        ],
    },
    {
        "market": "Houston",
        "zone": "Harris County",
        "state": "TX",
        "bls_area_code": "26420",
        "bls_area_name": "Houston-The Woodlands-Sugar Land, TX",
        "home_depot_zip": "77001",
        "permit_cities": [
            {"city": "City of Houston",  "url": "https://www.houstontx.gov/permits/feeinfo.html"},
            {"city": "Harris County",    "url": "https://www.harriscountytx.gov/"},
        ],
        "market_notes": [
            "FLOOD (CRITICAL): Houston is the most flood-prone major city in the US. Hurricanes Harvey, Imelda, and others have fundamentally changed how investors approach Houston. Always verify FEMA flood zone and flood history (Houston Flood Map — harriscountyfemt.org). Properties with repeated flood claims are often being sold cheap for a reason.",
            "PIER AND BEAM + SLAB: Both construction types are common. Older inner-loop homes are pier-and-beam; suburbs are slab.",
            "EXPANSIVE CLAY: Houston area clay is significant — foundation movement is common, especially after wet/dry cycles.",
            "HURRICANE: Gulf Coast exposure — wind and storm surge risk for properties near coast or bay. Hurricane straps and wind mitigation are relevant.",
            "HUMIDITY/MOLD: Houston's humidity rivals South Florida. Mold-resistant materials and proper vapor management are essential.",
            "NO ZONING (CITY OF HOUSTON): Houston famously has no city zoning code. Permits are still required but land use is governed by deed restrictions rather than zoning maps. This creates unique renovation and conversion opportunities.",
            "LARGE MARKET: Houston is the 4th largest city in the US. Highly active fix-and-flip market across Harris, Fort Bend, Montgomery, and Brazoria counties.",
        ],
    },
    {
        "market": "Austin",
        "zone": "Travis County",
        "state": "TX",
        "bls_area_code": "12420",
        "bls_area_name": "Austin-Round Rock-Georgetown, TX",
        "home_depot_zip": "78701",
        "permit_cities": [
            {"city": "City of Austin", "url": "https://www.austintexas.gov/department/development-services/permit-fee-schedules"},
            {"city": "Travis County",  "url": "https://www.traviscountytx.gov/tnr/permits"},
        ],
        "market_notes": [
            "MARKET CORRECTION: Austin experienced significant price correction from 2022–2024 peak. Margins are tighter than during the boom — buy-side discipline is critical.",
            "LIMESTONE/CEDAR CHOPPER ROCK: Austin sits on limestone karst geology. Rock can surface even during minor excavation — trenching for plumbing or foundations can become significantly more expensive when rock is encountered. Always budget a rock contingency on Austin jobs.",
            "CEDAR FEVER / LANDSCAPING: Live oak and cedar are dominant — root intrusion and landscaping removal costs on flips.",
            "TECH WORKER BUYER: Austin buyers expect high-spec finishes. Builder-grade materials underperform in this market.",
            "PERMIT DELAYS: Austin's permit office has historically had long backtimes. Online permitting has improved but budget extra lead time.",
            "WATER RESTRICTIONS: Parts of Austin and surrounding Hill Country have water use restrictions affecting landscaping and irrigation install.",
            "WATCH MARKET: Data shows Austin had negative flip ROI in recent quarters. Viable with right buy price but not the easiest TX market right now.",
        ],
    },

    # ── ARIZONA ───────────────────────────────────────────────────────────────
    {
        "market": "Phoenix",
        "zone": "Maricopa County",
        "state": "AZ",
        "bls_area_code": "38060",
        "bls_area_name": "Phoenix-Mesa-Chandler, AZ",
        "home_depot_zip": "85001",
        "permit_cities": [
            {"city": "City of Phoenix",    "url": "https://www.phoenix.gov/pdd/permits/fees"},
            {"city": "Maricopa County",    "url": "https://www.maricopa.gov/1592/Permits-Fees"},
            {"city": "City of Mesa",       "url": "https://www.mesaaz.gov/business/development-services/permit-fees"},
            {"city": "City of Scottsdale", "url": "https://www.scottsdaleaz.gov/building/permit-fees"},
            {"city": "City of Chandler",   "url": "https://www.chandleraz.gov/residents/building-and-development/permits/permit-fees"},
            {"city": "City of Tempe",      "url": "https://www.tempe.gov/government/community-development/permits-fees"},
        ],
        "market_notes": [
            "DESERT CLIMATE: Extreme heat (115°F+ summers) is the dominant construction driver. HVAC sizing, attic ventilation, and cool-roof products are critical to Phoenix resale value.",
            "COOL ROOF / REFLECTIVE: Title 24 (AZ) and buyer expectations push toward light-colored or reflective roofing. Dark shingles absorb heat and hurt energy performance — specify cool-roof rated products.",
            "STUCCO DOMINANT: Wood-frame stucco is the dominant exterior in Phoenix. Stucco cracking, improper flashing, and moisture intrusion at penetrations are common flip issues. Inspect all stucco carefully.",
            "FLAT ROOF: Many Phoenix homes have flat or low-slope roof sections (common in ranch-style homes). Flat roofs require different materials — TPO, modified bitumen, or foam roofing — not shingles.",
            "DESERT LANDSCAPING: Buyers expect desert/xeriscape landscaping, not grass. Adding or removing turf has different cost implications than Southeast markets.",
            "CALICHE SOIL: Hard caliche layer is present throughout the Valley. Trenching and excavation can be significantly more expensive than expected when caliche is encountered.",
            "TERMITES (DESERT): Subterranean and desert drywood termites are active in Phoenix. Pre-treat all new construction.",
            "NO BASEMENT: Basements are essentially nonexistent in Phoenix due to soil and climate. All mechanicals are above grade.",
            "SOLAR: Arizona's solar environment is optimal. Buyers increasingly expect solar-ready or solar-equipped homes. Factor solar conduit rough-in into renovation plans.",
            "YEAR-ROUND CONSTRUCTION: No winter shutdown. One of the few major markets where construction can proceed at full pace 12 months/year.",
        ],
    },
    {
        "market": "Tucson",
        "zone": "Pima County",
        "state": "AZ",
        "bls_area_code": "46060",
        "bls_area_name": "Tucson, AZ",
        "home_depot_zip": "85701",
        "permit_cities": [
            {"city": "City of Tucson",  "url": "https://www.tucsonaz.gov/departments/planning-development-services/permits/permit-fees"},
            {"city": "Pima County",     "url": "https://webcms.pima.gov/government/development_services_department/permits/"},
        ],
        "market_notes": [
            "AFFORDABLE ENTRY: Tucson offers lower acquisition costs than Phoenix — widest potential gross spread in AZ for budget-conscious flips.",
            "DESERT CLIMATE: Same heat management, cool-roof, and stucco considerations as Phoenix.",
            "CALICHE SOIL: Same hard caliche layer as Phoenix metro — excavation contingency required.",
            "UNIVERSITY OF ARIZONA: Drives rental demand and provides a rental exit fallback if flip takes longer.",
            "DAVIS-MONTHAN AFB: Military presence adds stable housing demand base.",
            "FLAT ROOF: Common in Tucson residential architecture.",
        ],
    },

    # ── TENNESSEE (watch market — high construction + flip activity) ──────────
    {
        "market": "Nashville",
        "zone": "Davidson County",
        "state": "TN",
        "bls_area_code": "34980",
        "bls_area_name": "Nashville-Davidson-Murfreesboro-Franklin, TN",
        "home_depot_zip": "37201",
        "permit_cities": [
            {"city": "Metro Nashville / Davidson County", "url": "https://www.nashville.gov/departments/codes/fee-schedule"},
        ],
        "market_notes": [
            "EXPLOSIVE GROWTH: Nashville is one of the top-growth metros in the US. Active fix-and-flip market with rising prices supporting strong ARVs.",
            "LIMESTONE/KARST: Similar to Austin — limestone geology in parts of Nashville means potential rock encounters during excavation.",
            "CLAY SOIL: Middle Tennessee has significant clay soil — crawl space moisture and drainage are ongoing issues.",
            "CRAWL SPACE: Dominant construction type in older Nashville stock.",
            "TORNADO: Tennessee is in an active tornado zone — storm shelters and wind-rated products are relevant.",
            "NO INCOME TAX (TN): Similar labor market dynamics to Texas.",
            "MUSIC ROW / SHORT-TERM RENTAL: High STR demand in Nashville — investors renovating for Airbnb need different finish spec than typical flip.",
        ],
    },

    # ── MEMPHIS (active flip market per industry data) ────────────────────────
    {
        "market": "Memphis",
        "zone": "Shelby County",
        "state": "TN",
        "bls_area_code": "32820",
        "bls_area_name": "Memphis, TN-MS-AR",
        "home_depot_zip": "38103",
        "permit_cities": [
            {"city": "City of Memphis / Shelby County", "url": "https://www.shelbycountytn.gov/1032/Building-Codes"},
        ],
        "market_notes": [
            "HIGH FLIP ACTIVITY: Memphis consistently ranks as one of the most active fix-and-flip markets nationally by volume.",
            "AFFORDABLE ACQUISITION: Lower median prices mean lower capital requirements — active at the $50–$120K buy range.",
            "CLAY SOIL: Heavy clay throughout Memphis area — foundation and drainage issues common.",
            "OLDER HOUSING STOCK: Large inventory of 1940s–1970s homes — lead paint and asbestos testing required on pre-1978 properties.",
            "SEISMIC ZONE: Memphis sits near the New Madrid Seismic Zone — one of the most seismically active areas east of the Rockies. Foundation and structural considerations are unique vs Southeast/TX markets.",
            "HIGH CRIME POCKETS: Market selection within Memphis matters significantly — neighborhood quality varies dramatically at the block level.",
        ],
    },

]

# ── BLS OES occupation codes to pull ──────────────────────────────────────────
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

# ── Material items to pull ────────────────────────────────────────────────────
MATERIAL_ITEMS = [
    ("Architectural Shingles",           "roofing",   "per bundle (33.33 sf)"),
    ("Roof Underlayment",                "roofing",   "per roll"),
    ("Ridge Cap Shingles",               "roofing",   "per bundle"),
    ("Drywall 1/2 inch 4x8",             "interior",  "per sheet"),
    ("2x4x8 Stud",                       "framing",   "per piece"),
    ("3/4 inch Plywood",                 "framing",   "per sheet"),
    ("Cement Board (Durock/HardieBacker)","interior",  "per sheet"),
    ("Luxury Vinyl Plank Flooring",      "flooring",  "per sqft"),
    ("Ceramic Floor Tile",               "flooring",  "per sqft"),
    ("24x24 Porcelain Tile",             "flooring",  "per sqft"),
    ("Behr Premium Interior Paint",      "finishes",  "per gallon"),
    ("4 inch PVC Pipe",                  "plumbing",  "per 10 ft"),
    ("3/4 inch Copper Pipe",             "plumbing",  "per 10 ft"),
    ("60 lb Concrete Mix",               "concrete",  "per bag"),
    # Market-specific additions (conditionally included)
    ("Impact Window (standard slider)",  "windows",   "per sqft — FL coastal markets only"),
    ("Peel-and-Stick Underlayment",      "roofing",   "per roll — FL HVHZ markets only"),
    ("TPO Roofing Membrane",             "roofing",   "per sqft — AZ/TX flat roof markets"),
    ("Crawl Space Encapsulation Vapor Barrier", "foundation", "per sqft — SE/NC/SC/GA/TN markets"),
]

# ── Hardcoded TX permit data (from your screenshotting session) ───────────────
# These were captured and organized but never saved to Drive.
# Sourced from official city sites April 2026.
TX_PERMIT_DATA = [
    # Dallas
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"New Residential Construction","min_fee":50,"rate":0.16,"method":"Per sqft","notes":"Applies to Type V wood frame residential","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Residential Remodel/Alteration","min_fee":50,"rate":"Tiered on valuation","method":"Tiered on cost","notes":"$50 base; rate increases by valuation tier","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Roofing","min_fee":50,"rate":0.04,"method":"Per sqft","notes":"Re-roof residential","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Electrical","min_fee":50,"rate":"Per service/unit","method":"Per unit","notes":"Based on amperage and fixture count","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Plumbing","min_fee":50,"rate":7,"method":"Per fixture","notes":"$7/fixture minimum","date":"4/26"},
    {"market":"Dallas","zone":"Dallas County","state":"TX","municipality":"City of Dallas","work_type":"Mechanical/HVAC","min_fee":50,"rate":"Per ton/unit","method":"Per ton","notes":"Based on tonnage","date":"4/26"},

    # Fort Worth
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"New Residential (Type V wood frame)","min_fee":69,"rate":0.15,"method":"Per sqft","notes":"From Table 1C-1","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"Residential Remodel/Alteration","min_fee":69,"rate":"Tiered on valuation","method":"Tiered on cost","notes":"Table 1A-1; tiered by trade","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"Mechanical/HVAC","min_fee":69,"rate":"Per unit/ton","method":"Per unit","notes":"Table 1-H; full schedule captured","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"Plumbing","min_fee":69,"rate":"Per fixture","method":"Per fixture","notes":"Table 1-I; full schedule captured","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"Electrical","min_fee":69,"rate":"Per service/outlet","method":"Per unit","notes":"FLAG: Electrical table not captured in session — needs manual verify","date":"4/26"},
    {"market":"Fort Worth","zone":"Tarrant County","state":"TX","municipality":"City of Fort Worth","work_type":"Demolition","min_fee":69,"rate":69,"method":"Flat fee","notes":"","date":"4/26"},

    # Prosper
    {"market":"Prosper","zone":"Collin County","state":"TX","municipality":"Town of Prosper","work_type":"New Residential Construction","min_fee":25,"rate":0.15,"method":"Per sqft","notes":"From ecode360.com — official Prosper fee schedule","date":"4/26"},
    {"market":"Prosper","zone":"Collin County","state":"TX","municipality":"Town of Prosper","work_type":"Electrical","min_fee":25,"rate":"Per service/circuit","method":"Per unit","notes":"Flat schedule by service size","date":"4/26"},
    {"market":"Prosper","zone":"Collin County","state":"TX","municipality":"Town of Prosper","work_type":"Plumbing","min_fee":25,"rate":6,"method":"Per fixture","notes":"$6/fixture","date":"4/26"},
    {"market":"Prosper","zone":"Collin County","state":"TX","municipality":"Town of Prosper","work_type":"Mechanical/HVAC","min_fee":25,"rate":"Per unit","method":"Per unit","notes":"Flat per system/unit","date":"4/26"},

    # Frisco
    {"market":"Frisco","zone":"Collin/Denton County","state":"TX","municipality":"City of Frisco","work_type":"New Residential Construction","min_fee":30,"rate":"Tiered by sqft (7 tiers)","method":"Tiered per sqft","notes":"Full schedule from friscotexas.gov — 7 sqft tiers captured","date":"4/26"},
    {"market":"Frisco","zone":"Collin/Denton County","state":"TX","municipality":"City of Frisco","work_type":"Residential Alteration/Addition","min_fee":30,"rate":"Tiered on valuation","method":"Tiered on cost","notes":"From Table 1-A commercial alteration schedule","date":"4/26"},
    {"market":"Frisco","zone":"Collin/Denton County","state":"TX","municipality":"City of Frisco","work_type":"Electrical","min_fee":30,"rate":"Full unit schedule","method":"Per unit","notes":"Complete electrical fee table captured","date":"4/26"},
    {"market":"Frisco","zone":"Collin/Denton County","state":"TX","municipality":"City of Frisco","work_type":"Plumbing","min_fee":30,"rate":"Per fixture","method":"Per fixture","notes":"Full plumbing schedule captured","date":"4/26"},
    {"market":"Frisco","zone":"Collin/Denton County","state":"TX","municipality":"City of Frisco","work_type":"Mechanical/HVAC","min_fee":30,"rate":"Per unit/ton","method":"Per unit","notes":"Full mechanical schedule — bottom of last page partially cut; flagged","date":"4/26"},

    # McKinney
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"New Single Family Residential","min_fee":0,"rate":0.68,"method":"Per gross sqft","notes":"$0.68/gsf from mckinneytexas.org","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Residential Addition/Alteration","min_fee":0,"rate":0.68,"method":"Per gross sqft","notes":"Same rate as new construction","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Multi-Family","min_fee":520,"rate":520,"method":"Flat per unit","notes":"$520/unit","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Roofing (Re-roof)","min_fee":40,"rate":40,"method":"Flat","notes":"Flat re-roof fee","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Electrical","min_fee":40,"rate":"$40 min + $0.03/sqft","method":"Base + per sqft","notes":"$40 minimum plus $0.03/sqft of structure","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Plumbing","min_fee":40,"rate":"Per fixture","method":"Per fixture","notes":"Full fixture schedule captured","date":"4/26"},
    {"market":"McKinney","zone":"Collin County","state":"TX","municipality":"City of McKinney","work_type":"Mechanical/HVAC","min_fee":40,"rate":"Per unit schedule","method":"Per unit","notes":"Full mechanical schedule captured","date":"4/26"},

    # Houston
    {"market":"Houston","zone":"Harris County","state":"TX","municipality":"City of Houston","work_type":"New Residential (Type V wood frame)","min_fee":91.06,"rate":"Tiered by valuation (9 construction types)","method":"Tiered on value × type","notes":"Complex: 9 construction types × 9 valuation tiers. Type V wood frame = primary residential. Minimum fee $91.06","date":"4/26"},
    {"market":"Houston","zone":"Harris County","state":"TX","municipality":"City of Houston","work_type":"Structural Permit (Residential Remodel)","min_fee":91.06,"rate":"Tiered on valuation","method":"Tiered on cost","notes":"Same tiered structure; simplified to Type V residential range for Even use","date":"4/26"},
    {"market":"Houston","zone":"Harris County","state":"TX","municipality":"City of Houston","work_type":"Electrical","min_fee":91.06,"rate":"Per outlet/fixture/motor HP","method":"Per unit","notes":"Per outlet, per fixture, per motor HP, meter loops — full schedule captured","date":"4/26"},
    {"market":"Houston","zone":"Harris County","state":"TX","municipality":"City of Houston","work_type":"Mechanical/HVAC","min_fee":91.06,"rate":"Per ton + 2% of valuation","method":"Per ton + pct","notes":"Base per ton + 2% of project valuation","date":"4/26"},
    {"market":"Houston","zone":"Harris County","state":"TX","municipality":"City of Houston","work_type":"Plumbing","min_fee":91.06,"rate":"Per fixture","method":"Per fixture","notes":"Gas, sprinklers, tanks included in schedule","date":"4/26"},

    # Austin
    {"market":"Austin","zone":"Travis County","state":"TX","municipality":"City of Austin","work_type":"New Residential — Building (per sqft tier)","min_fee":200,"rate":"Tiered by sqft (6 tiers)","method":"Tiered per sqft — by trade","notes":"Austin breaks fees by trade within each sqft tier: Building + Electrical + Mechanical + Plumbing + Energy. Full 6-page schedule from austintexas.gov captured.","date":"4/26"},
    {"market":"Austin","zone":"Travis County","state":"TX","municipality":"City of Austin","work_type":"Residential Remodel/Alteration — Electrical","min_fee":200,"rate":"Per sqft tier","method":"Tiered per sqft","notes":"Trade-specific within Austin's tiered structure","date":"4/26"},
    {"market":"Austin","zone":"Travis County","state":"TX","municipality":"City of Austin","work_type":"Residential Remodel/Alteration — Mechanical/HVAC","min_fee":200,"rate":"Per sqft tier","method":"Tiered per sqft","notes":"Trade-specific within Austin's tiered structure","date":"4/26"},
    {"market":"Austin","zone":"Travis County","state":"TX","municipality":"City of Austin","work_type":"Residential Remodel/Alteration — Plumbing","min_fee":200,"rate":"Per sqft tier","method":"Tiered per sqft","notes":"Trade-specific within Austin's tiered structure","date":"4/26"},
]

# ── FLAGS LOG ─────────────────────────────────────────────────────────────────
FLAGS = []

def flag(market, data_type, item, reason):
    FLAGS.append({
        "market": market,
        "type": data_type,
        "item": item,
        "reason": reason,
        "date": TODAY,
    })
    print(f"  ⚑ FLAG [{market}] {data_type} — {item}: {reason}")


# ─────────────────────────────────────────────────────────────────────────────
# GOOGLE SHEETS AUTH
# ─────────────────────────────────────────────────────────────────────────────

def get_sheets_service():
    creds = None
    if Path("token.json").exists():
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Requires credentials.json downloaded from Google Cloud Console
            # OAuth 2.0 Desktop app credentials
            if not Path("credentials.json").exists():
                raise FileNotFoundError(
                    "credentials.json not found.\n"
                    "Download it from Google Cloud Console → APIs & Services → Credentials\n"
                    "Create OAuth 2.0 Client ID → Desktop app → Download JSON → save as credentials.json"
                )
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as f:
            f.write(creds.to_json())
    return build("sheets", "v4", credentials=creds)


def append_rows(service, sheet_id, tab, rows):
    """Append rows to a specific tab."""
    range_name = f"'{tab}'!A1"
    body = {"values": rows}
    service.spreadsheets().values().append(
        spreadsheetId=sheet_id,
        range=range_name,
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body=body,
    ).execute()
    print(f"  ✓ Wrote {len(rows)} rows → {tab}")


def get_existing_keys(service, sheet_id, tab, key_cols):
    """Read existing rows to avoid duplicates."""
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range=f"'{tab}'!A:Z"
        ).execute()
        rows = result.get("values", [])
        return set(tuple(r[i] for i in key_cols if i < len(r)) for r in rows[1:])
    except Exception:
        return set()


# ─────────────────────────────────────────────────────────────────────────────
# LABOR — BLS OES API
# ─────────────────────────────────────────────────────────────────────────────

def fetch_bls_labor(market):
    """
    Pull BLS OES wage data for a market's MSA.
    Returns list of dicts with Low/Mid/High hourly wages.
    BLS public API v2 — no key required for low-volume requests.
    """
    area_code = market["bls_area_code"]
    area_name = market["bls_area_name"]
    results = []

    print(f"  Pulling BLS labor: {area_name}")

    # BLS OES series format: OEU{area_code}{occ_code}03 (hourly mean)
    # We pull p10 (low), mean (mid), p90 (high) via separate queries
    # Series IDs: OEUM{area}{occ}1 = mean; OEUM{area}{occ}4 = p10; OEUM{area}{occ}8 = p90

    for occ_code, occ_name in BLS_OCCUPATIONS:
        series_mean = f"OEUM{area_code}{occ_code}1"
        series_p10  = f"OEUM{area_code}{occ_code}4"
        series_p90  = f"OEUM{area_code}{occ_code}8"

        try:
            resp = requests.post(
                "https://api.bls.gov/publicAPI/v2/timeseries/data/",
                json={
                    "seriesid": [series_mean, series_p10, series_p90],
                    "startyear": "2023",
                    "endyear": "2025",
                    "latest": True,
                },
                headers={"Content-Type": "application/json"},
                timeout=15,
            )
            data = resp.json()

            vals = {}
            for series in data.get("Results", {}).get("series", []):
                sid = series["seriesID"]
                for d in series.get("data", []):
                    try:
                        v = float(d["value"])
                        if sid.endswith("1"):
                            vals["mid"] = v
                        elif sid.endswith("4"):
                            vals["low"] = v
                        elif sid.endswith("8"):
                            vals["high"] = v
                    except (ValueError, KeyError):
                        pass

            if vals:
                results.append({
                    "trade": occ_name,
                    "low":  vals.get("low", ""),
                    "mid":  vals.get("mid", ""),
                    "high": vals.get("high", ""),
                    "source": "BLS OES 2024",
                    "date": TODAY,
                })
            else:
                flag(market["market"], "Labor", occ_name,
                     f"BLS returned no data for {area_name} — manual pull needed from bls.gov/oes")

            time.sleep(0.3)  # be polite to BLS API

        except Exception as e:
            flag(market["market"], "Labor", occ_name,
                 f"BLS API error: {str(e)} — manual pull needed")

    return results


# ─────────────────────────────────────────────────────────────────────────────
# MATERIALS — Claude AI + Web Search
# ─────────────────────────────────────────────────────────────────────────────

def fetch_materials_ai(market):
    """
    Use Claude with web search to pull current Home Depot pricing
    for the target market zip code. Claude flags anything uncertain.
    """
    zip_code = market["home_depot_zip"]
    market_name = market["market"]
    state = market["state"]

    # Filter material items to market-relevant ones
    items = []
    for item, category, unit in MATERIAL_ITEMS:
        # Market-specific filters
        if "FL HVHZ" in unit and state != "FL":
            continue
        if "FL coastal" in unit and state != "FL":
            continue
        if "AZ/TX flat roof" in unit and state not in ("AZ", "TX"):
            continue
        if "SE/NC/SC/GA/TN" in unit and state not in ("NC", "SC", "GA", "TN", "FL"):
            continue
        items.append((item, category, unit))

    item_list = "\n".join([f"- {item} ({unit})" for item, category, unit in items])

    prompt = f"""You are a construction materials pricing researcher for Even/Cornerstone OS,
an AI estimating tool for contractors.

Target market: {market_name}, {state} (Home Depot store zip: {zip_code})

Pull current Home Depot pricing for these items for this market location.
Use web search to find current prices. If you find a price, give Low/Mid/High range
based on product grade tiers (basic/standard/premium). If you cannot confirm a price,
set all three to "" and include a FLAG note.

Items to price:
{item_list}

Return ONLY a JSON array, no other text. Format:
[
  {{
    "item": "item name",
    "category": "category",
    "unit": "unit description",
    "low": 0.00,
    "mid": 0.00,
    "high": 0.00,
    "source": "Home Depot [zip] [date]",
    "flag": "" or "reason needs manual verify"
  }}
]"""

    print(f"  Pulling materials via AI: {market_name} (zip {zip_code})")

    try:
        resp = AI.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{"role": "user", "content": prompt}],
        )

        # Extract text from response
        result_text = ""
        for block in resp.content:
            if hasattr(block, "text"):
                result_text += block.text

        # Parse JSON
        clean = re.sub(r"```json|```", "", result_text).strip()
        items_data = json.loads(clean)

        output = []
        for item in items_data:
            if item.get("flag"):
                flag(market_name, "Materials", item["item"], item["flag"])
            if item.get("low") or item.get("mid") or item.get("high"):
                output.append(item)

        return output

    except Exception as e:
        flag(market_name, "Materials", "ALL ITEMS",
             f"AI material pull failed: {str(e)} — manual Home Depot check needed")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# PERMITS — AI scrape + hardcoded TX data
# ─────────────────────────────────────────────────────────────────────────────

def fetch_permits_ai(market):
    """
    Scrape permit fee pages using Claude + web search.
    TX data is hardcoded from prior session; other markets are scraped live.
    """
    state = market["state"]
    market_name = market["market"]

    # TX — use hardcoded session data
    if state == "TX":
        results = [r for r in TX_PERMIT_DATA if r["market"] == market_name]
        if results:
            print(f"  Using session permit data: {market_name} ({len(results)} rows)")
            return results
        else:
            flag(market_name, "Permits", "ALL", "TX market not in session data — scraping live")

    permit_cities = market.get("permit_cities", [])
    if not permit_cities:
        flag(market_name, "Permits", "ALL", "No permit city URLs configured — add to MARKETS registry")
        return []

    results = []
    for city_info in permit_cities:
        city = city_info["city"]
        url  = city_info["url"]

        prompt = f"""You are a construction permit fee researcher for Even/Cornerstone OS.

Fetch and parse the permit fee schedule for {city} from: {url}

Extract ALL residential permit fees into this JSON format:
[
  {{
    "municipality": "{city}",
    "work_type": "work type description",
    "min_fee": 0.00 or null,
    "rate": "rate value or description",
    "method": "per sqft / per fixture / flat fee / tiered on cost / etc",
    "notes": "any important notes or conditions",
    "flag": "" or "reason needs manual verify"
  }}
]

Focus on: New Construction, Residential Remodel/Alteration, Roofing, Electrical,
Plumbing, Mechanical/HVAC, Demolition.
Skip commercial-only or industrial types.
Return ONLY the JSON array."""

        print(f"  Scraping permits: {city}")

        try:
            resp = AI.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=[{"role": "user", "content": prompt}],
            )

            result_text = ""
            for block in resp.content:
                if hasattr(block, "text"):
                    result_text += block.text

            clean = re.sub(r"```json|```", "", result_text).strip()
            city_results = json.loads(clean)

            for r in city_results:
                if r.get("flag"):
                    flag(market_name, "Permits", f"{city} — {r.get('work_type','')}", r["flag"])
                r["market"]  = market_name
                r["zone"]    = market["zone"]
                r["state"]   = state
                r["date"]    = TODAY
                results.append(r)

            time.sleep(1)  # rate limit courtesy

        except Exception as e:
            flag(market_name, "Permits", city,
                 f"Permit scrape failed: {str(e)} — manual entry needed from {url}")

    return results


# ─────────────────────────────────────────────────────────────────────────────
# WRITE TO GOOGLE SHEETS
# ─────────────────────────────────────────────────────────────────────────────

def write_labor(service, market, labor_rows, dry_run=False):
    if not labor_rows:
        return
    rows = []
    for r in labor_rows:
        rows.append([
            market["market"],
            market["zone"],
            r["trade"],
            r.get("low", ""),
            r.get("mid", ""),
            r.get("high", ""),
            r.get("source", "BLS OES"),
            r.get("date", TODAY),
        ])
    if not dry_run:
        append_rows(service, SHEET_ID, TAB_LABOR, rows)
    else:
        print(f"  [DRY RUN] Would write {len(rows)} labor rows for {market['market']}")


def write_materials(service, market, material_rows, dry_run=False):
    if not material_rows:
        return
    rows = []
    for r in material_rows:
        rows.append([
            market["market"],
            market["zone"],
            r.get("category", ""),
            r.get("item", ""),
            r.get("unit", ""),
            r.get("low", ""),
            r.get("mid", ""),
            r.get("high", ""),
            r.get("source", f"Home Depot {market['home_depot_zip']}"),
            r.get("date", TODAY),
        ])
    if not dry_run:
        append_rows(service, SHEET_ID, TAB_MATERIALS, rows)
    else:
        print(f"  [DRY RUN] Would write {len(rows)} material rows for {market['market']}")


def write_permits(service, market, permit_rows, dry_run=False):
    if not permit_rows:
        return
    rows = []
    for r in permit_rows:
        rows.append([
            r.get("market", market["market"]),
            r.get("zone", market["zone"]),
            r.get("municipality", ""),
            r.get("work_type", ""),
            r.get("min_fee", ""),
            r.get("rate", ""),
            r.get("method", ""),
            r.get("notes", ""),
            r.get("date", TODAY),
        ])
    if not dry_run:
        append_rows(service, SHEET_ID, TAB_PERMITS, rows)
    else:
        print(f"  [DRY RUN] Would write {len(rows)} permit rows for {market['market']}")


def write_flags(service, dry_run=False):
    if not FLAGS:
        print("\n✓ No flags — clean sweep.")
        return

    print(f"\n⚑ {len(FLAGS)} items flagged for manual review:")
    flag_rows = [["Market", "Data Type", "Item", "Reason", "Date"]]
    for f in FLAGS:
        flag_rows.append([f["market"], f["type"], f["item"], f["reason"], f["date"]])
        print(f"  - [{f['market']}] {f['type']}: {f['item']} → {f['reason']}")

    # Write flags to a "Review Flags" tab (create it manually in the sheet first)
    if not dry_run:
        try:
            append_rows(service, SHEET_ID, "Review Flags", flag_rows[1:])
        except Exception:
            print("  (Create a 'Review Flags' tab in the sheet to capture these automatically)")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN SWEEP
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Even Data Sheet — full market sweep")
    parser.add_argument("--market",   help="Single market name to process (e.g. 'Dallas')")
    parser.add_argument("--type",     choices=["labor", "materials", "permits", "all"], default="all")
    parser.add_argument("--dry-run",  action="store_true", help="Preview without writing to sheet")
    args = parser.parse_args()

    print("=" * 60)
    print("EVEN DATA SWEEP — Black Lab Holdings / Cornerstone OS")
    print(f"Run date: {TODAY}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE WRITE'}")
    print("=" * 60)

    # Auth
    if not args.dry_run:
        print("\nAuthenticating with Google Sheets...")
        service = get_sheets_service()
        print("✓ Authenticated")
    else:
        service = None

    # Filter markets
    markets_to_run = MARKETS
    if args.market:
        markets_to_run = [m for m in MARKETS if args.market.lower() in m["market"].lower()]
        if not markets_to_run:
            print(f"No market found matching '{args.market}'")
            return

    print(f"\nMarkets to process: {len(markets_to_run)}")
    for m in markets_to_run:
        print(f"  - {m['market']}, {m['state']}")

    # Sweep
    for market in markets_to_run:
        print(f"\n{'─'*50}")
        print(f"Processing: {market['market']}, {market['state']}")
        print(f"{'─'*50}")

        if args.type in ("labor", "all"):
            if market.get("skip_labor"):
                print(f"  ↷ Labor: skipping {market['market']} (already in sheet)")
            else:
                labor = fetch_bls_labor(market)
                write_labor(service, market, labor, dry_run=args.dry_run)

        if args.type in ("materials", "all"):
            if market.get("skip_materials"):
                print(f"  ↷ Materials: skipping {market['market']} (already in sheet)")
            else:
                materials = fetch_materials_ai(market)
                write_materials(service, market, materials, dry_run=args.dry_run)

        if args.type in ("permits", "all"):
            permits = fetch_permits_ai(market)
            write_permits(service, market, permits, dry_run=args.dry_run)

    # Flags summary
    write_flags(service, dry_run=args.dry_run)

    print(f"\n{'='*60}")
    print(f"Sweep complete. {len(markets_to_run)} markets processed.")
    print(f"{len(FLAGS)} items flagged for manual review.")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
