import { defineConfig } from "@playwright/test";

const external = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never" }]],
  ...(external
    ? {}
    : {
        // 8799 is the dev server's port; the preview of the built site uses 8798.
        // It serves dist/: run `npx astro build` first (CI's Build step does).
        // 127.0.0.1, not localhost: on Node 22 localhost can resolve to ::1.
        webServer: {
          command: "npx astro preview --host 127.0.0.1 --port 8798",
          port: 8798,
          reuseExistingServer: false,
        },
      }),
  use: { baseURL: process.env.BASE_URL || "http://127.0.0.1:8798" },
  projects: [
    {
      name: "chromium",
      testIgnore: /no-webgl/,
      use: {
        browserName: "chromium",
        launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
      },
    },
    {
      name: "no-webgl",
      testMatch: /no-webgl/,
      use: {
        browserName: "chromium",
        launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] },
      },
    },
  ],
});
