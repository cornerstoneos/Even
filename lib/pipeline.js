// The app's own estimate pipeline, loaded from index.html so the server runs the
// exact code the browser runs: the scope prompt, the estimate prompt, the
// catalog and the pricing engine. Used by the quote-request link (a homeowner's
// job becomes a draft priced like the same job typed in by the contractor).
// Nothing here is a copy: if index.html changes, this changes with it.
const fs = require('fs');
const path = require('path');

function loadPipeline(htmlPath = path.join(__dirname, '..', 'index.html')) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const slice = (a, b) => {
    const s = html.indexOf(a), e = html.indexOf(b, s);
    if (s < 0 || e < 0) throw new Error(`pipeline anchor not found: ${a}`);
    return html.slice(s, e);
  };
  const fnSrc = name => {
    const s = html.indexOf(`function ${name}(`);
    if (s < 0) throw new Error('pipeline: missing function ' + name);
    return html.slice(s, html.indexOf('\n}', s) + 2);
  };
  const src = [
    "const money0=n=>'$'+Math.round(Number(n)||0).toLocaleString('en-US');",
    slice('const MATERIAL_TIER_RANK=', '\n', 0) + '\n',
    slice('const TRADE_MATERIALS={', '\n};') + '\n};',
    fnSrc('scopeMaterialCategories'), fnSrc('materialSourceQuality'),
    fnSrc('categoryInScope'), fnSrc('isEquipmentRental'), fnSrc('inScopeMaterials'), fnSrc('computeConfidenceTier'),
    fnSrc('buildDynamicPricingBlock'),
    slice('const ANCILLARY_RE=', '// Even Suggests tiers'),
    slice('const LABOR_MULT_DEFAULT=', '// ══ END PRICING ENGINE ══'),
    slice('// ══ SHARED PIPELINE ══', '// ══ END SHARED PIPELINE ══')
  ].join('\n');
  return new Function(src + `
;return {scopePromptText,estimatePromptBlocks,pricingBlockFor,hvhzNoteFor,marketAdjFor,buildCatalog,priceScope,
  scopeMaterialCategories,computeConfidenceTier,inScopeMaterials,materialSourceQuality,catalogPromptText,LABOR_MULT_DEFAULT};`)();
}

module.exports = { loadPipeline };
