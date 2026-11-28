// R16, R17: run by the "no-webgl" project (Chromium with WebGL turned off). Every page falls back to
// the static dark design, keeps its text, and reads with a contrast of at least 4.5:1.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import screens from "../screens.json" with { type: "json" };

for (const { route } of screens) {
  test(`${route} without WebGL: fallback, text visible, readable contrast`, async ({ page }) => {
    // axe's contrast scan of the long home page took 20-70 s on a laptop running 4 workers.
    test.setTimeout(90_000);
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-u3d-state", "fallback");
    await expect(page.locator("#u3d-canvas")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/u3d-on/);
    await expect(page.locator("h1")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(violations.map((v) => v.nodes.map((n) => n.target.join(" ")).join(", "))).toEqual([]);
  });
}
