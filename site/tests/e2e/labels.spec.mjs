// R12, R13: the dial stage's labels live in the page's HTML (read by the copy gate and screen readers).
import { test, expect } from "@playwright/test";
import teams from "../../src/data/teams.json" with { type: "json" };
import { shift, slug } from "../../src/lib/scene/data.mjs";

// The first team with a daily time, from the data (no names typed into the test).
const daily = teams.find((t) => /^\d{2}:\d{2} IST/.test(t.shift));
const anchor = `team:${slug(daily.name)}`;

const HOURS = ["Midnight", "6 AM", "Noon", "6 PM"];

test("the dial list holds every team and the four hours, with the team's schedule", async ({ page }) => {
  await page.goto("/");
  const list = page.locator('#dial-stage ol.u3d-labels[data-for="dial"]');
  await expect(list).toHaveCount(1);
  const names = await list.locator("li .lb-name").allTextContents();
  for (const t of teams) expect(names).toContain(t.name);
  for (const h of HOURS) expect(names).toContain(h);
  expect(names.length).toBe(teams.length + HOURS.length);
  await expect(list.locator(`li[data-anchor="${anchor}"] .lb-detail`)).toHaveText(shift(daily.shift));
  await expect(list.locator('li[data-anchor="hour:0"] .lb-detail')).toHaveCount(0);
});

test("with JavaScript off the labels are visible", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator(`#dial-stage li[data-anchor="${anchor}"] .lb-name`)).toBeVisible();
  await ctx.close();
});

test("with the scene on, the list is hidden visually but stays in the accessibility tree", async ({ page }) => {
  await page.goto("/?u3d=test");
  await expect(page.locator("html")).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
  const list = page.locator("#dial-stage ol.u3d-labels");
  const box = await list.boundingBox();
  expect(box === null || box.width <= 1 || box.height <= 1).toBe(true);
  await expect(page.getByRole("list", { name: "Teams on a 24-hour clock" })).toHaveCount(1);
});
