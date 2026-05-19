'use strict';

/**
 * Artillery JS processor — shared setup hooks for load tests.
 *
 * Module-level variables (_token, _planId) are shared across all VUs in the
 * same Artillery process. The first VU to arrive runs the setup; all others
 * wait on the same promise, so the expensive register/login/plan-generate
 * sequence only executes once regardless of concurrency.
 */

const http = require('http');

const TARGET_HOST = process.env.TARGET_HOST || 'localhost';
const TARGET_PORT = parseInt(process.env.TARGET_PORT || '5000', 10);

// ── Singletons ────────────────────────────────────────────────────────────────
let _token = null;
let _planId = null;
let _setupPromise = null;

// ── HTTP helper ───────────────────────────────────────────────────────────────

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── One-time setup ────────────────────────────────────────────────────────────

async function doSetup() {
  // Register test account — 409 is fine if it already exists
  await post('/api/auth/signup', {
    username: 'artillery_tester',
    email: 'artillery@loadtest.local',
    password: 'Artillery_L0ad_Test!',
  });

  // Login to get JWT
  const login = await post('/api/auth/login', {
    email: 'artillery@loadtest.local',
    password: 'Artillery_L0ad_Test!',
  });

  if (!login.body || !login.body.token) {
    throw new Error(`Login failed (${login.status}): ${JSON.stringify(login.body)}`);
  }
  const token = login.body.token;

  // Generate one plan — rate-limited at 5/min, so only call this once
  const gen = await post('/api/plans/auto-generate', {
    frequency: 3,
    experience: 'intermediate',
    goal: 'build_muscle',
    equipment: 'barbell',
  }, token);

  const planIds = gen.body && gen.body.planIds;
  if (!Array.isArray(planIds) || planIds.length === 0) {
    throw new Error(`Plan generation failed (${gen.status}): ${JSON.stringify(gen.body)}`);
  }

  console.log(`[setup] auth token acquired, plan ID: ${planIds[0]}`);
  return { token, planId: planIds[0] };
}

// ── Exported hooks ────────────────────────────────────────────────────────────

/**
 * beforeScenario hook — injects token + planId into every VU's context.
 * Safe to call concurrently: only the first call triggers setup.
 */
function getSharedState(context, events, done) {
  if (_token && _planId) {
    context.vars.token = _token;
    context.vars.planId = _planId;
    return done();
  }

  if (!_setupPromise) {
    _setupPromise = doSetup().then(({ token, planId }) => {
      _token = token;
      _planId = planId;
    });
  }

  _setupPromise
    .then(() => {
      context.vars.token = _token;
      context.vars.planId = _planId;
      done();
    })
    .catch(done);
}

/**
 * Inline function hook — injects randomised set data before each set log request.
 * Exercise IDs 1–3, 13–14, 27 are the first seeded barbell compound exercises.
 */
function randomSetData(context, events, done) {
  const exerciseIds = [1, 2, 3, 13, 14, 27];
  context.vars.exerciseId = exerciseIds[Math.floor(Math.random() * exerciseIds.length)];
  context.vars.weight = (Math.floor(Math.random() * 20) + 6) * 5; // 30–130 kg, 5 kg steps
  context.vars.reps = Math.floor(Math.random() * 6) + 6;           // 6–11 reps
  done();
}

/**
 * Inline function hook — sets finishedAt to the current UTC ISO string.
 * Required by PUT /api/sessions/:id which expects a `finished_at` field.
 */
function setFinishTime(context, events, done) {
  context.vars.finishedAt = new Date().toISOString();
  done();
}

module.exports = { getSharedState, randomSetData, setFinishTime };
