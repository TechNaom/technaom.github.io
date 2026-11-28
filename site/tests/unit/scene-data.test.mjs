import { test } from "node:test";
import assert from "node:assert/strict";
import teams from "../../src/data/teams.json" with { type: "json" };
import journey from "../../src/data/journey.json" with { type: "json" };
import facts from "../../src/data/facts.json" with { type: "json" };
import { buildSceneData, slug, hourOf, shift, time12 } from "../../src/lib/scene/data.mjs";

const data = buildSceneData(teams, journey);
const crewSum = data.teams.reduce((n, t) => n + t.crew, 0);

test("scene data equals teams.json, and teams.json equals facts.json (no typed counts)", () => {
  assert.equal(data.version, 1);
  assert.equal(data.seed, 2026);
  assert.equal(data.teams.length, teams.length);
  assert.equal(crewSum, teams.reduce((n, t) => n + t.crew.length, 0));
  assert.equal(data.teams.length, facts.workforce.teams);
  assert.equal(crewSum, facts.workforce.agents);
});

test("hours: decimal for daily teams, null for the rest", () => {
  const by = Object.fromEntries(data.teams.map((t) => [t.name, t]));
  assert.equal(by["Leadership"].hour, 8);
  assert.equal(by["Tech learning"].hour, 23.5);
  assert.equal(by["Brand analytics"].hour, null);
  assert.equal(hourOf("08:00 IST · Daily"), 8);
  assert.equal(hourOf("Sundays"), null);
  assert.equal(hourOf(""), null);
});

test("when is the 12-hour text the home page shows; no 24-hour times anywhere", () => {
  const by = Object.fromEntries(data.teams.map((t) => [t.name, t]));
  assert.equal(by["Leadership"].when, "Daily, 8:00 AM IST");
  assert.equal(by["Brand analytics"].when, "Mondays and Thursdays");
  assert.equal(time12("23:30"), "11:30 PM");
  assert.equal(time12("00:15"), "12:15 AM");
  assert.equal(time12("12:00"), "12:00 PM");
  for (const t of data.teams) assert.doesNotMatch(t.when, /\b([01]\d|2[0-3]):[0-5]\d\b(?! ?[AP]M)/);
  assert.equal(shift("Sundays"), "Sundays");
});

test("ids are the slugs the /workforce anchors use, and unique", () => {
  for (const t of data.teams) assert.equal(t.id, slug(t.name));
  assert.equal(new Set(data.teams.map((t) => t.id)).size, data.teams.length);
  assert.equal(slug("AI news digest"), "ai-news-digest");
});

test("journey: 8 steps in order, steps then platforms", () => {
  assert.deepEqual(data.journey.map((s) => s.id), ["clock", "team", "critic", "linkedin", "x", "bluesky", "facebook", "devto"]);
  assert.deepEqual(data.journey.map((s) => s.kind), ["step", "step", "step", "step", "platform", "platform", "platform", "platform"]);
  assert.equal(data.journey[2].detail, "Four judges");
});
