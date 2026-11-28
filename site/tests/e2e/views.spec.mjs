// R10: each section's view comes from one attribute; the section in the middle of the screen wins.
import { test, expect } from "@playwright/test";
import screens from "../screens.json" with { type: "json" };

test.use({ viewport: { width: 1280, height: 800 } });

for (const { route, sections } of screens) {
  test(`${route}: the view follows the section in the middle of the screen`, async ({ page }) => {
    test.setTimeout(60_000); // home has four stages; CI browsers have no graphics card
    await page.goto(`${route}?u3d=test`);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
    for (const { selector, view } of sections) {
      const count = await page.locator(selector).count();
      expect(count, `${selector} exists on ${route}`).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const reached = await page.locator(selector).nth(i).evaluate((el) => {
          const r = el.getBoundingClientRect();
          window.scrollBy({ top: r.top + r.height / 2 - innerHeight / 2, behavior: "instant" }); // the page scrolls smoothly by default
          const now = el.getBoundingClientRect();
          return Math.abs(now.top + now.height / 2 - innerHeight / 2) < 2;
        });
        if (!reached) {
          // The page ends first (a footer under a long last section): the middle line is in another section.
          test.info().annotations.push({ type: "skipped check", description: `${selector} #${i} cannot reach the middle on ${route}` });
          continue;
        }
        await expect(html, `${selector} #${i} on ${route}`).toHaveAttribute("data-u3d-view", view);
      }
    }
  });
}
