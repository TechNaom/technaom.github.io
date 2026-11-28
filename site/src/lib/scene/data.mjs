// Scene data, built at build time from teams.json (R9). Plain JavaScript so node:test loads it;
// lib/format.ts re-exports the text rules, so there is one copy of each.

/** "AI news digest" -> "ai-news-digest": the /workforce anchor rule. */
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** "08:00" -> "8:00 AM", "23:30" -> "11:30 PM" */
export const time12 = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** "08:00 IST · Daily" -> "Daily, 8:00 AM IST"; other shifts unchanged */
export const shift = (s) => {
  const m = s.match(/^(\d{2}:\d{2}) IST · (\w+)/);
  return m ? `${m[2]}, ${time12(m[1])} IST` : s;
};

/** "08:00 IST · Daily" -> 8, "23:30 IST · Daily" -> 23.5; no leading time -> null */
export const hourOf = (s) => {
  const m = /^(\d{2}):(\d{2}) IST/.exec(s ?? "");
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
};

/** The JSON the Universe component writes into #u3d-data. */
export const buildSceneData = (teams, journey) => ({
  version: 1,
  seed: 2026,
  teams: teams.map((t) => ({
    id: slug(t.name),
    name: t.name,
    when: shift(t.shift),
    crew: t.crew.length,
    hour: hourOf(t.shift),
  })),
  journey,
});
