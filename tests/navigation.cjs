const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const active = () => page.locator('.screen-view.active').evaluateAll(els => els.map(el => el.id));
    assert.deepEqual(await active(), ['view-home']);
    const ids = await page.locator('.screen-view').evaluateAll(els => els.map(el => el.id));
    assert.equal(ids.length, 12);
    const tabs = {'view-home':'tab-home','view-analytics':'tab-history','view-whatif':'tab-history','view-receipt-detail':'tab-history','view-map':'tab-map','view-ai':'tab-ai','view-profile':'tab-profile','view-allergy-mgmt':'tab-profile'};
    for (const id of ids) {
      await page.selectOption('#screenRouter', id);
      assert.deepEqual(await active(), [id]);
      assert.deepEqual(await page.locator('.tab-btn.active').evaluateAll(els => els.map(el => el.id)), tabs[id] ? [tabs[id]] : []);
    }
    const links = await page.locator('[data-screen]').evaluateAll(els => els.map((el, index) => ({index, from: el.closest('.screen-view')?.id || 'view-home', to: el.dataset.screen})));
    for (const link of links) {
      await page.selectOption('#screenRouter', link.from);
      await page.locator('[data-screen]').nth(link.index).click();
      assert.deepEqual(await active(), [link.to]);
      assert.equal(await page.inputValue('#screenRouter'), link.to);
    }
    await page.selectOption('#screenRouter', 'view-home');
    await page.locator('article[data-screen]').first().focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(await active(), ['view-analytics']);
    await page.evaluate(() => {
      const app = new SpotApp(document);
      app.start();
      app.start();
      if (app.router.navigate('unknown') !== false) throw Error('Invalid route accepted');
      if (app.router.currentScreenId !== 'view-home') throw Error('Invalid route changed state');
      const root = document.createElement('div');
      root.innerHTML = '<section id="view-home" class="screen-view"></section><section id="other" class="screen-view"></section><button data-screen="other"></button>';
      const isolated = new SpotApp(root);
      isolated.start();
      isolated.destroy();
      root.querySelector('button').click();
      if (isolated.router.currentScreenId !== 'view-home') throw Error('Listener leaked');
      app.destroy();
    });
    assert.deepEqual(errors, []);
    console.log(`PASS: ${ids.length} screens, ${links.length} navigation links, tab sync, keyboard, invalid routes, cleanup; no JS errors.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
