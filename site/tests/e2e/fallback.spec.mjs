// R14, R17: the page reads without the 3D, and every way the 3D cannot start leaves it intact.
import { test, expect } from "@playwright/test";

const ROUTES = ["/", "/workforce"];
const CHUNK = /\/_astro\/scene[^/]*\.js(\?|$)/;
const state = (page) => page.locator("html");

for (const route of ROUTES) {
  test.describe(route, () => {
    test("JavaScript off: the text is there and the scene never starts", async ({ browser }) => {
      const ctx = await browser.newContext({ javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await expect(state(page)).not.toHaveClass(/u3d-on/);
      await ctx.close();
    });

    test("the scene chunk fails to load: fallback, canvas gone, text visible", async ({ page }) => {
      let asked = 0;
      await page.route(CHUNK, (r) => {
        asked++;
        return r.fulfill({ status: 500, body: "" });
      });
      await page.goto(`${route}?u3d=test`);
      await expect(state(page)).toHaveAttribute("data-u3d-state", "fallback", { timeout: 15000 });
      expect(asked).toBeGreaterThan(0); // the failure came from the chunk, not from an earlier step
      await expect(page.locator("#u3d-canvas")).toHaveCount(0);
      await expect(page.locator("h1")).toBeVisible();
      await expect(state(page)).not.toHaveClass(/u3d-on/);
    });

    test("data saver on: off, and the scene chunk is never requested", async ({ page }) => {
      const asked = [];
      page.on("request", (r) => CHUNK.test(r.url()) && asked.push(r.url()));
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
      });
      await page.goto(route);
      await expect(state(page)).toHaveAttribute("data-u3d-state", "off");
      await page.waitForLoadState("networkidle"); // everything the page will ask for has been asked
      expect(asked).toEqual([]);
      await expect(page.locator("h1")).toBeVisible();
    });

    // The scene coming on, with its data, is scene.spec.mjs. This is the path between: it loads, then fails.
    test("the scene loads but start() throws: fallback, canvas gone, text visible", async ({ page }) => {
      await page.route(CHUNK, (r) => r.fulfill({ contentType: "text/javascript", body: 'export async function start() { throw new Error("start failed on purpose"); }' }));
      await page.goto(`${route}?u3d=test`);
      await expect(state(page)).toHaveAttribute("data-u3d-state", "fallback", { timeout: 15000 });
      await expect(page.locator("#u3d-canvas")).toHaveCount(0);
      await expect(state(page)).not.toHaveClass(/u3d-on/);
      await expect(page.locator("h1")).toBeVisible();
    });
  });
}
