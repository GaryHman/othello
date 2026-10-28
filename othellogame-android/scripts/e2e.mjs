// Headless smoke test (Playwright): layout on 3 phone sizes, board/disc alignment,
// one move vs the AI, no console errors. Usage: npm run build && npm run e2e
import {chromium} from 'playwright';
import {preview} from 'vite';
import {mkdirSync} from 'node:fs';

const server = await preview({preview: {port: 4173, strictPort: true}});
const browser = await chromium.launch();
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

async function run({width, height}, {play, screenshot}) {
  const tag = `${width}x${height}`;
  const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:4173/');
  await page.getByText("Novice Bot 'Scout'").click();
  const canvas = page.locator('canvas').first();
  await canvas.waitFor();
  await page.waitForTimeout(800);

  // --- Layout: HUD, board right under it, analysis panel fills the rest.
  const L = await canvas.evaluate((el) => {
    const c = el.getBoundingClientRect();
    const hud = el.parentElement.previousElementSibling.getBoundingClientRect();
    const panel = document.querySelector('[data-testid="move-analysis"]')?.getBoundingClientRect();
    return {cTop: c.top, cBottom: c.bottom, cW: c.width, hudBottom: hud.bottom, pTop: panel?.top, pBottom: panel?.bottom, vh: innerHeight, vw: innerWidth};
  });
  const gapTop = L.cTop - L.hudBottom, gapMid = L.pTop - L.cBottom, gapBottom = L.vh - L.pBottom;
  console.log(tag, {boardWidth: Math.round(L.cW), gapTop: Math.round(gapTop), gapMid: Math.round(gapMid), gapBottom: Math.round(gapBottom)});
  // Top-right Forfeit/Menu buttons must not cover the HUD's player chips.
  const overlap = await page.evaluate(() => {
    const btn = document.querySelector('[aria-label="Forfeit"]')?.parentElement?.getBoundingClientRect();
    const chips = [...document.querySelectorAll('div')].filter((d) => /^Scout \(600\)/.test(d.innerText?.trim() ?? '') && d.children.length <= 4);
    const chip = chips.at(-1)?.getBoundingClientRect();
    if (!btn || !chip) return null;
    return !(btn.bottom <= chip.top || btn.top >= chip.bottom || btn.right <= chip.left || btn.left >= chip.right);
  });
  check(overlap === false, `${tag}: Forfeit/Menu buttons overlap the HUD (${overlap})`);
  check(gapTop <= 16, `${tag}: gap HUD->board ${gapTop}px`);
  check(L.cW >= L.vw - 24, `${tag}: board not full width (${L.cW}px)`);
  check(L.pTop !== undefined && gapMid <= 16 && gapBottom <= 16, `${tag}: dead space below board (mid ${gapMid}, bottom ${gapBottom})`);

  // --- Alignment: sample pixels at cell centers (mirrors getBoardLayout in App.tsx).
  const cellColor = (r, c) => canvas.evaluate((el, [r, c]) => {
    const ctx = el.getContext('2d');
    const W = el.width, dpr = W / 800; // canvas may be DPR-scaled
    const bx = 40, size = 800 - 80, cell = size / 8;
    const x = Math.round((bx + (c + 0.5) * cell) * dpr), y = Math.round((bx + (r + 0.5) * cell) * dpr);
    const [R, G, B] = ctx.getImageData(x, y, 1, 1).data;
    return (R + G + B) / 3 > 170 ? 'white' : (R + G + B) / 3 < 60 ? 'black' : G > R + 30 ? 'green' : 'other';
  }, [r, c]);
  // Fresh start: d4/e5 white, e4/d5 black, c3 empty felt. (Before any move.)
  if (!play) {
    const got = [await cellColor(3, 3), await cellColor(4, 4), await cellColor(3, 4), await cellColor(4, 3), await cellColor(2, 2)].join(',');
    check(got === 'white,white,black,black,green', `${tag}: disc/cell alignment ${got}`);
  }

  if (play) {
    const pt = await canvas.evaluate((el) => {
      const r = el.getBoundingClientRect(), s = r.width / 800, cell = 720 / 8;
      return {x: r.left + (40 + 3.5 * cell) * s, y: r.top + (40 + 2.5 * cell) * s};
    });
    await page.mouse.click(pt.x, pt.y); // d3
    await page.waitForTimeout(4000);
    const body = await page.locator('body').innerText();
    check(/Ply 2\b/.test(body), `${tag}: player move + AI reply not registered`);
    check(!/spectating/i.test(body), `${tag}: offline player shown as spectator`);
  }
  if (screenshot) {
    mkdirSync('screenshots', {recursive: true});
    await page.screenshot({path: screenshot});
  }
  check(errors.length === 0, `${tag}: console errors: ${errors.join(' | ')}`);
  await page.close();
}

await run({width: 360, height: 800}, {});
await run({width: 393, height: 852}, {});
await run({width: 412, height: 915}, {});
await run({width: 412, height: 915}, {play: true, screenshot: 'screenshots/phone-412x915-match.png'});
await browser.close();
await server.close();
if (failures.length) { console.error('FAIL:\n' + failures.join('\n')); process.exit(1); }
console.log('E2E PASS');
