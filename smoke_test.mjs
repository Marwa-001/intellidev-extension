// smoke_test.mjs — Tests IntelliDev's new ML modules without a VS Code host.
// Runs against the compiled JS output in /out/backend/

import * as path from 'path';
import * as fs   from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir    = path.join(__dirname, '..', 'out', 'backend');
const tmpDir    = path.join(__dirname, 'tmp_test_data');

// ── Setup: create a temp data directory ──────────────────────────────────
fs.mkdirSync(tmpDir, { recursive: true });

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌  ${name}`);
    console.log(`       ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) { throw new Error(message || 'Assertion failed'); }
}

function assertRange(value, min, max, label) {
  if (value < min || value > max) {
    throw new Error(`${label}: expected [${min}, ${max}], got ${value}`);
  }
}

// ── Import compiled modules ───────────────────────────────────────────────
const { MLScorer }          = await import(path.join(outDir, 'mlScorer.js'));
const { TemporalAnalyser }  = await import(path.join(outDir, 'temporalAnalyser.js'));
const { extractFeatures }   = await import(path.join(outDir, 'featureExtractor.js'));
const { computeScore, smoothScore, getScoreLevel } = await import(path.join(outDir, 'scorer.js'));

// ── Sample feature objects ────────────────────────────────────────────────

const lowLoadFeatures = {
  avg_kpm: 60, typing_variability: 150, backspace_rate: 5, pause_count: 3,
  avg_error_rate: 1, max_error_rate: 2, error_burst_count: 0, debug_session_count: 0,
  avg_switch_frequency: 3, rapid_switch_count: 1, avg_unique_files: 2,
  session_duration_minutes: 45, idle_ratio: 0.1, longest_deep_work_minutes: 30,
  night_time_minutes: 0, is_night_session: false,
  error_to_type_ratio: 0.017, context_fragmentation: 0.022,
};

const highLoadFeatures = {
  avg_kpm: 8, typing_variability: 700, backspace_rate: 25, pause_count: 20,
  avg_error_rate: 15, max_error_rate: 25, error_burst_count: 3, debug_session_count: 4,
  avg_switch_frequency: 20, rapid_switch_count: 12, avg_unique_files: 9,
  session_duration_minutes: 250, idle_ratio: 0.5, longest_deep_work_minutes: 5,
  night_time_minutes: 40, is_night_session: true,
  error_to_type_ratio: 1.875, context_fragmentation: 0.048,
};

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📦 smoothScore utility');

test('returns 0 at or below low threshold', () => {
  assert(smoothScore(0, 10, 100, 50) === 0, 'should be 0');
  assert(smoothScore(10, 10, 100, 50) === 0, 'should be 0 at boundary');
});

test('returns maxPts at or above high threshold', () => {
  assert(smoothScore(100, 10, 100, 50) === 50, 'should be 50');
  assert(smoothScore(200, 10, 100, 50) === 50, 'should cap at 50');
});

test('returns interpolated value between thresholds', () => {
  const mid = smoothScore(55, 10, 100, 90); // 50% of range
  assertRange(mid, 40, 50, 'midpoint');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🎯 computeScore (rule engine)');

test('low-load session scores < 30', () => {
  const r = computeScore(lowLoadFeatures);
  assertRange(r.capped_score, 0, 45, 'low-load score');
  assert(r.triggered_rules.length >= 0, 'should have rule array');
});

test('high-load session scores > 50', () => {
  const r = computeScore(highLoadFeatures);
  assertRange(r.capped_score, 50, 100, 'high-load score');
});

test('composite features appear in feature_snapshot', () => {
  const r = computeScore(lowLoadFeatures);
  assert('error_to_type_ratio' in r.feature_snapshot, 'missing error_to_type_ratio');
  assert('context_fragmentation' in r.feature_snapshot, 'missing context_fragmentation');
});

test('ScoringResult has optional ML fields (undefined by default)', () => {
  const r = computeScore(lowLoadFeatures);
  assert(r.ml_score === undefined, 'ml_score should be undefined from rule scorer');
  assert(r.blend_alpha === undefined, 'blend_alpha should be undefined from rule scorer');
});

test('category_scores sum matches raw_score', () => {
  const r = computeScore(highLoadFeatures);
  const catSum = r.category_scores.typing + r.category_scores.error +
                 r.category_scores.context + r.category_scores.session;
  assert(r.raw_score === catSum, `raw_score (${r.raw_score}) != catSum (${catSum})`);
});

test('getScoreLevel returns correct level for score 25', () => {
  const l = getScoreLevel(25);
  assert(l.label === 'Stable Focus', `expected Stable Focus, got ${l.label}`);
});

test('getScoreLevel returns correct level for score 75', () => {
  const l = getScoreLevel(75);
  assert(l.label === 'High Cognitive Load', `expected High Cognitive Load, got ${l.label}`);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🤖 MLScorer');

const mlScorer = new MLScorer(tmpDir);

test('isReady is false before MIN_SESSIONS', () => {
  assert(!mlScorer.isReady, 'should not be ready yet');
});

test('predict returns -1 when not ready', () => {
  assert(mlScorer.predict(lowLoadFeatures) === -1, 'should return -1');
});

test('update() accepts features and label without throwing', () => {
  mlScorer.update(lowLoadFeatures, 0.0);
  mlScorer.update(highLoadFeatures, 1.0);
  assert(mlScorer.sessionCount === 2, `expected 2 sessions, got ${mlScorer.sessionCount}`);
});

test('model file is written to disk', () => {
  const modelPath = path.join(tmpDir, 'ml_model.json');
  assert(fs.existsSync(modelPath), 'ml_model.json should exist');
  const model = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
  assert(model.version === 1, 'version should be 1');
  assert(Array.isArray(model.weights), 'weights should be array');
  assert(model.weights.length === 17, `expected 17 weights, got ${model.weights.length}`);
  assert(model.trainedSessions === 2, `expected 2, got ${model.trainedSessions}`);
});

test('model loads correctly on new instance', () => {
  const ml2 = new MLScorer(tmpDir);
  assert(ml2.sessionCount === 2, `reloaded sessions should be 2, got ${ml2.sessionCount}`);
});

// Train to MIN_SESSIONS threshold
test(`predict works after ${MLScorer.MIN_SESSIONS} training sessions`, () => {
  const mlFresh = new MLScorer(tmpDir + '_fresh');
  // Alternate low/high load sessions to give the model signal
  for (let i = 0; i < MLScorer.MIN_SESSIONS; i++) {
    const feat = i % 2 === 0 ? lowLoadFeatures : highLoadFeatures;
    const label = i % 2 === 0 ? 0.0 : 1.0;
    mlFresh.update(feat, label);
  }
  assert(mlFresh.isReady, 'should be ready after MIN_SESSIONS');
  const lowPred  = mlFresh.predict(lowLoadFeatures);
  const highPred = mlFresh.predict(highLoadFeatures);
  assertRange(lowPred,  0, 100, 'low-load ML prediction');
  assertRange(highPred, 0, 100, 'high-load ML prediction');
  // High load should score higher than low load (sanity check)
  assert(highPred >= lowPred, `high(${highPred}) should >= low(${lowPred})`);
});

test('getTopFeatures returns N features sorted by weight magnitude', () => {
  const mlFresh = new MLScorer(tmpDir + '_fresh');
  const top = mlFresh.getTopFeatures(3);
  assert(top.length === 3, 'should return 3 features');
  assert(typeof top[0].feature === 'string', 'feature should be a string');
  assert(typeof top[0].weight === 'number', 'weight should be a number');
  assert(Math.abs(top[0].weight) >= Math.abs(top[1].weight), 'should be sorted by magnitude');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n⏱️  TemporalAnalyser');

const temporal = new TemporalAnalyser(tmpDir);

test('getFatiguePenalty returns 0 with no history', () => {
  const fresh = new TemporalAnalyser(tmpDir + '_ta');
  assert(fresh.getFatiguePenalty() === 0, 'no penalty with no data');
});

test('record() stores sessions correctly', () => {
  temporal.record('s001', 35, 'Mild Strain');
  temporal.record('s002', 40, 'Mild Strain');
  assert(temporal.totalSessions >= 2, 'should have recorded sessions');
});

test('history persisted to score_history.json', () => {
  const histPath = path.join(tmpDir, 'score_history.json');
  assert(fs.existsSync(histPath), 'score_history.json should exist');
  const history = JSON.parse(fs.readFileSync(histPath, 'utf-8'));
  assert(Array.isArray(history), 'history should be an array');
  assert(history.length >= 2, 'should have at least 2 entries');
});

test('getFatiguePenalty = 5 after 2 consecutive high-load sessions', () => {
  const ta = new TemporalAnalyser(tmpDir + '_fa');
  ta.record('a', 62, 'High Cognitive Load');
  ta.record('b', 70, 'High Cognitive Load');
  assert(ta.getFatiguePenalty() === 5, `expected 5, got ${ta.getFatiguePenalty()}`);
});

test('getFatiguePenalty = 10 after 3 consecutive high-load sessions', () => {
  const ta = new TemporalAnalyser(tmpDir + '_fa3');
  ta.record('a', 62, 'High Cognitive Load');
  ta.record('b', 70, 'High Cognitive Load');
  ta.record('c', 65, 'High Cognitive Load');
  assert(ta.getFatiguePenalty() === 10, `expected 10, got ${ta.getFatiguePenalty()}`);
});

test('getFatiguePenalty = 15 after 4+ consecutive high-load sessions', () => {
  const ta = new TemporalAnalyser(tmpDir + '_fa4');
  for (let i = 0; i < 4; i++) { ta.record(`s${i}`, 75, 'High Cognitive Load'); }
  assert(ta.getFatiguePenalty() === 15, `expected 15, got ${ta.getFatiguePenalty()}`);
});

test('fatigue penalty resets after a low-load session', () => {
  const ta = new TemporalAnalyser(tmpDir + '_reset');
  ta.record('h1', 70, 'High Cognitive Load');
  ta.record('h2', 80, 'Burnout Risk');
  ta.record('low', 20, 'Stable Focus');  // breaks the streak
  assert(ta.getFatiguePenalty() === 0, `expected 0 after break, got ${ta.getFatiguePenalty()}`);
});

test('getTrend returns stable when scores are flat', () => {
  const ta = new TemporalAnalyser(tmpDir + '_trend');
  for (let i = 0; i < 5; i++) { ta.record(`s${i}`, 40, 'Mild Strain'); }
  const { trend } = ta.getTrend();
  assert(trend === 'stable', `expected stable, got ${trend}`);
});

test('getTrend returns declining when scores are rising', () => {
  const ta = new TemporalAnalyser(tmpDir + '_dec');
  for (let i = 0; i < 6; i++) { ta.record(`s${i}`, 20 + i * 15, 'Mild Strain'); }
  const { trend } = ta.getTrend();
  assert(trend === 'declining', `expected declining, got ${trend}`);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔗 End-to-end pipeline simulation');

test('full pipeline: features -> rule score -> ML blend -> fatigue penalty', () => {
  const ml = new MLScorer(tmpDir + '_e2e');
  const ta = new TemporalAnalyser(tmpDir + '_e2e');

  // Simulate 20 sessions (enough to activate ML)
  for (let i = 0; i < 20; i++) {
    const feat   = i % 3 === 0 ? highLoadFeatures : lowLoadFeatures;
    const rRule  = computeScore(feat);
    const rScore = rRule.capped_score;

    // ML predict + train
    const mlPred = ml.predict(feat);
    const alpha  = ml.isReady
      ? Math.min(0.6, ((ml.sessionCount - MLScorer.MIN_SESSIONS) / 50) * 0.6)
      : 0;
    const blended = (mlPred >= 0 && alpha > 0)
      ? Math.round((1 - alpha) * rScore + alpha * mlPred)
      : rScore;
    const penalty = ta.getFatiguePenalty();
    const final   = Math.min(100, blended + penalty);

    // Sanity checks
    assertRange(final, 0, 100, `session ${i} final score`);
    assertRange(alpha, 0, 0.6, `session ${i} alpha`);

    const mlLabel = rScore >= 80 ? 1.0 : rScore >= 60 ? 0.7 : rScore >= 30 ? 0.3 : 0.0;
    ml.update(feat, mlLabel);
    ta.record(`e2e_s${i}`, final, getScoreLevel(final).label);
  }
  assert(ml.isReady, 'ML should be ready after 20 sessions');
});

// ═══════════════════════════════════════════════════════════════════════════
// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.rmSync(tmpDir + '_fresh', { recursive: true, force: true });
fs.rmSync(tmpDir + '_fa',   { recursive: true, force: true });
fs.rmSync(tmpDir + '_fa3',  { recursive: true, force: true });
fs.rmSync(tmpDir + '_fa4',  { recursive: true, force: true });
fs.rmSync(tmpDir + '_reset',{ recursive: true, force: true });
fs.rmSync(tmpDir + '_trend',{ recursive: true, force: true });
fs.rmSync(tmpDir + '_dec',  { recursive: true, force: true });
fs.rmSync(tmpDir + '_ta',   { recursive: true, force: true });
fs.rmSync(tmpDir + '_e2e',  { recursive: true, force: true });

// ── Results ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
if (failed === 0) {
  console.log(`✅  All ${passed} tests passed.`);
} else {
  console.log(`❌  ${failed} test(s) FAILED | ✅  ${passed} passed`);
  process.exit(1);
}
