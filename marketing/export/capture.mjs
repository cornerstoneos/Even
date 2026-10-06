import { chromium } from 'playwright';
import fs from 'fs';
const [,, route, outDir, durStr, fpsStr, sampleList, startStr, endStr] = process.argv;
const dur = +durStr, fps = +fpsStr;
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required','--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
await page.addInitScript(() => { delete Element.prototype.animate; });
await page.clock.install({ time: 0 });
await page.goto('http://localhost:4173' + route, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.clock.pauseAt(10000);
await page.clock.runFor(500);
const btn = page.locator('button').first();
if (await btn.count()) { await btn.click(); }
const step = 1000 / fps;
const total = Math.round(dur * fps);
const samples = sampleList ? new Set(sampleList.split(',').map(Number)) : null;
for (let i = 0; i < total; i++) {
  const inRange = (startStr===undefined || (i>=+startStr && i<+endStr));
  if (inRange && (!samples || samples.has(i))) await page.screenshot({ path: `${outDir}/f${String(i).padStart(5,'0')}.jpg`, type: 'jpeg', quality: 95 });
  await page.clock.runFor(step);
  if (endStr!==undefined && i>=+endStr) break;
}
await browser.close();
