// R9, R14, N3: the neural network starts on every page, after its first frame, with the page's own data.
import { test, expect } from "@playwright/test";
import screens from "../screens.json" with { type: "json" };

for (const { route } of screens) {
  test(`${route}: the scene starts, with the page's data and no console errors`, async ({ page }) => {
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${route}?u3d=test`);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-u3d-state", "on", { timeout: 10_000 });
    await expect(html).toHaveClass(/u3d-on/);
    await expect(html).toHaveAttribute("data-u3d-tier", "full");
    await expect(page.locator("#u3d-canvas")).toBeVisible();
    const data = await page.evaluate(() => window.__u3d?.data);
    const json = JSON.parse(await page.locator("#u3d-data").textContent());
    expect(data).toEqual(json);
    expect(errors).toEqual([]);
  });
}
