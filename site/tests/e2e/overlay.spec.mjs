// R12, R13: the stage labels sit on the scene, inside the screen, never on top of each other.
import { test, expect } from "@playwright/test";

const SIZES = [[1280, 800], [390, 844]];
const STAGES = [["#dial-stage", "dial"], ["#journey-stage", "journey"]];

for (const [w, h] of SIZES) {
  for (const [stage, view] of STAGES) {
    test(`${stage} at ${w}x${h}: labels inside the screen, none overlapping`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/?u3d=test");
      await expect(page.locator("html")).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
      await page.locator(stage).evaluate((el) => {
        const r = el.getBoundingClientRect();
        scrollBy({ top: r.top + Math.min(r.height, innerHeight * 1.2) / 2 - innerHeight / 2, behavior: "instant" });
      });
      await expect(page.locator("html")).toHaveAttribute("data-u3d-view", view);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const overlay = page.locator("#u3d-overlay");
      await expect(overlay).toHaveAttribute("aria-hidden", "true");
      const boxes = await overlay.locator(".u3d-label").evaluateAll((els) =>
        els.filter((e) => e.style.visibility !== "hidden").map((e) => e.getBoundingClientRect().toJSON()));
      expect(boxes.length).toBeGreaterThan(2);
      // One assertion each, listing every offender (faster than one expect per box and pair).
      const outside = boxes.filter((b) => b.left < 0 || b.top < 0 || b.right > w || b.bottom > h);
      expect(outside, "labels outside the screen").toEqual([]);
      const pairs = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) pairs.push([i, j]);
        }
      expect(pairs, "overlapping labels").toEqual([]);
      // Labels sit under main (layers: overlay 1, main 2), so none may sit behind the stage's own card.
      const card = await page.locator(`${stage} [data-scene-card]`).first().boundingBox();
      expect(card, "the stage card is marked").not.toBeNull();
      const under = boxes.filter((b) => card && b.left < card.x + card.width && card.x < b.right && b.top < card.y + card.height && card.y < b.bottom);
      expect(under, "labels behind the stage card").toEqual([]);
      // The HTML list is still there for screen readers.
      await expect(page.locator(`${stage} ol.u3d-labels`)).toHaveCount(1);
    });
  }
}

test("on a phone the dial shows team names only, and no hour labels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?u3d=test");
  await expect(page.locator("html")).toHaveAttribute("data-u3d-state", "on", { timeout: 15_000 });
  await page.locator("#dial-stage").evaluate((el) => { const r = el.getBoundingClientRect(); scrollBy({ top: r.top + Math.min(r.height, innerHeight * 1.2) / 2 - innerHeight / 2, behavior: "instant" }); });
  await expect(page.locator("html")).toHaveAttribute("data-u3d-view", "dial");
  await expect(page.locator('#u3d-overlay .u3d-label[data-anchor^="hour:"]')).toHaveCount(0);
  await expect(page.locator("#u3d-overlay .u3d-label .lb-detail")).toHaveCount(0);
});
