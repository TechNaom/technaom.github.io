// R16: dark only for every visitor. The contrast check (axe) runs in no-webgl.spec.mjs, where the
// page is always the static design; here a running scene could sit behind the text.
import { test, expect } from "@playwright/test";
import screens from "../screens.json" with { type: "json" };

for (const { route } of screens) {
  test(`${route} is dark`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
}

// Under u3d-on, --paper and --card turn see-through; no text may vanish with them, and sticky
// bars must keep a backing. The class is added by hand here; T5 and T6 add the real scene.
for (const { route } of screens) {
  test(`${route} keeps every text visible when the scene is on`, async ({ page }) => {
    await page.goto(route);
    // Select a chip on /work so its checked state (ink background, paper text) is on screen.
    const chip = page.locator(".chip input").nth(1);
    if (await chip.count()) await chip.check({ force: true });
    const clear = /rgba\(.*,\s*0\)|transparent/;
    const backed = await page.evaluate((re) => [...document.querySelectorAll(".sticky")].map(
      (el) => !new RegExp(re).test(getComputedStyle(el).backgroundColor)), clear.source);
    await page.evaluate(() => document.documentElement.classList.add("u3d-on"));
    // The scene's token rules must win over the dark theme's (specificity), or nothing turns see-through.
    const token = (name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
    expect(await token("--paper")).toBe("transparent");
    expect(await token("--card")).toBe(await token("--glass"));
    const bad = await page.evaluate(([re, backed]) => {
      const clear = new RegExp(re);
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!own || !el.getClientRects().length) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || el.closest(".sr-only")) continue;
        if (clear.test(cs.color)) out.push(el.tagName + "." + el.className);
      }
      // A sticky bar that had a backing must keep one, or content scrolls visibly under it.
      [...document.querySelectorAll(".sticky")].forEach((el, i) => {
        if (backed[i] && clear.test(getComputedStyle(el).backgroundColor)) out.push("sticky lost its backing: " + el.tagName);
      });
      return out;
    }, [clear.source, backed]);
    expect(bad).toEqual([]);
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
