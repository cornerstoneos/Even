# Even — session rules

Even is a contractor estimating tool. This repo is public; `data/batches/even_master_batch.json` is the permits/materials/labor master batch (edit in place, keep the existing schema, run `bash tests/run.sh` before pushing, push to `main`).

Contractor leads, supply vendors, the permit-city checklist and the full working rules live in the PRIVATE repo `cornerstoneos/even-data` (never put leads or vendors in this repo).

At the start of every session: attach `cornerstoneos/even-data` (add_repo), read its `CLAUDE.md`, `contractor_leads.json`, `supply_vendors.json`, `permit_cities_checklist.md`, and summarize this repo's master batch (markets, cities, row counts) instead of dumping it. Keep replies to one line of confirmation. Interview the user and get a green light before building; commit and push each batch.
