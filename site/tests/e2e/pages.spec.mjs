import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const screens = read("../screens.json");
const facts = read("../../src/data/facts.json");

for (const { route, heading } of screens) {
  test(`${route} responds 200 and shows its h1`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const expected = heading.replace("{repos}", String(facts.repos.total));
    await expect(page.locator("h1")).toHaveText(expected);
  });
}
