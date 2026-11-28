// R12: the journey stage plays one post's path as the visitor scrolls.
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test("scrolling through the journey stage moves progress from its start to 1, never back", async ({ page }) => {
  await page.goto("/?u3d=test");
  await expect(page.locator("html")).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
  const stage = page.locator("#journey-stage");
  const { top, height } = await stage.evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, height: el.offsetHeight }));
  const seen = [];
  for (let i = 0; i <= 4; i++) {
    // From the stage's top at the screen's middle to its bottom at the screen's bottom.
    const y = top - 400 + ((height - 400) * i) / 4;
    // Jump (the page scrolls smoothly by default), then wait two frames so the scene has read the new layout.
    const at = await page.evaluate((y) => { scrollTo({ top: y, behavior: "instant" }); return scrollY; }, y);
    await page.waitForFunction((at) => Math.abs(scrollY - at) < 1, at);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(page.locator("html")).toHaveAttribute("data-u3d-view", "journey");
    seen.push(await page.evaluate(() => window.__u3d.progress));
  }
  expect(seen[0]).toBeLessThanOrEqual(0.25);
  expect(seen.at(-1)).toBeCloseTo(1, 1);
  for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
});

test("with the scene off the journey card and its steps are readable", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator('#journey-stage ol.u3d-labels[data-for="journey"] li')).toHaveCount(8);
  await expect(page.locator('#journey-stage li[data-anchor="step:clock"] .lb-name')).toBeVisible();
  await ctx.close();
});
