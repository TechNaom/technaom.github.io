// R10: each section's view comes from one attribute; the section in the middle of the screen wins.
import { test, expect } from "@playwright/test";
import screens from "../screens.json" with { type: "json" };

test.use({ viewport: { width: 1280, height: 800 } });

for (const { route, sections } of screens) {
  test(`${route}: the view follows the section in the middle of the screen`, async ({ page }) => {
    await page.goto(`${route}?u3d=test`);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
    for (const { selector, view } of sections) {
      const count = await page.locator(selector).count();
      expect(count, `${selector} exists on ${route}`).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await page.locator(selector).nth(i).evaluate((el) => {
          const r = el.getBoundingClientRect();
          window.scrollBy(0, r.top + r.height / 2 - innerHeight / 2);
        });
        await expect(html, `${selector} #${i} on ${route}`).toHaveAttribute("data-u3d-view", view);
      }
    }
  });
}
