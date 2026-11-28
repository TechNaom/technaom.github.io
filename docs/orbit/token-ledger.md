# Token ledger: the AI builders of the 3D lane

Measured by `token_meter.py` (Idea to Orbit 0.10) from this session's Claude Code logs on
2026-11-28, subagents included. It replaces the hand-copied numbers, which were the harness's own
per-agent figures and left out the main session. **Budgets count fresh tokens** (input, output,
cache writes); cache reads re-read the conversation at a far lower price and are shown apart.

## What the numbers say

- 96% of all tokens were cache reads. Fresh tokens: about 2.0M.
- The **main session (the supervisor) used 75% of the fresh tokens**, more than all subagents
  together. A solo build moves cost to the supervisor; it is not free. The biggest saving is a leaner
  main session: shorter replies, fewer re-reads of large files, compacting earlier.
- Per task (agent fresh tokens): T1 178k (full loop, 19% over its 150k budget); T2 and T3 17k each
  (lean, one shared check); T4 105k (two checks). Supervisor tokens are not yet split by task.

## Report

Agents: 10. Tokens: 48,819,141 (input 664, output 334,375, cache write 1,711,530, cache read 46,772,572).
Fresh tokens (input, output and cache writes): 2,046,569. Served from the prompt cache: 46,772,572 (96% of all; budgets count fresh tokens).
Cost: tokens only (no prices file given).

| Agent | Role | Tasks | Model | Fresh tokens | All tokens |
|---|---|---|---|---|---|
| main | supervisor | - | claude-opus-5-5 | 1,535,486 | 45,345,952 |
| a43d1c6dc0e2c78a8 | builder | T1 | claude-sonnet-5-5 | 115,246 | 1,687,959 |
| a950b4dffd267f397 | check | - | claude-opus-5-5 | 90,486 | 452,581 |
| aaef36d120f2150d4 | check | - | claude-opus-5-5 | 65,035 | 385,660 |
| aebf962d6bd68b33e | check | T4 | claude-sonnet-5-5 | 54,946 | 245,513 |
| a0c5d715eacde0051 | check | T4 | claude-sonnet-5-5 | 49,847 | 91,980 |
| a6dc79730143f87db | other | - | claude-haiku-5-5 | 39,101 | 57,538 |
| af0bf035e4a3def10 | check | T1 | claude-sonnet-5-5 | 33,776 | 206,265 |
| af7bca2653a27b20c | check | T2, T3 | claude-sonnet-5-5 | 33,330 | 153,804 |
| a1f8e372a49bdec40 | check | T1 | claude-sonnet-5-5 | 29,316 | 191,889 |

| Task | Agent fresh tokens | Budget | Saved vs full loop |
|---|---|---|---|
| T1 | 178,338 | over: 119% of 150,000 | - |
| T2 | 16,665 | ok | - |
| T3 | 16,665 | ok | - |
| T4 | 104,793 | ok | - |
## Budgets *(proposed)*

S task 60k, M task 150k agent fresh tokens. Next: split the supervisor's tokens by task (by time
window between task commits), so solo builds show their full cost.
