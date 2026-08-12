// smoke_test.cjs — Tests IntelliDev ML modules (CommonJS, no VS Code host)
// Runs against compiled JS output in /out/backend/

const path = require('path');
const fs   = require('fs');

const outDir = path.join(__dirname, 'out', 'backend');
const tmpDir = path.join(__dirname, '_smoke_tmp');

// ── Setup ─────────────────────────────────────────────────────────────────
fs.mkdirSync(tmpDir, { recursive: true });

const { MLScorer }         = require(path.join(outDir, 'mlScorer.js'));
const { TemporalAnalyser } = require(path.join(outDir, 'temporalAnalyser.js'));
const { computeScore, smoothScore, getScoreLevel } = require(path.join(outDir, 'scorer.js'));

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  OK  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertRange(v, lo, hi, lbl) {
  if (v < lo || v > hi) throw new Error(`${lbl}: expected [${lo},${hi}], got ${v}`);
}

// ── Feature fixtures ──────────────────────────────────────────────────────

const LOW = {
  avg_kpm: 60, typing_variability: 150, backspace_rate: 5, pause_count: 3,
  avg_error_rate: 1, max_error_rate: 2, error_burst_count: 0, debug_session_count: 0,
  avg_switch_frequency: 3, rapid_switch_count: 1, avg_unique_files: 2,
  session_duration_minutes: 45, idle_ratio: 0.1, longest_deep_work_minutes: 30,
  night_time_minutes: 0, is_night_session: false,
  error_to_type_ratio: 0.017, context_fragmentation: 0.022,
};

const HIGH = {
  avg_kpm: 8, typing_variability: 700, backspace_rate: 25, pause_count: 20,
  avg_error_rate: 15, max_error_rate: 25, error_burst_count: 3, debug_session_count: 4,
  avg_switch_frequency: 20, rapid_switch_count: 12, avg_unique_files: 9,
  session_duration_minutes: 250, idle_ratio: 0.5, longest_deep_work_minutes: 5,
  night_time_minutes: 40, is_night_session: true,
  error_to_type_ratio: 1.875, context_fragmentation: 0.048,
};

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[1] smoothScore utility');

test('returns 0 at or below low threshold', () => {
  assert(smoothScore(0,   10, 100, 50) === 0);
  assert(smoothScore(10,  10, 100, 50) === 0);
});
test('returns maxPts at or above high threshold', () => {
  assert(smoothScore(100, 10, 100, 50) === 50);
  assert(smoothScore(200, 10, 100, 50) === 50);
});
test('returns interpolated value between thresholds', () => {
  const mid = smoothScore(55, 10, 100, 90);
  assertRange(mid, 40, 55, 'midpoint');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[2] computeScore — rule engine');

test('low-load session scores in sensible range', () => {
  const r = computeScore(LOW);
  assertRange(r.capped_score, 0, 60, 'low-load capped_score');
  assert(typeof r.raw_score === 'number');
});
test('high-load session scores > low-load', () => {
  const lo = computeScore(LOW).capped_score;
  const hi = computeScore(HIGH).capped_score;
  assert(hi > lo, `high(${hi}) should be > low(${lo})`);
});
test('category_scores sum equals raw_score', () => {
  const r = computeScore(HIGH);
  const sum = r.category_scores.typing + r.category_scores.error +
              r.category_scores.context + r.category_scores.session;
  assert(r.raw_score === sum, `raw ${r.raw_score} != sum ${sum}`);
});
test('composite features in feature_snapshot', () => {
  const r = computeScore(LOW);
  assert('error_to_type_ratio'   in r.feature_snapshot, 'missing error_to_type_ratio');
  assert('context_fragmentation' in r.feature_snapshot, 'missing context_fragmentation');
});
test('ML fields are undefined from pure rule scorer', () => {
  const r = computeScore(LOW);
  assert(r.ml_score === undefined);
  assert(r.blend_alpha === undefined);
  assert(r.fatigue_penalty === undefined);
});
test('getScoreLevel — score 15 is Stable Focus', () => {
  assert(getScoreLevel(15).label === 'Stable Focus');
});
test('getScoreLevel — score 45 is Mild Strain', () => {
  assert(getScoreLevel(45).label === 'Mild Strain');
});
test('getScoreLevel — score 70 is High Cognitive Load', () => {
  assert(getScoreLevel(70).label === 'High Cognitive Load');
});
test('getScoreLevel — score 90 is Burnout Risk', () => {
  assert(getScoreLevel(90).label === 'Burnout Risk');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[3] MLScorer');

const ml = new MLScorer(tmpDir);

test('isReady = false before MIN_SESSIONS', () => { assert(!ml.isReady); });
test('predict returns -1 when not ready',   () => { assert(ml.predict(LOW) === -1); });

test('update() trains without throwing', () => {
  ml.update(LOW,  0.0);
  ml.update(HIGH, 1.0);
  assert(ml.sessionCount === 2, `expected 2, got ${ml.sessionCount}`);
});

test('model file written to disk', () => {
  const f = path.join(tmpDir, 'ml_model.json');
  assert(fs.existsSync(f), 'ml_model.json missing');
  const m = JSON.parse(fs.readFileSync(f, 'utf-8'));
  assert(m.version === 1);
  assert(m.weights.length === 17, `expected 17 weights, got ${m.weights.length}`);
  assert(m.trainedSessions === 2);
});

test('model reloads correctly', () => {
  const ml2 = new MLScorer(tmpDir);
  assert(ml2.sessionCount === 2, `expected 2, got ${ml2.sessionCount}`);
});

test(`predict works after MIN_SESSIONS (${MLScorer.MIN_SESSIONS}) training sessions`, () => {
  const dir = path.join(tmpDir, 'ml_ready');
  fs.mkdirSync(dir, { recursive: true });
  const mlR = new MLScorer(dir);
  for (let i = 0; i < MLScorer.MIN_SESSIONS; i++) {
    mlR.update(i % 2 === 0 ? LOW : HIGH, i % 2 === 0 ? 0.0 : 1.0);
  }
  assert(mlR.isReady, 'should be ready');
  const lo = mlR.predict(LOW);
  const hi = mlR.predict(HIGH);
  assertRange(lo, 0, 100, 'low ML pred');
  assertRange(hi, 0, 100, 'high ML pred');
  assert(hi >= lo, `high(${hi}) should >= low(${lo})`);
});

test('getTopFeatures returns sorted list', () => {
  const dir = path.join(tmpDir, 'ml_ready');
  const mlR = new MLScorer(dir);
  const top = mlR.getTopFeatures(3);
  assert(top.length === 3);
  assert(Math.abs(top[0].weight) >= Math.abs(top[1].weight), 'not sorted by magnitude');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[4] TemporalAnalyser');

function newTA(suffix) {
  const d = path.join(tmpDir, 'ta_' + suffix);
  fs.mkdirSync(d, { recursive: true });
  return new TemporalAnalyser(d);
}

test('penalty = 0 with no history', () => { assert(newTA('e').getFatiguePenalty() === 0); });

test('record() + persistence', () => {
  const ta = newTA('rec');
  ta.record('s1', 35, 'Mild Strain');
  ta.record('s2', 40, 'Mild Strain');
  const f = path.join(tmpDir, 'ta_rec', 'score_history.json');
  assert(fs.existsSync(f));
  const arr = JSON.parse(fs.readFileSync(f, 'utf-8'));
  assert(arr.length === 2, `expected 2, got ${arr.length}`);
});

test('penalty = 5 after 2 consecutive high-load', () => {
  const ta = newTA('p2');
  ta.record('a', 62, 'High Cognitive Load');
  ta.record('b', 70, 'High Cognitive Load');
  assert(ta.getFatiguePenalty() === 5, `got ${ta.getFatiguePenalty()}`);
});

test('penalty = 10 after 3 consecutive high-load', () => {
  const ta = newTA('p3');
  ta.record('a', 62, 'High Cognitive Load');
  ta.record('b', 70, 'High Cognitive Load');
  ta.record('c', 65, 'High Cognitive Load');
  assert(ta.getFatiguePenalty() === 10, `got ${ta.getFatiguePenalty()}`);
});

test('penalty = 15 after 4+ consecutive high-load', () => {
  const ta = newTA('p4');
  for (let i = 0; i < 4; i++) ta.record(`s${i}`, 75, 'High Cognitive Load');
  assert(ta.getFatiguePenalty() === 15, `got ${ta.getFatiguePenalty()}`);
});

test('penalty resets to 0 after a low-load session breaks the streak', () => {
  const ta = newTA('rst');
  ta.record('h1', 70, 'High Cognitive Load');
  ta.record('h2', 80, 'Burnout Risk');
  ta.record('low', 18, 'Stable Focus');
  assert(ta.getFatiguePenalty() === 0, `got ${ta.getFatiguePenalty()}`);
});

test('getTrend = stable when scores are flat', () => {
  const ta = newTA('flat');
  for (let i = 0; i < 5; i++) ta.record(`s${i}`, 40, 'Mild Strain');
  assert(ta.getTrend().trend === 'stable', `got ${ta.getTrend().trend}`);
});

test('getTrend = declining when scores are rising', () => {
  const ta = newTA('dec');
  for (let i = 0; i < 6; i++) ta.record(`s${i}`, 20 + i * 14, 'X');
  assert(ta.getTrend().trend === 'declining', `got ${ta.getTrend().trend}`);
});

test('getTrend = improving when scores are falling', () => {
  const ta = newTA('imp');
  for (let i = 0; i < 6; i++) ta.record(`s${i}`, 80 - i * 12, 'X');
  assert(ta.getTrend().trend === 'improving', `got ${ta.getTrend().trend}`);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[5] End-to-end pipeline simulation (20 sessions)');

test('full pipeline produces valid 0-100 scores throughout', () => {
  const dir = path.join(tmpDir, 'e2e');
  fs.mkdirSync(dir, { recursive: true });
  const mlE = new MLScorer(dir);
  const taE = new TemporalAnalyser(dir);

  for (let i = 0; i < 20; i++) {
    const feat   = i % 3 === 0 ? HIGH : LOW;
    const rScore = computeScore(feat).capped_score;

    const mlPred = mlE.predict(feat);
    const alpha  = mlE.isReady
      ? Math.min(0.6, ((mlE.sessionCount - MLScorer.MIN_SESSIONS) / 50) * 0.6)
      : 0;
    const blended = mlPred >= 0 && alpha > 0
      ? Math.round((1 - alpha) * rScore + alpha * mlPred)
      : rScore;
    const penalty = taE.getFatiguePenalty();
    const final   = Math.min(100, blended + penalty);

    assertRange(final, 0, 100, `session ${i}`);
    assertRange(alpha, 0, 0.6,  `alpha @ session ${i}`);

    const label = rScore >= 80 ? 1.0 : rScore >= 60 ? 0.7 : rScore >= 30 ? 0.3 : 0.0;
    mlE.update(feat, label);
    taE.record(`s${i}`, final, getScoreLevel(final).label);
  }
  assert(mlE.isReady, 'ML should be ready after 20 sessions');
  assert(taE.totalSessions === 20, `expected 20, got ${taE.totalSessions}`);
});

// ── Cleanup ───────────────────────────────────────────────────────────────
fs.rmSync(tmpDir, { recursive: true, force: true });

// ── Results ───────────────────────────────────────────────────────────────
console.log('\n' + '-'.repeat(55));
if (failed === 0) {
  console.log(`ALL ${passed} TESTS PASSED`);
} else {
  console.log(`${failed} FAILED  |  ${passed} PASSED`);
  process.exit(1);
}
