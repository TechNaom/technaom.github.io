// R11, R15: idle signals make the network look alive; with reduced motion there is none, and views jump.
import { test, expect } from "@playwright/test";

const toStage = (page) =>
  page.locator("#dial-stage").evaluate((el) => {
    const r = el.getBoundingClientRect();
    scrollBy({ top: r.top + Math.min(r.height, innerHeight) / 2 - innerHeight / 2, behavior: "instant" });
  });

test("debug mode: pulses run, and a view change eases the camera", async ({ page }) => {
  await page.goto("/?u3d=debug");
  await expect(page.locator("html")).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => window.__u3d.pulses), { timeout: 10_000 }).toBeGreaterThan(0);
  // N4: the frame-rate readout, in the probe and on screen.
  await expect.poll(() => page.evaluate(() => window.__u3d.fps), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(page.locator("#u3d-debug")).toContainText("fps");
  await toStage(page);
  await expect(page.locator("html")).toHaveAttribute("data-u3d-view", "dial", { timeout: 10_000 });
  // A move can start and end between two polls on a slow software renderer: count eased moves instead.
  await expect.poll(() => page.evaluate(() => window.__u3d.eased), { timeout: 5_000 }).toBeGreaterThan(0);
});

test("reduced motion: no pulses, and a view change jumps", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/?u3d=debug");
  await expect(page.locator("html")).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
  await page.waitForTimeout(2_000);
  expect(await page.evaluate(() => window.__u3d.pulses)).toBe(0);
  await toStage(page);
  await expect(page.locator("html")).toHaveAttribute("data-u3d-view", "dial");
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  expect(await page.evaluate(() => window.__u3d.moving)).toBe(false);
  expect(await page.evaluate(() => window.__u3d.eased ?? 0)).toBe(0);
  await ctx.close();
});
