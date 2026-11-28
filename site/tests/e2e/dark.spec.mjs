// R16: dark only for every visitor, with readable contrast. JavaScript stays on (axe runs as a
// page script); no scene exists before T5, which moves the contrast check to the no-webgl project.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import screens from "../screens.json" with { type: "json" };

for (const { route } of screens) {
  test(`${route} is dark with readable contrast`, async ({ page }) => {
    // axe's contrast scan of the long home page took 20-70 s on a laptop running 4 workers.
    test.setTimeout(90_000);
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(violations.map((v) => v.nodes.map((n) => n.target.join(" ")).join(", "))).toEqual([]);
  });
}

test.describe("a visitor whose device asks for light", () => {
  test.use({ colorScheme: "light" });
  test("still gets the dark tokens", async ({ page }) => {
    await page.goto("/");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(15, 24, 40)"); // --paper in the dark tokens, #0f1828
  });
});
