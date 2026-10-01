# Even — session rules

Even is a contractor estimating tool (even-os.com). This repo is PUBLIC: app at the root (`index.html`, `server.js`, `data-pipeline/`, `tests/`), marketing site in `marketing/`, permits/materials/labor master batch at `data/batches/even_master_batch.json`.

**The master rules, decisions and task lists live in the PRIVATE repo `cornerstoneos/even-data`.** At the start of every session:
1. Attach `cornerstoneos/even-data` (add_repo) and read its `CLAUDE.md` (the CEO master file). It wins over anything here.
2. Know which chat you are: **Even CEO** (planning, decisions, data intake, sales ops), **Even App build** (repo root; work `tasks/app.md` in even-data) or **Even Marketing build** (`marketing/`; work `tasks/marketing.md`).
3. Never put leads, vendors or contact data in this repo.

Short rules (full list in even-data/CLAUDE.md): always push to `main`; run `bash tests/run.sh` before every push; talk it through before building something new; never present a guess as fact; short replies, bulleted steps when the user has to act; after changing the master batch, tell the user to run the Load Market Batch Action.
