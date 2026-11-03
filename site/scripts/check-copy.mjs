// Copy and facts gate: reads every built page the way a visitor sees it and fails the build
// on any style, grammar, spelling or fact problem.
//   node scripts/check-copy.mjs            style + facts + spelling
//   node scripts/check-copy.mjs --grammar  also LanguageTool (en-GB), as CI runs it
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parse } from "node-html-parser";

const facts = JSON.parse(readFileSync("src/data/facts.json", "utf8"));
const DIST = "dist";
const grammar = process.argv.includes("--grammar");
const problems = [];
const report = (page, rule, text) => problems.push(`${page}  [${rule}]  ${text}`);

// Text inside these is code or a file name, not English
const EXEMPT = (el) => {
  for (let n = el; n; n = n.parentNode) {
    const cls = n.getAttribute?.("class") || "";
    if (["code", "pre", "script", "style", "title", "kbd"].includes(n.rawTagName) || /\bmono\b/.test(cls)) return true;
    if (/\bcont\b/.test(cls)) return "cont"; // the second line of a wrapped SVG label
  }
  return false;
};

function visibleText(html) {
  const root = parse(html, { comment: false });
  root.querySelectorAll("script, style, noscript").forEach((n) => n.remove());
  const nodes = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const t = c.rawText.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
        const ex = EXEMPT(c.parentNode);
        if (t && ex === "cont" && nodes.length) nodes[nodes.length - 1] += " " + t;
        else if (t && !ex) nodes.push(t);
      } else if (c.nodeType === 1) walk(c);
    }
  };
  walk(root.querySelector("body") || root);
  return nodes;
}

const BANNED = [/\bworth noting\b/i, /\bleverag(e|ing)\b/i, /\bcutting-edge\b/i, /\bseamless(ly)?\b/i, /\butili[sz]e\b/i, /\bin order to\b/i, /\bgame[- ]chang/i, /\bsynerg/i, /\brevolutioni[sz]/i, /\bdelve\b/i];
const NUMBER_WORDS = { "thirty-six": 36 };

const pages = readdirSync(DIST, { recursive: true }).filter((f) => String(f).endsWith(".html")).map(String);
mkdirSync(".copy", { recursive: true });

for (const file of pages) {
  const page = "/" + file.replace(/\\/g, "/").replace(/(index)?\.html$/, "");
  const nodes = visibleText(readFileSync(join(DIST, file), "utf8"));
  const full = nodes.join("\n");
  writeFileSync(join(".copy", file.replace(/[\\/]/g, "_") + ".txt"), full);

  for (const t of nodes) {
    // Every label and sentence starts with a capital (digits, symbols and arrows are fine)
    const first = t.match(/[A-Za-z]/);
    if (first && first.index === 0 && /[a-z]/.test(t[0]) && !/^(iOS|e\.g\.|vs\b|fallback|one-click|and\b|of\b|in\b|on\b|at\b|to\b|for\b|with\b|by\b|from\b|or\b|the\b|a\b)/.test(t)) {
      report(page, "capital", t);
    }
    // After a middle dot, the next item starts with a capital too
    for (const m of t.matchAll(/·\s+([a-z])/g)) report(page, "capital-after-dot", t);
    if (/\b20\d\d-\d\d-\d\d\b/.test(t)) report(page, "iso-date", t);
    if (/\b\d{2}:\d{2}\s*IST\b|\b(1[3-9]|2[0-3]):\d{2}\b/.test(t)) report(page, "24-hour-time", t);
    if (/ {2,}/.test(t)) report(page, "double-space", t);
    if (/\s[,.;:!?](\s|$)/.test(t)) report(page, "space-before-punctuation", t);
    const dup = t.match(/\b(\w+)\s+\1\b/i);
    if (dup && !/^\d+$/.test(dup[1])) report(page, "repeated-word", t);
    for (const b of BANNED) if (b.test(t)) report(page, "banned-phrase", t);
    if (/\bSept\b/.test(t)) report(page, "month-style", t);
  }

  // Facts: every agent count equals facts.json
  for (const m of full.matchAll(/\b([\d,]+|[Tt]hirty-six)\s+(?:AI\s+)?agents\b/g)) {
    const n = NUMBER_WORDS[m[1].toLowerCase()] ?? Number(m[1].replace(/,/g, ""));
    const allowed = [facts.workforce.agents, ...facts.workforce.goals.map((g) => g.agents)];
    if (!allowed.includes(n)) report(page, "fact-agents", `"${m[0]}" but facts.json says ${facts.workforce.agents}`);
  }
  for (const m of full.matchAll(/\b(\d+)\s+repositories\b/g)) {
    if (Number(m[1]) !== facts.repos.total) report(page, "fact-repos", `"${m[0]}" but facts.json says ${facts.repos.total}`);
  }
  for (const sentence of full.split(/(?<=[.!?])\s+|\n/)) {
    if (/Bluesky, Dev\.to and Facebook\b/.test(sentence) && !/\bX\b/.test(sentence)) {
      report(page, "fact-platforms", `A platform list leaves out X: ${sentence}`);
    }
  }
}

// Spelling (British English, with our own word list)
try {
  execFileSync(process.execPath, ["node_modules/cspell/bin.mjs", "--no-progress", "--no-summary", "--config", "cspell.json", ".copy/*.txt"], { stdio: "pipe" });
} catch (e) {
  for (const line of String(e.stdout).trim().split("\n").filter(Boolean)) report("spelling", "cspell", line.replace(/^.*?\.copy[\\/]/, ""));
}

// Grammar: LanguageTool, British English
if (grammar) {
  const OFF = ["WHITESPACE_RULE", "UPPERCASE_SENTENCE_START", "PUNCTUATION_PARAGRAPH_END", "DASH_RULE", "EN_QUOTES", "COMMA_PARENTHESIS_WHITESPACE", "OXFORD_SPELLING_Z_NOT_S", "MORFOLOGIK_RULE_EN_GB", "EN_UNPAIRED_BRACKETS", "PLUS_MINUS", "CONFUSION_RULE_NEWS_NEW"];
  for (const f of readdirSync(".copy")) {
    // Each text node as its own line; grammar is checked on lines that form sentences
    const text = readFileSync(join(".copy", f), "utf8").split("\n").filter((l) => l.split(" ").length >= 4).join("\n\n");
    const body = new URLSearchParams({ language: "en-GB", text, disabledRules: OFF.join(",") });
    const res = await fetch("https://api.languagetool.org/v2/check", { method: "POST", body });
    if (!res.ok) { report(f, "grammar", `LanguageTool answered ${res.status}`); continue; }
    const { matches } = await res.json();
    for (const m of matches) {
      const ctx = m.context.text.slice(m.context.offset, m.context.offset + m.context.length);
      report(f.replace(/\.txt$/, ""), `grammar:${m.rule.id}`, `"${ctx}": ${m.message} | ${m.context.text.trim()}`);
    }
    await new Promise((r) => setTimeout(r, 3500)); // the free API allows about 20 requests a minute
  }
}

if (problems.length) {
  console.error(`Copy check failed: ${problems.length} problem(s)\n` + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log(`Copy check passed: ${pages.length} page(s), no style, fact, spelling${grammar ? " or grammar" : ""} problems.`);
