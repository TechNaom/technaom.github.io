// R9, N5: a deployed copy works. Run against a URL, with no local server:
//   BASE_URL=https://site-3d-lane.manoharpapasani.pages.dev npx playwright test smoke
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const screens = read("../screens.json");
const facts = read("../../src/data/facts.json");

for (const { route, heading } of screens) {
  test(`smoke ${route}: 200, its heading, and the scene comes on`, async ({ page }) => {
    const response = await page.goto(`${route}?u3d=test`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText(heading.replace("{repos}", String(facts.repos.total)));
    await expect(page.locator("html")).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
  });
}
