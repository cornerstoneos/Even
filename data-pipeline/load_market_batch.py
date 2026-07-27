#!/usr/bin/env python3
"""Load even_master_batch.json into Supabase market_data.

Exists because the batch file is ~2 MB of JSON. Pasting that into the
Supabase SQL editor is fine on a laptop and not really possible on a phone,
so the same upsert runs here instead and gets triggered from Actions.

The write is a partial-column upsert, matching what the generated SQL did: a
column is only sent when this batch actually has data for it, so a market that
arrives with permits only can never blank out materials or labor that were
loaded by an earlier batch. Re-running is safe.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

BATCH = os.path.join(os.path.dirname(__file__), '..', 'data', 'batches', 'even_master_batch.json')

# Rows that carry another city's prices under this city's name. The source
# field says so outright; loading them would manufacture exactly the false
# precision the generic-knowledge fallback exists to prevent.
COPIED_MARKER = 'copied from miami-dade'

# JSONB payload columns. Scalars (market/state/zone) and the two notes columns
# are handled separately since they have different emptiness rules.
LIST_COLUMNS = ('materials', 'labor', 'permits')


def request(method, url, key, body=None, prefer=None):
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    }
    if prefer:
        headers['Prefer'] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode()
        return r.status, (json.loads(raw) if raw.strip() else None)


def existing_columns(base, key):
    """Ask the table what it has, so a missing notes column degrades to a
    warning instead of failing the whole load."""
    try:
        _, rows = request('GET', f'{base}/rest/v1/market_data?select=*&limit=1', key)
    except urllib.error.HTTPError as e:
        sys.exit(f'Could not read market_data: {e.code} {e.read().decode()[:300]}')
    if not rows:
        return None  # empty table tells us nothing; assume the schema is right
    return set(rows[0].keys())


def build_payload(market):
    """One market -> the columns worth writing, plus a line describing it."""
    row = {'market': market['market']}
    for scalar in ('state', 'zone'):
        if market.get(scalar):
            row[scalar] = market[scalar]

    dropped = 0
    for col in LIST_COLUMNS:
        values = market.get(col) or []
        if col == 'materials':
            kept = [r for r in values
                    if COPIED_MARKER not in str(r.get('source', '')).lower()]
            dropped = len(values) - len(kept)
            values = kept
        if values:
            row[col] = values

    # A per-market research note is the interesting one; `source` is plain
    # provenance. Both are optional and neither is a pricing input.
    if market.get('flag'):
        row['research_notes'] = market['flag']
    if market.get('source'):
        row['source_notes'] = market['source']

    counts = ' '.join(f'{c}={len(row.get(c, []))}' for c in LIST_COLUMNS)
    note = f'  [{dropped} copied-from-Miami material rows excluded]' if dropped else ''
    return row, f"{market['market']}, {market.get('state', '?')} — {counts}{note}", dropped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--batch', default=BATCH)
    ap.add_argument('--dry-run', action='store_true',
                    help='print exactly what would be written, touch nothing')
    ap.add_argument('--base-url', default=None, help='override for testing')
    args = ap.parse_args()

    base = (args.base_url or os.environ.get('SUPABASE_URL') or '').rstrip('/')
    key = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or ''
    if not base:
        sys.exit('SUPABASE_URL is not set.')
    if not key and not args.dry_run:
        sys.exit('SUPABASE_SERVICE_KEY is not set.')

    with open(args.batch) as f:
        batch = json.load(f)
    print(f'{len(batch)} markets in {os.path.basename(args.batch)}\n')

    have = existing_columns(base, key) if not args.dry_run else None
    missing = set()

    payloads = []
    total_dropped = 0
    for market in sorted(batch, key=lambda m: m['market']):
        row, line, dropped = build_payload(market)
        total_dropped += dropped
        if have is not None:
            for col in list(row):
                if col not in have:
                    missing.add(col)
                    del row[col]
        payloads.append(row)
        print('  ' + line)

    print(f'\n{total_dropped} material rows excluded in total.')
    if missing:
        print(f'\nWARNING: market_data has no {", ".join(sorted(missing))} column(s), '
              f'so those values were skipped. Everything else still loaded.\n'
              f'To capture them, run this once in the Supabase SQL editor:\n'
              + '\n'.join(f'  ALTER TABLE market_data ADD COLUMN IF NOT EXISTS {c} text;'
                          for c in sorted(missing)))

    if args.dry_run:
        print('\nDRY RUN — nothing was written.')
        return

    # One request per market. PostgREST derives the column list from the union
    # of keys in a payload, so batching markets with different shapes together
    # would null out whatever a given market happened to be missing.
    url = f'{base}/rest/v1/market_data?on_conflict=market'
    print()
    failures = []
    for i, row in enumerate(payloads, 1):
        for attempt in range(4):
            try:
                request('POST', url, key, [row],
                        prefer='resolution=merge-duplicates,return=minimal')
                print(f'  [{i}/{len(payloads)}] {row["market"]} ok')
                break
            except urllib.error.HTTPError as e:
                detail = e.read().decode()[:400]
                if e.code < 500 or attempt == 3:
                    print(f'  [{i}/{len(payloads)}] {row["market"]} FAILED {e.code} {detail}')
                    failures.append(row['market'])
                    break
                time.sleep(2 ** attempt)
            except Exception as e:  # noqa: BLE001 - network flake, worth a retry
                if attempt == 3:
                    print(f'  [{i}/{len(payloads)}] {row["market"]} FAILED {e}')
                    failures.append(row['market'])
                    break
                time.sleep(2 ** attempt)

    print(f'\n{len(payloads) - len(failures)} of {len(payloads)} markets written.')

    # Read the table back so the log shows what actually landed, not what we
    # believe we sent.
    _, rows = request(
        'GET', f'{base}/rest/v1/market_data?select=market,materials,labor,permits&order=market', key)
    print(f'\nmarket_data now holds {len(rows)} markets:')
    print(f'  {"market":<18}{"mat":>6}{"labor":>7}{"permits":>9}')
    for r in rows:
        print(f'  {r["market"]:<18}{len(r.get("materials") or []):>6}'
              f'{len(r.get("labor") or []):>7}{len(r.get("permits") or []):>9}')

    if failures:
        sys.exit(f'\nFailed: {", ".join(failures)}')


if __name__ == '__main__':
    main()
