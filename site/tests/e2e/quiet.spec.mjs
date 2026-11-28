// R18: dense content gets a quiet view, so the 3D never competes with reading.
import { test, expect } from "@playwright/test";
import screens from "../screens.json" with { type: "json" };

const VIEW_OPACITY = { network: 1, dial: 1, journey: 1, drift: 0.7 }; // views.mjs
const QUIET = 0.4;

const toMiddle = (page, selector, i = 0) =>
  page.locator(selector).nth(i).evaluate((el) => {
    const r = el.getBoundingClientRect();
    scrollBy({ top: r.top + Math.min(r.height, innerHeight) / 2 - innerHeight / 2, behavior: "instant" });
  });
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

for (const { route, sections } of screens) {
  const quiet = sections.filter((s) => s.quiet);
  if (!quiet.length) continue;
  test(`${route}: quiet sections dim the scene to ${QUIET} of their view`, async ({ page }) => {
    await page.goto(`${route}?u3d=test`);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
    for (const s of quiet) {
      const count = await page.locator(s.selector).count();
      expect(count, `${s.selector} exists`).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) { // every match (five .arch sections on /architecture)
        await toMiddle(page, s.selector, i);
        await settle(page);
        await expect(html, `${s.selector} #${i}`).toHaveAttribute("data-u3d-quiet", "");
        const probe = await page.evaluate(() => ({ quiet: window.__u3d.quiet, opacity: window.__u3d.opacity }));
        expect(probe.quiet).toBe(true);
        expect(probe.opacity).toBeCloseTo(VIEW_OPACITY[s.view] * QUIET, 5);
      }
    }
    await toMiddle(page, sections[0].selector); // the page hero: not quiet
    await settle(page);
    await expect(html).not.toHaveAttribute("data-u3d-quiet", "");
    expect(await page.evaluate(() => window.__u3d.opacity)).toBeCloseTo(1, 5);
  });
}
