# Load Tests

Artillery-based load and stress tests for the TrackYourLift backend.

## Requirements

- Node.js (same version as the project)
- Artillery installed as a dev dependency: `npm install` from the project root
- The backend server running locally on port 5000: `npm run server:dev`

## Running the tests

All tests are run via npm scripts defined in `package.json`:

```bash
# Start the server in a separate terminal first
npm run server:dev

# Then in another terminal:
npm run load:baseline        # Public + auth endpoints — warm up here first
npm run load:plan-generate   # Rate-limit verification for plan generation
npm run load:workout         # Concurrent write-heavy workout session flow
npm run load:spike           # Spike traffic: normal → 5× burst → recovery
```

**Important:** Run `load:baseline` or `load:workout` first. Both create the
shared `artillery@loadtest.local` test account that subsequent tests rely on.

## Test files

| File | What it covers | Phases | Threshold |
|------|---------------|--------|-----------|
| `baseline.yml` | GET /health, GET /api/exercises, POST /api/auth/login | warmup → 15 arr/s → ramp-down | p95 < 200 ms, errors < 1% |
| `plan-generate.yml` | POST /api/plans/auto-generate + rate-limit verification | 8 VU burst | 429s are expected (see below) |
| `workout-flow.yml` | Full session: create → 9 sets → finish | warmup → 8 arr/s → ramp-down | p95 < 500 ms, errors < 2% |
| `spike.yml` | Mixed read/write burst (50 arr/s spike) | warmup → normal → spike → recovery | p95 < 1000 ms, errors < 5% |

## helpers.js

Shared JavaScript processor injected into the Artillery VU context:

- **`getSharedState`** (`beforeScenario` hook) — registers the test account,
  logs in, generates one plan. Result is cached in module-level variables and
  shared across all VUs so the rate-limited `auto-generate` endpoint is only
  called once per test run.
- **`randomSetData`** — injects random `exerciseId`, `weight`, `reps` into the
  VU context before each set-log request.
- **`setFinishTime`** — injects `finishedAt` (current UTC ISO string) for the
  finish-session PUT body.

## Rate limit test: expected 429s

`plan-generate.yml` deliberately sends 8 requests from a single IP in 10 s.
The server allows 5 per minute per IP. The first ~5 return 200, the rest return
429. This is the correct behaviour — the test passes when both 200 and 429
appear in the Artillery summary.

To verify the reset: wait 60 s after the test completes and run again —
all 8 should return 200.

## Customising the target

Override the target host/port via environment variables:

```bash
TARGET_HOST=staging.example.com TARGET_PORT=443 npm run load:baseline
```

The `config.target` in each YAML file defaults to `http://localhost:5000`.
For remote targets, edit `config.target` in the relevant YAML file or set
the `ARTILLERY_TARGET` environment variable (Artillery respects this natively).

## Interpreting results

Artillery prints a summary after each run:

```
Summary report @ HH:MM:SS(+0000)
  Scenarios launched:  NNN
  Scenarios completed: NNN
  Requests completed:  NNN
  Mean response/sec:   N.N
  Response time (msec):
    min: N
    max: N
    median: N
    95th: N      ← this must be under the threshold
    99th: N
  Scenario counts:
    ...
  Codes:
    200: NNN
    429: NN      ← expected in plan-generate run
```

A non-zero exit code from Artillery means a threshold was breached. In CI,
`npm run load:workout` failing indicates a regression in write throughput or
latency under concurrent load.
