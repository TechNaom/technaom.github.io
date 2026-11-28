# Token ledger: the AI builders of the 3D lane

Every agent run (N8), with its result (N10). Tokens are the run's own count as the harness
reports it. Budgets *(proposed)*: S task 60k, M task 150k, all agents together.

| Date | Stage | Task | Role | Model | Tokens | Result |
|---|---|---|---|---|---|---|
| 2026-11-27 | blueprint | - | design cold read | main model | not recorded | 20 gaps, 9 important |
| 2026-11-27 | assemble | M1 cards | card cold read | main model | 104,547 | 12 gaps, 6 important |
| 2026-11-28 | build | T1 (M) | builder, first run | small model | not recorded (stopped by the usage limit) | stopped at step 4 |
| 2026-11-28 | build | T1 (M) | builder, resumed | small model | 73,110 | done with doubts |
| 2026-11-28 | build | T1 (M) | task check | small model | 56,215 | pass, 4 minor deviations |
| 2026-11-28 | build | T1 (M) | code check | small model | 52,946 | 5 fixes in review |

## Per task

| Task | Size | Agent tokens | Budget | First-pass task check | Fixes in review |
|---|---|---|---|---|---|
| T1 | M | 182,271 (+ the stopped first run) | 150k | yes | 5 |

T1 went over budget: the first build was cut off and resumed, and both checks ran in full.
From T2, the lean rules in N8 apply.

## Milestone estimate (N9)

M1, the 6 tasks left (T2 to T7): 3 S tasks at up to 60k = 180k, 3 M tasks at up to 150k = 450k;
about 630k agent tokens *(proposed)*, plus the supervisor's own.
