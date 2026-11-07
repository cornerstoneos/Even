// BLS OEWS wages for the labor rows (10th / median / 90th hourly), fetched from
// a GitHub Actions runner because the chat containers are blocked by BLS.
// Read-only: prints the numbers (and writes bls_oews.json for the run's
// artifact); it changes nothing in the repo or the database.
// Series: OEUM00 + CBSA + 000000 + SOC (6 digits) + datatype (06 10th, 08 median, 10 90th).
// Optional BLS_API_KEY (repo secret) raises the limits; without it BLS allows
// 25 series per request and 25 requests a day per IP.
const fs = require('fs');
const AREAS = { '33100': 'Miami-Fort Lauderdale-West Palm Beach', '45300': 'Tampa-St. Petersburg-Clearwater', '36740': 'Orlando-Kissimmee-Sanford', '27260': 'Jacksonville' };
const SOCS = {
  '471011': 'First-Line Supervisors of Construction Trades and Extraction Workers', '472031': 'Carpenters', '472061': 'Construction Laborers',
  '472051': 'Cement Masons and Concrete Finishers', '472081': 'Drywall and Ceiling Tile Installers', '472111': 'Electricians',
  '472141': 'Painters, Construction and Maintenance', '472161': 'Plasterers and Stucco Masons', '472152': 'Plumbers, Pipefitters, and Steamfitters',
  '472181': 'Roofers', '472211': 'Sheet Metal Workers', '472044': 'Tile and Stone Setters',
  '499021': 'Heating, Air Conditioning, and Refrigeration Mechanics and Installers', '472131': 'Insulation Workers, Floor, Ceiling, and Wall',
  '472121': 'Glaziers', '472073': 'Construction Equipment Operators', '473013': 'Helpers--Electricians',
  '473015': 'Helpers--Pipelayers, Plumbers, Pipefitters, and Steamfitters', '473016': 'Helpers--Roofers', '499071': 'Maintenance and Repair Workers, General',
  '474031': 'Fence Erectors', '373011': 'Landscaping and Groundskeeping Workers',
  '371012': 'First-Line Supervisors of Landscaping, Lawn Service, and Groundskeeping Workers', '373013': 'Tree Trimmers and Pruners'
};
const TYPES = { '06': 'low', '08': 'mid', '10': 'high' };
const areas = (process.env.AREAS || Object.keys(AREAS).join(',')).split(',').map(s => s.trim()).filter(Boolean);
const ids = [];
for (const a of areas) for (const s of Object.keys(SOCS)) for (const t of Object.keys(TYPES)) ids.push(`OEUM00${a}000000${s}${t}`);
const key = process.env.BLS_API_KEY || '';
const per = key ? 50 : 25;
(async () => {
  const out = {}, raw = {};
  for (let i = 0; i < ids.length; i += per) {
    const body = { seriesid: ids.slice(i, i + per), startyear: '2025', endyear: '2025', ...(key ? { registrationkey: key } : {}) };
    const r = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.status !== 'REQUEST_SUCCEEDED') { console.log('BLS refused:', JSON.stringify(j.message)); if (!(j.Results && j.Results.series)) process.exit(1); }
    for (const s of (j.Results && j.Results.series) || []) {
      const d = (s.data || []).find(x => x.year === '2025') || (s.data || [])[0];
      raw[s.seriesID] = d ? { year: d.year, period: d.period, value: d.value, footnotes: d.footnotes } : null;
    }
  }
  for (const a of areas) for (const s of Object.keys(SOCS)) {
    const row = { area: a, areaName: AREAS[a], soc: s, trade: SOCS[s] };
    for (const [t, f] of Object.entries(TYPES)) {
      const d = raw[`OEUM00${a}000000${s}${t}`];
      const v = d && /^[0-9.]+$/.test(d.value) ? +d.value : null;   // '-' or '*' = suppressed
      row[f] = v; if (d && v === null) row[f + 'Raw'] = d.value;
      if (d) row.year = d.year;
    }
    (out[a] = out[a] || []).push(row);
  }
  fs.writeFileSync('bls_oews.json', JSON.stringify(out, null, 2));
  console.log('BLS_OEWS_JSON_BEGIN'); console.log(JSON.stringify(out)); console.log('BLS_OEWS_JSON_END');
  console.log(`series requested ${ids.length}, returned ${Object.keys(raw).length}`);
})().catch(e => { console.error(e); process.exit(1); });
