import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Candle } from "../shared/cryptoTypes";
import type { BacktestStrategy } from "./backtest";
import {
  calcAdxArr,
  calcAtrArr,
  calcBollingerArr,
  calcCVD,
  calcEmaArr,
  calcMacdArr,
  calcRsiArr,
  calcSma,
  calcVwap,
  detectBosChoch,
  detectFvgZones,
  detectOrderBlocks,
} from "./utils/indicators";

export type EntryLabel = "win" | "loss" | "timeout";
export type EntryDirection = "long" | "short";
export type EntryVerdict = "進場" | "小倉" | "等待" | "禁止";
export type EntryLabelMode = "conservative" | "optimistic" | "ohlc_path";
export type EntryMarketRegime = "trend" | "range" | "high_volatility" | "low_volatility";
export type EntryTrainingQuality = "strong" | "usable" | "weak" | "insufficient";
export type EntryValidationVerdict = "robust" | "acceptable" | "fragile" | "unverified";
export type EntryStrategyRecommendation = "優先" | "可觀察" | "保守" | "避免";


export interface EntryTrainerOptions {
  symbol: string;
  timeframe: string;
  strategy: BacktestStrategy;
  atrSlMult?: number;
  atrTpMult?: number;
  lookforward?: number;
  minSamples?: number;
  labelMode?: EntryLabelMode;
}

export interface EntryFeatures {
  rsi: number;
  macd_hist_norm: number;
  macd_slope_norm: number;
  ema20_50_gap: number;
  ema50_200_gap: number;
  price_ema20_gap: number;
  atr_pct: number;
  adx_norm: number;
  bb_percent_b: number;
  bb_bandwidth: number;
  volume_ratio: number;
  cvd_slope: number;
  body_pct: number;
  upper_wick_pct: number;
  lower_wick_pct: number;
  range_pct: number;
  vwap_gap: number;
  fvg_nearby: number;
  ob_nearby: number;
  bos_choch_bias: number;
  setup_quality: number;
}

export interface EntrySample {
  time: number;
  strategy: BacktestStrategy;
  direction: EntryDirection;
  entry: number;
  sl: number;
  tp: number;
  exitTime: number;
  exitPrice: number;
  label: EntryLabel;
  barsHeld: number;
  rMultiple: number;
  features: EntryFeatures;
  signalReason: string;
}

export interface EntryFeatureImportance {
  name: keyof EntryFeatures;
  weight: number;
  outcomeCorrelation: number;
  rCorrelation: number;
}

export interface EntryScoreThresholds {
  enter: number;
  small: number;
  wait: number;
}

export interface EntryRegimeStats {
  regime: EntryMarketRegime;
  sampleCount: number;
  winRate: number;
  avgRMultiple: number;
}

export interface EntryTrainingDiagnostics {
  quality: EntryTrainingQuality;
  resolvedRatio: number;
  featureSeparation: number;
  featureConcentration: number;
  notes: string[];
}

export interface EntryValidationStats {
  trainSampleCount: number;
  testSampleCount: number;
  predictedTradeCount: number;
  oosWinRate: number;
  oosAvgRMultiple: number;
  coverage: number;
  edgeScore: number;
  overfitRisk: number;
  verdict: EntryValidationVerdict;
  notes: string[];
}

export interface EntryStrategyReliability {
  rank: number;
  strategy: BacktestStrategy;
  sampleCount: number;
  winRate: number;
  avgRMultiple: number;
  currentRegime: EntryMarketRegime | null;
  regimeSampleCount: number;
  regimeWinRate: number | null;
  regimeAvgRMultiple: number | null;
  trainingQuality: EntryTrainingQuality;
  validation: EntryValidationStats;
  reliabilityScore: number;
  recommendation: EntryStrategyRecommendation;
  notes: string[];
}

export interface EntryTrainerMetadata {
  version: "v6.4-entry-trainer";
  symbol: string;
  timeframe: string;
  strategy: BacktestStrategy;
  generatedAt: string;
  dataStartTime: number | null;
  dataEndTime: number | null;
  candleCount: number;
  sampleCount: number;
  winCount: number;
  lossCount: number;
  timeoutCount: number;
  winRate: number;
  avgRMultiple: number;
  atrSlMult: number;
  atrTpMult: number;
  lookforward: number;
  labelMode: EntryLabelMode;
  featureNames: Array<keyof EntryFeatures>;
  featureImportance?: EntryFeatureImportance[];
  featureWeights?: Partial<Record<keyof EntryFeatures, number>>;
  scoreThresholds?: EntryScoreThresholds;
  regimeStats?: EntryRegimeStats[];
  trainingDiagnostics?: EntryTrainingDiagnostics;
  validationStats?: EntryValidationStats;
}

export interface EntryTrainerModel {
  metadata: EntryTrainerMetadata;
  samples: EntrySample[];
}

export interface EntryScoreResult {
  symbol: string;
  timeframe: string;
  strategy: BacktestStrategy;
  score: number;
  verdict: EntryVerdict;
  direction: EntryDirection | "none";
  winRate: number;
  sampleCount: number;
  confidence: number;
  entry: number | null;
  sl: number | null;
  tp: number | null;
  rr: number | null;
  labelMode: EntryLabelMode;
  localWinRate: number;
  weightedR: number;
  diagnostics: string[];
  labelStats: { win: number; loss: number; timeout: number };
  modelUpdatedAt: string | null;
  marketRegime: EntryMarketRegime | null;
  regimeWinRate: number | null;
  regimeAvgR: number | null;
  scoreThresholds: EntryScoreThresholds;
  trainingQuality: EntryTrainingQuality;
  topFeatures: EntryFeatureImportance[];
  validationStats: EntryValidationStats;
  aiInsights: string[];
  reasons: string[];
  nearestSamples: Array<Pick<EntrySample, "time" | "direction" | "label" | "rMultiple" | "barsHeld"> & { similarity: number }>;
}

export interface EntryTrainerStatus {
  symbol: string;
  timeframe: string;
  strategy: BacktestStrategy;
  trained: boolean;
  sampleCount: number;
  winRate: number;
  confidence: number;
  updatedAt: string | null;
  dataStartTime: number | null;
  dataEndTime: number | null;
  trainingQuality?: EntryTrainingQuality;
  scoreThresholds?: EntryScoreThresholds;
  topFeatures?: EntryFeatureImportance[];
  validationStats?: EntryValidationStats;
  message: string;
}

const MODEL_ROOT = path.resolve(process.cwd(), "runtime", "entry_trainer");
const FEATURE_NAMES: Array<keyof EntryFeatures> = [
  "rsi", "macd_hist_norm", "macd_slope_norm", "ema20_50_gap", "ema50_200_gap", "price_ema20_gap",
  "atr_pct", "adx_norm", "bb_percent_b", "bb_bandwidth", "volume_ratio", "cvd_slope", "body_pct",
  "upper_wick_pct", "lower_wick_pct", "range_pct", "vwap_gap", "fvg_nearby", "ob_nearby", "bos_choch_bias", "setup_quality",
];

const memoryModels = new Map<string, EntryTrainerModel>();

function getStrategyRiskDefaults(strategy: BacktestStrategy): { atrSlMult: number; atrTpMult: number; lookforward: number } {
  const table: Partial<Record<BacktestStrategy, { atrSlMult: number; atrTpMult: number; lookforward: number }>> = {
    pa: { atrSlMult: 1.95, atrTpMult: 0.5, lookforward: 8 },
    smc: { atrSlMult: 1.5, atrTpMult: 2.0, lookforward: 16 },
    chan: { atrSlMult: 1.5, atrTpMult: 2.0, lookforward: 18 },
    ema_cross: { atrSlMult: 1.5, atrTpMult: 2.0, lookforward: 20 },
    rsi_reversal: { atrSlMult: 1.5, atrTpMult: 2.0, lookforward: 12 },
    bollinger: { atrSlMult: 1.5, atrTpMult: 2.0, lookforward: 12 },
    macd: { atrSlMult: 1.5, atrTpMult: 2.0, lookforward: 18 },
    liquidity_sweep: { atrSlMult: 1.5, atrTpMult: 2.5, lookforward: 16 },
    vwap_reversion: { atrSlMult: 1.2, atrTpMult: 1.5, lookforward: 10 },
    composite: { atrSlMult: 1.5, atrTpMult: 2.0, lookforward: 16 },
    cannonball: { atrSlMult: 1.5, atrTpMult: 2.5, lookforward: 16 },
    hwr_model_a: { atrSlMult: 1.5, atrTpMult: 2.5, lookforward: 16 },
    hwr_model_b: { atrSlMult: 1.5, atrTpMult: 2.5, lookforward: 16 },
    hwr_model_c: { atrSlMult: 1.5, atrTpMult: 2.5, lookforward: 16 },
    v8_hybrid: { atrSlMult: 1.5, atrTpMult: 2.5, lookforward: 16 },
  };
  return table[strategy] ?? { atrSlMult: 1.5, atrTpMult: 2.0, lookforward: 16 };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeNum(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function round(value: number, digits = 4): number {
  const p = 10 ** digits;
  return Math.round(safeNum(value) * p) / p;
}


function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return 0;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  return dx > 0 && dy > 0 ? clamp(num / Math.sqrt(dx * dy), -1, 1) : 0;
}

function percentile(values: number[], pct: number, fallback: number): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return fallback;
  const idx = clamp((sorted.length - 1) * pct, 0, sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function sampleOutcomeCredit(sample: Pick<EntrySample, "label" | "rMultiple">): number {
  if (sample.label === "win") return 1;
  if (sample.label === "loss") return 0;
  return clamp(0.5 + safeNum(sample.rMultiple) * 0.35, 0.15, 0.85);
}

function classifyMarketRegime(features: EntryFeatures): EntryMarketRegime {
  const atrPct = safeNum(features.atr_pct) * 8;
  const adx = safeNum(features.adx_norm) * 60;
  const emaStackGap = Math.abs(safeNum(features.ema20_50_gap)) + Math.abs(safeNum(features.ema50_200_gap));
  if (atrPct >= 3.2 || safeNum(features.range_pct) * 8 >= 4.2) return "high_volatility";
  if (atrPct <= 0.28 && adx < 16) return "low_volatility";
  if (adx >= 24 && emaStackGap >= 0.18) return "trend";
  return "range";
}

function computeFeatureImportance(samples: EntrySample[]): EntryFeatureImportance[] {
  const targets = samples.map(sampleOutcomeCredit);
  const rTargets = samples.map(s => clamp((safeNum(s.rMultiple) + 1) / 3, 0, 1));
  const raw = FEATURE_NAMES.map(name => {
    const values = samples.map(s => safeNum(s.features[name] as number));
    const outcomeCorrelation = pearson(values, targets);
    const rCorrelation = pearson(values, rTargets);
    const strength = Math.abs(outcomeCorrelation) * 0.72 + Math.abs(rCorrelation) * 0.28;
    return { name, outcomeCorrelation: round(outcomeCorrelation, 4), rCorrelation: round(rCorrelation, 4), strength };
  });
  const avgStrength = raw.reduce((sum, x) => sum + x.strength, 0) / Math.max(1, raw.length);
  return raw
    .map(x => ({
      name: x.name,
      outcomeCorrelation: x.outcomeCorrelation,
      rCorrelation: x.rCorrelation,
      weight: round(clamp(0.55 + x.strength / Math.max(0.015, avgStrength) * 0.45, 0.45, 2.35), 4),
    }))
    .sort((a, b) => b.weight - a.weight);
}

function featureWeightMap(featureImportance: EntryFeatureImportance[] = []): Partial<Record<keyof EntryFeatures, number>> {
  const map: Partial<Record<keyof EntryFeatures, number>> = {};
  for (const item of featureImportance) map[item.name] = item.weight;
  return map;
}

function computeRegimeStats(samples: EntrySample[]): EntryRegimeStats[] {
  const regimes: EntryMarketRegime[] = ["trend", "range", "high_volatility", "low_volatility"];
  return regimes.map(regime => {
    const subset = samples.filter(s => classifyMarketRegime(s.features) === regime);
    const wins = subset.filter(s => s.label === "win").length;
    const losses = subset.filter(s => s.label === "loss").length;
    const resolved = wins + losses;
    return {
      regime,
      sampleCount: subset.length,
      winRate: round(resolved > 0 ? wins / resolved : 0, 4),
      avgRMultiple: round(subset.reduce((sum, x) => sum + x.rMultiple, 0) / Math.max(1, subset.length), 4),
    };
  }).filter(x => x.sampleCount > 0);
}

function computeTrainingDiagnostics(samples: EntrySample[], featureImportance: EntryFeatureImportance[]): EntryTrainingDiagnostics {
  const resolved = samples.filter(s => s.label !== "timeout").length;
  const resolvedRatio = samples.length > 0 ? resolved / samples.length : 0;
  const topWeights = featureImportance.slice(0, 5).map(x => x.weight);
  const allWeights = featureImportance.map(x => x.weight);
  const featureSeparation = round(allWeights.reduce((s, w) => s + Math.abs(w - 1), 0) / Math.max(1, allWeights.length), 4);
  const featureConcentration = round(topWeights.reduce((s, w) => s + w, 0) / Math.max(1e-9, allWeights.reduce((s, w) => s + w, 0)), 4);
  const notes: string[] = [];
  if (samples.length < 80) notes.push(`樣本數 ${samples.length} 偏少，建議提高 limit 或改用更高頻資料累積更多訊號。`);
  if (resolvedRatio < 0.55) notes.push(`已結案樣本比例 ${Math.round(resolvedRatio * 100)}% 偏低，timeout 對勝率解讀影響較大。`);
  if (featureSeparation < 0.08) notes.push("特徵分離度偏低，歷史勝敗對目前 21 個特徵的敏感度有限。");
  if (featureConcentration > 0.42) notes.push("模型較依賴少數特徵，需留意 regime 變化造成失效。");
  const quality: EntryTrainingQuality = samples.length >= 300 && resolvedRatio >= 0.6 && featureSeparation >= 0.08
    ? "strong"
    : samples.length >= 120 && resolvedRatio >= 0.45
      ? "usable"
      : samples.length >= 40
        ? "weak"
        : "insufficient";
  if (notes.length === 0) notes.push("訓練樣本、標籤結案比例與特徵分離度均達可用水準。");
  return { quality, resolvedRatio: round(resolvedRatio, 4), featureSeparation, featureConcentration, notes };
}

function computeScoreThresholds(samples: EntrySample[], diagnostics: EntryTrainingDiagnostics, regimeStats: EntryRegimeStats[]): EntryScoreThresholds {
  const edgeScores = samples.map(s => sampleOutcomeCredit(s) * 72 + clamp((s.rMultiple + 1) / 3, 0, 1) * 18 + s.features.setup_quality * 10);
  const enterPct = diagnostics.quality === "strong" ? 0.78 : diagnostics.quality === "usable" ? 0.82 : 0.88;
  const smallPct = diagnostics.quality === "strong" ? 0.58 : diagnostics.quality === "usable" ? 0.64 : 0.72;
  const waitPct = diagnostics.quality === "insufficient" ? 0.52 : 0.42;
  const profitableRegimeCount = regimeStats.filter(x => x.sampleCount >= 20 && x.avgRMultiple > 0).length;
  const regimeAdjustment = profitableRegimeCount >= 2 ? -2 : profitableRegimeCount === 0 ? 2 : 0;
  return {
    enter: Math.round(clamp(percentile(edgeScores, enterPct, 78) + regimeAdjustment, 72, 86)),
    small: Math.round(clamp(percentile(edgeScores, smallPct, 62) + regimeAdjustment / 2, 56, 74)),
    wait: Math.round(clamp(percentile(edgeScores, waitPct, 42), 36, 52)),
  };
}

function getThresholds(model: EntryTrainerModel): EntryScoreThresholds {
  return model.metadata.scoreThresholds ?? { enter: 78, small: 62, wait: 42 };
}

function unverifiedValidationStats(sampleCount: number, reason = "樣本不足，尚無法建立可靠的 out-of-sample 驗證。") : EntryValidationStats {
  return {
    trainSampleCount: sampleCount,
    testSampleCount: 0,
    predictedTradeCount: 0,
    oosWinRate: 0,
    oosAvgRMultiple: 0,
    coverage: 0,
    edgeScore: 0,
    overfitRisk: 100,
    verdict: "unverified",
    notes: [reason],
  };
}

function scoreHistoricalFeatures(
  features: EntryFeatures,
  direction: EntryDirection,
  trainingSamples: EntrySample[],
  featureWeights: Partial<Record<keyof EntryFeatures, number>>,
  thresholds: EntryScoreThresholds,
  baseWinRate: number,
): { score: number; confidence: number; weightedWin: number; weightedR: number; neighborCount: number } {
  const sameDirection = trainingSamples.filter(s => s.direction === direction);
  const pool = sameDirection.length >= 8 ? sameDirection : trainingSamples;
  const ranked = pool
    .map(s => ({ sample: s, dist: distance(features, s.features, featureWeights) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, Math.min(30, Math.max(8, Math.floor(pool.length * 0.25))));
  if (ranked.length === 0) return { score: 0, confidence: 0, weightedWin: 0, weightedR: 0, neighborCount: 0 };
  const weights = ranked.map(x => 1 / (0.05 + x.dist));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const weightedWin = ranked.reduce((s, x, idx) => s + sampleOutcomeCredit(x.sample) * weights[idx], 0) / weightSum;
  const weightedR = ranked.reduce((s, x, idx) => s + x.sample.rMultiple * weights[idx], 0) / weightSum;
  const rawScore = weightedWin * 72 + clamp((weightedR + 1) / 3, 0, 1) * 18 + features.setup_quality * 10;
  const confidence = clamp(ranked.length * 2.1 + Math.min(26, trainingSamples.length / 8) + Math.max(0, 1 - (ranked[0]?.dist ?? 1)) * 20 + Math.max(0, baseWinRate - 0.5) * 12, 12, 92);
  return { score: Math.round(clamp(rawScore, 0, 100)), confidence: Math.round(confidence), weightedWin: round(weightedWin, 4), weightedR: round(weightedR, 4), neighborCount: ranked.length };
}

function computeOutOfSampleValidation(samples: EntrySample[]): EntryValidationStats {
  const ordered = [...samples].sort((a, b) => a.time - b.time);
  if (ordered.length < 80) return unverifiedValidationStats(ordered.length);
  const split = Math.floor(ordered.length * 0.7);
  const train = ordered.slice(0, split);
  const test = ordered.slice(split);
  if (train.length < 50 || test.length < 20) return unverifiedValidationStats(ordered.length, `訓練段 ${train.length} 筆、驗證段 ${test.length} 筆，未達最低驗證門檻。`);

  const trainWins = train.filter(s => s.label === "win").length;
  const trainLosses = train.filter(s => s.label === "loss").length;
  const trainResolved = trainWins + trainLosses;
  const trainWinRate = trainResolved > 0 ? trainWins / trainResolved : 0;
  const trainAvgR = train.reduce((sum, s) => sum + s.rMultiple, 0) / Math.max(1, train.length);
  const trainImportance = computeFeatureImportance(train);
  const trainRegimeStats = computeRegimeStats(train);
  const trainDiagnostics = computeTrainingDiagnostics(train, trainImportance);
  const thresholds = computeScoreThresholds(train, trainDiagnostics, trainRegimeStats);
  const featureWeights = featureWeightMap(trainImportance);

  const predicted = test
    .map(sample => ({ sample, scored: scoreHistoricalFeatures(sample.features, sample.direction, train, featureWeights, thresholds, trainWinRate) }))
    .filter(x => x.scored.score >= thresholds.small && x.scored.confidence >= 32);
  const resolved = predicted.filter(x => x.sample.label !== "timeout");
  const wins = resolved.filter(x => x.sample.label === "win").length;
  const oosWinRate = resolved.length > 0 ? wins / resolved.length : 0;
  const oosAvgR = predicted.reduce((sum, x) => sum + x.sample.rMultiple, 0) / Math.max(1, predicted.length);
  const coverage = predicted.length / Math.max(1, test.length);
  const edgeScore = predicted.length > 0
    ? clamp(oosWinRate * 52 + clamp((oosAvgR + 1) / 2, 0, 1) * 34 + clamp(coverage / 0.35, 0, 1) * 14, 0, 100)
    : 0;
  const overfitRisk = clamp(
    Math.max(0, trainWinRate - oosWinRate) * 80 +
    Math.max(0, trainAvgR - oosAvgR) * 22 +
    (predicted.length < 8 ? 24 : 0) +
    (coverage < 0.06 ? 16 : coverage > 0.62 ? 10 : 0),
    0,
    100,
  );
  const verdict: EntryValidationVerdict = predicted.length < 8
    ? "unverified"
    : edgeScore >= 66 && overfitRisk <= 38
      ? "robust"
      : edgeScore >= 52 && overfitRisk <= 62
        ? "acceptable"
        : "fragile";
  const notes: string[] = [];
  notes.push(`OOS 使用後段 ${test.length} 筆樣本驗證，其中 ${predicted.length} 筆達小倉以上門檻。`);
  if (predicted.length < 8) notes.push("驗證段可交易樣本偏少，暫不宜過度信任分數。 ");
  if (overfitRisk >= 65) notes.push("訓練段與驗證段落差偏大，存在過度擬合風險。 ");
  if (edgeScore >= 66) notes.push("OOS edgeScore 顯示此策略具備較好的泛化能力。 ");
  return {
    trainSampleCount: train.length,
    testSampleCount: test.length,
    predictedTradeCount: predicted.length,
    oosWinRate: round(oosWinRate, 4),
    oosAvgRMultiple: round(oosAvgR, 4),
    coverage: round(coverage, 4),
    edgeScore: Math.round(edgeScore),
    overfitRisk: Math.round(overfitRisk),
    verdict,
    notes,
  };
}

function regimeLabel(regime: EntryMarketRegime): string {
  switch (regime) {
    case "trend": return "趨勢";
    case "range": return "震盪";
    case "high_volatility": return "高波動";
    case "low_volatility": return "低波動";
  }
}

function buildAiInsights(model: EntryTrainerModel, regime: EntryMarketRegime | null, regimeStat: EntryRegimeStats | undefined): string[] {
  const diagnostics = model.metadata.trainingDiagnostics;
  const top = (model.metadata.featureImportance ?? []).slice(0, 3);
  const insights: string[] = [];
  insights.push(`AI 訓練層採用特徵重要性加權近鄰；目前訓練品質為 ${diagnostics?.quality ?? "usable"}。`);
  if (top.length > 0) insights.push(`主要影響特徵：${top.map(x => `${String(x.name)}×${x.weight.toFixed(2)}`).join("、")}。`);
  if (regime && regimeStat) insights.push(`目前市場屬於${regimeLabel(regime)} regime；同類樣本 ${regimeStat.sampleCount} 筆，勝率 ${Math.round(regimeStat.winRate * 100)}%，平均 R ${regimeStat.avgRMultiple.toFixed(2)}。`);
  if (diagnostics?.notes?.[0]) insights.push(diagnostics.notes[0]);
  return insights;
}

function getCacheKey(symbol: string, timeframe: string, strategy: BacktestStrategy): string {
  return `${symbol.toUpperCase()}_${timeframe}_${strategy}`;
}

function getModelDir(symbol: string, timeframe: string, strategy: BacktestStrategy): string {
  return path.join(MODEL_ROOT, getCacheKey(symbol, timeframe, strategy));
}

function getMetadataPath(symbol: string, timeframe: string, strategy: BacktestStrategy): string {
  return path.join(getModelDir(symbol, timeframe, strategy), "metadata.json");
}

function recentSwingHigh(candles: Candle[], i: number, lookback = 20): number {
  const start = Math.max(0, i - lookback);
  return Math.max(...candles.slice(start, i).map(c => c.high));
}

function recentSwingLow(candles: Candle[], i: number, lookback = 20): number {
  const start = Math.max(0, i - lookback);
  return Math.min(...candles.slice(start, i).map(c => c.low));
}

function detectSignal(
  strategy: BacktestStrategy,
  candles: Candle[],
  i: number,
  ctx: {
    rsi: number[];
    macdHist: number[];
    ema20: number[];
    ema50: number[];
    ema200: number[];
    bb: ReturnType<typeof calcBollingerArr>;
    atr: number[];
    adx: number[];
    vwap: number;
    cvd: number[];
  },
): { direction: EntryDirection | null; reason: string; quality: number } {
  if (i < 60 || i >= candles.length) return { direction: null, reason: "資料不足", quality: 0 };
  const cur = candles[i];
  const prev = candles[i - 1];
  const close = cur.close;
  const rsi = safeNum(ctx.rsi[i], 50);
  const hist = safeNum(ctx.macdHist[i]);
  const prevHist = safeNum(ctx.macdHist[i - 1]);
  const ema20 = safeNum(ctx.ema20[i], close);
  const ema50 = safeNum(ctx.ema50[i], close);
  const ema200 = safeNum(ctx.ema200[i], close);
  const bb = ctx.bb[i];
  const atrPct = Math.abs(safeNum(ctx.atr[i]) / close) * 100;
  const adx = safeNum(ctx.adx[i], 20);
  const swingHigh = recentSwingHigh(candles, i, 24);
  const swingLow = recentSwingLow(candles, i, 24);
  const volumeSma = candles.slice(Math.max(0, i - 20), i).reduce((s, c) => s + c.volume, 0) / 20;
  const volumeRatio = volumeSma > 0 ? cur.volume / volumeSma : 1;
  const bullishEngulf = cur.close > cur.open && prev.close < prev.open && cur.close > prev.open && cur.open <= prev.close;
  const bearishEngulf = cur.close < cur.open && prev.close > prev.open && cur.close < prev.open && cur.open >= prev.close;
  const sweptLow = cur.low < swingLow && cur.close > swingLow;
  const sweptHigh = cur.high > swingHigh && cur.close < swingHigh;
  const trendBull = ema20 > ema50 && ema50 > ema200;
  const trendBear = ema20 < ema50 && ema50 < ema200;
  const cvdSlope = safeNum(ctx.cvd[i] - ctx.cvd[Math.max(0, i - 5)]) / Math.max(1, Math.abs(ctx.cvd[Math.max(0, i - 5)]));
  let direction: EntryDirection | null = null;
  let reason = "未形成策略訊號";
  let quality = 0;

  switch (strategy) {
    case "ema_cross":
      if (ctx.ema20[i] > ctx.ema50[i] && ctx.ema20[i - 1] <= ctx.ema50[i - 1]) { direction = "long"; reason = "EMA20 上穿 EMA50"; quality = 58 + clamp(adx, 0, 35) * 0.9; }
      else if (ctx.ema20[i] < ctx.ema50[i] && ctx.ema20[i - 1] >= ctx.ema50[i - 1]) { direction = "short"; reason = "EMA20 下穿 EMA50"; quality = 58 + clamp(adx, 0, 35) * 0.9; }
      break;
    case "rsi_reversal":
      if (rsi < 38 && cur.close > prev.close) { direction = "long"; reason = "RSI 低檔反彈"; quality = 62 + (38 - rsi) * 0.8; }
      else if (rsi > 62 && cur.close < prev.close) { direction = "short"; reason = "RSI 高檔轉弱"; quality = 62 + (rsi - 62) * 0.8; }
      break;
    case "bollinger":
      if (bb?.is_ready && bb.percent_b < 0.18 && rsi < 48) { direction = "long"; reason = "價格貼近布林下緣且 RSI 偏低"; quality = 60 + (0.18 - bb.percent_b) * 80; }
      else if (bb?.is_ready && bb.percent_b > 0.82 && rsi > 52) { direction = "short"; reason = "價格貼近布林上緣且 RSI 偏高"; quality = 60 + (bb.percent_b - 0.82) * 80; }
      break;
    case "macd":
      if (hist > 0 && prevHist <= 0) { direction = "long"; reason = "MACD 柱體翻正"; quality = 58 + clamp(adx, 0, 30); }
      else if (hist < 0 && prevHist >= 0) { direction = "short"; reason = "MACD 柱體翻負"; quality = 58 + clamp(adx, 0, 30); }
      break;
    case "liquidity_sweep":
    case "smc":
      if (sweptLow && volumeRatio > 1.05) { direction = "long"; reason = "掃低點後收回，疑似 SSL liquidity sweep"; quality = 66 + clamp((volumeRatio - 1) * 18, 0, 18); }
      else if (sweptHigh && volumeRatio > 1.05) { direction = "short"; reason = "掃高點後壓回，疑似 BSL liquidity sweep"; quality = 66 + clamp((volumeRatio - 1) * 18, 0, 18); }
      break;
    case "pa":
      if (bullishEngulf && rsi < 58) { direction = "long"; reason = "多方吞沒 K 線且動能未過熱"; quality = 64 + clamp(volumeRatio * 8, 0, 16); }
      else if (bearishEngulf && rsi > 42) { direction = "short"; reason = "空方吞沒 K 線且動能轉弱"; quality = 64 + clamp(volumeRatio * 8, 0, 16); }
      break;
    case "vwap_reversion": {
      const gap = ctx.vwap > 0 ? (close - ctx.vwap) / ctx.vwap * 100 : 0;
      if (gap < -0.7 && rsi < 45 && cur.close > prev.close) { direction = "long"; reason = "價格低於 VWAP 後出現回歸反彈"; quality = 61 + clamp(Math.abs(gap) * 5, 0, 18); }
      else if (gap > 0.7 && rsi > 55 && cur.close < prev.close) { direction = "short"; reason = "價格高於 VWAP 後出現回歸轉弱"; quality = 61 + clamp(Math.abs(gap) * 5, 0, 18); }
      break;
    }
    case "chan":
      if (trendBull && close <= ema20 * 1.006 && hist > prevHist) { direction = "long"; reason = "纏論近似趨勢回踩後動能改善"; quality = 62 + clamp(adx, 0, 28); }
      else if (trendBear && close >= ema20 * 0.994 && hist < prevHist) { direction = "short"; reason = "纏論近似趨勢反彈後動能轉弱"; quality = 62 + clamp(adx, 0, 28); }
      break;
    case "composite":
    case "cannonball":
    case "hwr_model_a":
    case "hwr_model_b":
    case "hwr_model_c":
    case "v8_hybrid":
    case "apex":
    case "elite":
    case "hwr_model_a_elite":
    default:
      if ((trendBull || close > ema200) && hist > prevHist && rsi > 45 && rsi < 68 && adx > 16 && (close > ema20 || sweptLow || bullishEngulf)) {
        direction = "long";
        reason = "多因子共振：趨勢、MACD 斜率、RSI 與型態條件偏多";
        quality = 58 + clamp(adx, 0, 30) + (trendBull ? 8 : 0) + (sweptLow ? 8 : 0) + (cvdSlope > 0 ? 5 : 0);
      } else if ((trendBear || close < ema200) && hist < prevHist && rsi > 32 && rsi < 55 && adx > 16 && (close < ema20 || sweptHigh || bearishEngulf)) {
        direction = "short";
        reason = "多因子共振：趨勢、MACD 斜率、RSI 與型態條件偏空";
        quality = 58 + clamp(adx, 0, 30) + (trendBear ? 8 : 0) + (sweptHigh ? 8 : 0) + (cvdSlope < 0 ? 5 : 0);
      }
      break;
  }

  if (atrPct < 0.08 || atrPct > 6) quality -= 8;
  return { direction, reason, quality: clamp(quality, 0, 100) };
}

function buildFeatureContext(candles: Candle[]) {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const rsi = calcRsiArr(closes, 14);
  const macd = calcMacdArr(closes);
  const ema20 = calcEmaArr(closes, 20);
  const ema50 = calcEmaArr(closes, 50);
  const ema200 = calcEmaArr(closes, 200);
  const bb = calcBollingerArr(closes, 20, 2);
  const atr = calcAtrArr(candles, 14);
  const adx = calcAdxArr(candles, 14).adx;
  const volSma20 = calcSma(volumes, 20);
  const cvd = calcCVD(candles);
  const vwap = calcVwap(candles, "anchored").value;
  const latestClose = candles[candles.length - 1]?.close ?? 0;
  const fvgZones = detectFvgZones(candles, latestClose);
  const orderBlocks = detectOrderBlocks(candles, latestClose);
  const bosChoch = detectBosChoch(candles);
  return { closes, volumes, rsi, macd, ema20, ema50, ema200, bb, atr, adx, volSma20, cvd, vwap, fvgZones, orderBlocks, bosChoch };
}

function extractFeatures(candles: Candle[], i: number, signalQuality = 0): EntryFeatures {
  const ctx = buildFeatureContext(candles);
  return extractFeaturesFromContext(candles, i, ctx, signalQuality);
}

function extractFeaturesFromContext(candles: Candle[], i: number, ctx: ReturnType<typeof buildFeatureContext>, signalQuality = 0): EntryFeatures {
  const cur = candles[i];
  const close = Math.max(cur.close, 1e-9);
  const range = Math.max(cur.high - cur.low, close * 1e-8);
  const body = Math.abs(cur.close - cur.open);
  const upperWick = cur.high - Math.max(cur.close, cur.open);
  const lowerWick = Math.min(cur.close, cur.open) - cur.low;
  const atr = safeNum(ctx.atr[i], range);
  const macdHist = safeNum(ctx.macd.hist[i]);
  const prevMacdHist = safeNum(ctx.macd.hist[i - 1]);
  const ema20 = safeNum(ctx.ema20[i], close);
  const ema50 = safeNum(ctx.ema50[i], close);
  const ema200 = safeNum(ctx.ema200[i], close);
  const bb = ctx.bb[i];
  const volSma = safeNum(ctx.volSma20[i], cur.volume || 1);
  const cvdNow = safeNum(ctx.cvd[i]);
  const cvdPast = safeNum(ctx.cvd[Math.max(0, i - 5)]);
  const vwapGap = ctx.vwap > 0 ? (close - ctx.vwap) / ctx.vwap : 0;
  const nearbyThreshold = atr > 0 ? atr * 1.2 : close * 0.01;
  const fvgList = [...(ctx.fvgZones.allBull ?? []), ...(ctx.fvgZones.allBear ?? [])];
  const obList = [...(ctx.orderBlocks.allBull ?? []), ...(ctx.orderBlocks.allBear ?? [])];
  const recentFvg = fvgList.some((z: any) => Math.abs((z.mid ?? close) - close) <= nearbyThreshold);
  const recentOb = obList.some((z: any) => Math.abs((z.mid ?? close) - close) <= nearbyThreshold);
  const recentBos = [...(ctx.bosChoch.events ?? [])].reverse().find((z: any) => z.idx <= i && i - z.idx <= 48);
  const bosBias = recentBos?.direction === "bullish" ? 1 : recentBos?.direction === "bearish" ? -1 : 0;

  return {
    rsi: round(clamp(safeNum(ctx.rsi[i], 50) / 100, 0, 1), 5),
    macd_hist_norm: round(clamp(macdHist / close * 100, -3, 3) / 3, 5),
    macd_slope_norm: round(clamp((macdHist - prevMacdHist) / close * 100, -3, 3) / 3, 5),
    ema20_50_gap: round(clamp((ema20 - ema50) / close * 100, -5, 5) / 5, 5),
    ema50_200_gap: round(clamp((ema50 - ema200) / close * 100, -10, 10) / 10, 5),
    price_ema20_gap: round(clamp((close - ema20) / close * 100, -5, 5) / 5, 5),
    atr_pct: round(clamp(atr / close * 100, 0, 8) / 8, 5),
    adx_norm: round(clamp(safeNum(ctx.adx[i], 20), 0, 60) / 60, 5),
    bb_percent_b: round(clamp(bb?.percent_b ?? 0.5, -0.5, 1.5), 5),
    bb_bandwidth: round(clamp((bb?.bandwidth ?? 0) / 100, 0, 0.25) / 0.25, 5),
    volume_ratio: round(clamp(cur.volume / Math.max(volSma, 1e-9), 0, 5) / 5, 5),
    cvd_slope: round(clamp((cvdNow - cvdPast) / Math.max(Math.abs(cvdPast), 1), -1, 1), 5),
    body_pct: round(clamp(body / range, 0, 1), 5),
    upper_wick_pct: round(clamp(upperWick / range, 0, 1), 5),
    lower_wick_pct: round(clamp(lowerWick / range, 0, 1), 5),
    range_pct: round(clamp(range / close * 100, 0, 8) / 8, 5),
    vwap_gap: round(clamp(vwapGap * 100, -5, 5) / 5, 5),
    fvg_nearby: recentFvg ? 1 : 0,
    ob_nearby: recentOb ? 1 : 0,
    bos_choch_bias: bosBias,
    setup_quality: round(clamp(signalQuality, 0, 100) / 100, 5),
  };
}

function resolveIntrabarConflict(candle: Candle, direction: EntryDirection, sl: number, tp: number, mode: EntryLabelMode): EntryLabel {
  if (mode === "optimistic") return "win";
  if (mode === "conservative") return "loss";
  const reference = Number.isFinite(candle.open) ? candle.open : candle.close;
  const slDistance = Math.abs(reference - sl);
  const tpDistance = Math.abs(reference - tp);
  if (Math.abs(slDistance - tpDistance) <= Math.max(reference * 0.0002, 1e-9)) {
    const bullishCandle = candle.close >= candle.open;
    return direction === "long" ? (bullishCandle ? "win" : "loss") : (bullishCandle ? "loss" : "win");
  }
  return tpDistance < slDistance ? "win" : "loss";
}

function labelForwardOutcome(
  candles: Candle[],
  signalIndex: number,
  direction: EntryDirection,
  atr: number,
  atrSlMult: number,
  atrTpMult: number,
  lookforward: number,
  labelMode: EntryLabelMode,
): Omit<EntrySample, "time" | "strategy" | "direction" | "features" | "signalReason"> | null {
  const entryIndex = signalIndex + 1;
  if (entryIndex >= candles.length) return null;
  const entry = candles[entryIndex].open;
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(atr) || atr <= 0) return null;
  const sl = direction === "long" ? entry - atr * atrSlMult : entry + atr * atrSlMult;
  const tp = direction === "long" ? entry + atr * atrTpMult : entry - atr * atrTpMult;
  const risk = Math.abs(entry - sl);
  if (risk <= 0) return null;

  let label: EntryLabel = "timeout";
  let exitPrice = candles[Math.min(candles.length - 1, entryIndex + lookforward)]?.close ?? entry;
  let exitTime = candles[Math.min(candles.length - 1, entryIndex + lookforward)]?.time ?? candles[entryIndex].time;
  let barsHeld = Math.min(lookforward, candles.length - 1 - entryIndex);

  for (let j = entryIndex; j < Math.min(candles.length, entryIndex + lookforward + 1); j++) {
    const c = candles[j];
    if (direction === "long") {
      const hitSl = c.low <= sl;
      const hitTp = c.high >= tp;
      if (hitSl && hitTp) {
        label = resolveIntrabarConflict(c, direction, sl, tp, labelMode);
        exitPrice = label === "win" ? tp : sl;
        exitTime = c.time;
        barsHeld = j - entryIndex + 1;
        break;
      }
      if (hitSl) { label = "loss"; exitPrice = sl; exitTime = c.time; barsHeld = j - entryIndex + 1; break; }
      if (hitTp) { label = "win"; exitPrice = tp; exitTime = c.time; barsHeld = j - entryIndex + 1; break; }
    } else {
      const hitSl = c.high >= sl;
      const hitTp = c.low <= tp;
      if (hitSl && hitTp) {
        label = resolveIntrabarConflict(c, direction, sl, tp, labelMode);
        exitPrice = label === "win" ? tp : sl;
        exitTime = c.time;
        barsHeld = j - entryIndex + 1;
        break;
      }
      if (hitSl) { label = "loss"; exitPrice = sl; exitTime = c.time; barsHeld = j - entryIndex + 1; break; }
      if (hitTp) { label = "win"; exitPrice = tp; exitTime = c.time; barsHeld = j - entryIndex + 1; break; }
    }
  }

  const signedMove = direction === "long" ? exitPrice - entry : entry - exitPrice;
  const rMultiple = label === "timeout" ? signedMove / risk : label === "win" ? atrTpMult / atrSlMult : -1;
  return { entry, sl, tp, exitTime, exitPrice, label, barsHeld, rMultiple: round(rMultiple, 4) };
}

export function generateEntrySamples(
  candles: Candle[],
  strategy: BacktestStrategy,
  atrSlMult = 1.5,
  atrTpMult = 3.0,
  lookforward = 12,
  labelMode: EntryLabelMode = "conservative",
): EntrySample[] {
  if (!Array.isArray(candles) || candles.length < 180) return [];
  const ctx = buildFeatureContext(candles);
  const samples: EntrySample[] = [];
  for (let i = 120; i < candles.length - lookforward - 2; i++) {
    const sig = detectSignal(strategy, candles, i, {
      rsi: ctx.rsi,
      macdHist: ctx.macd.hist,
      ema20: ctx.ema20,
      ema50: ctx.ema50,
      ema200: ctx.ema200,
      bb: ctx.bb,
      atr: ctx.atr,
      adx: ctx.adx,
      vwap: ctx.vwap,
      cvd: ctx.cvd,
    });
    if (!sig.direction) continue;
    const outcome = labelForwardOutcome(candles, i, sig.direction, safeNum(ctx.atr[i]), atrSlMult, atrTpMult, lookforward, labelMode);
    if (!outcome) continue;
    samples.push({
      time: candles[i + 1].time,
      strategy,
      direction: sig.direction,
      features: extractFeaturesFromContext(candles, i, ctx, sig.quality),
      signalReason: sig.reason,
      ...outcome,
    });
  }
  return samples;
}

function buildMetadata(
  symbol: string,
  timeframe: string,
  strategy: BacktestStrategy,
  candles: Candle[],
  samples: EntrySample[],
  atrSlMult: number,
  atrTpMult: number,
  lookforward: number,
  labelMode: EntryLabelMode,
): EntryTrainerMetadata {
  const winCount = samples.filter(s => s.label === "win").length;
  const lossCount = samples.filter(s => s.label === "loss").length;
  const timeoutCount = samples.filter(s => s.label === "timeout").length;
  const resolved = winCount + lossCount;
  const featureImportance = computeFeatureImportance(samples);
  const regimeStats = computeRegimeStats(samples);
  const trainingDiagnostics = computeTrainingDiagnostics(samples, featureImportance);
  return {
    version: "v6.4-entry-trainer",
    symbol,
    timeframe,
    strategy,
    generatedAt: new Date().toISOString(),
    dataStartTime: candles[0]?.time ?? null,
    dataEndTime: candles[candles.length - 1]?.time ?? null,
    candleCount: candles.length,
    sampleCount: samples.length,
    winCount,
    lossCount,
    timeoutCount,
    winRate: round(resolved > 0 ? winCount / resolved : 0, 4),
    avgRMultiple: round(samples.reduce((s, x) => s + x.rMultiple, 0) / Math.max(1, samples.length), 4),
    atrSlMult,
    atrTpMult,
    lookforward,
    labelMode,
    featureNames: FEATURE_NAMES,
    featureImportance,
    featureWeights: featureWeightMap(featureImportance),
    regimeStats,
    trainingDiagnostics,
    validationStats: computeOutOfSampleValidation(samples),
    scoreThresholds: computeScoreThresholds(samples, trainingDiagnostics, regimeStats),
  };
}

export async function trainEntryModel(options: EntryTrainerOptions, candles: Candle[]): Promise<EntryTrainerModel> {
  const defaults = getStrategyRiskDefaults(options.strategy);
  const atrSlMult = options.atrSlMult ?? defaults.atrSlMult;
  const atrTpMult = options.atrTpMult ?? defaults.atrTpMult;
  const lookforward = options.lookforward ?? defaults.lookforward;
  const labelMode = options.labelMode ?? "conservative";
  const samples = generateEntrySamples(candles, options.strategy, atrSlMult, atrTpMult, lookforward, labelMode);
  const model: EntryTrainerModel = {
    metadata: buildMetadata(options.symbol, options.timeframe, options.strategy, candles, samples, atrSlMult, atrTpMult, lookforward, labelMode),
    samples,
  };
  await mkdir(getModelDir(options.symbol, options.timeframe, options.strategy), { recursive: true });
  await writeFile(getMetadataPath(options.symbol, options.timeframe, options.strategy), JSON.stringify(model, null, 2), "utf8");
  memoryModels.set(getCacheKey(options.symbol, options.timeframe, options.strategy), model);
  return model;
}

export async function loadEntryModel(symbol: string, timeframe: string, strategy: BacktestStrategy): Promise<EntryTrainerModel | null> {
  const key = getCacheKey(symbol, timeframe, strategy);
  const cached = memoryModels.get(key);
  if (cached) return cached;
  try {
    const raw = await readFile(getMetadataPath(symbol, timeframe, strategy), "utf8");
    const model = JSON.parse(raw) as EntryTrainerModel;
    if (!Array.isArray(model.samples) || !model.metadata) return null;
    memoryModels.set(key, model);
    return model;
  } catch {
    return null;
  }
}

function distance(a: EntryFeatures, b: EntryFeatures, weights?: Partial<Record<keyof EntryFeatures, number>>): number {
  let sum = 0;
  let weightSum = 0;
  for (const name of FEATURE_NAMES) {
    const w = clamp(weights?.[name] ?? 1, 0.25, 3);
    const d = safeNum(a[name] as number) - safeNum(b[name] as number);
    sum += w * d * d;
    weightSum += w;
  }
  return Math.sqrt(sum / Math.max(1e-9, weightSum));
}

function verdictFromScore(score: number, confidence: number, sampleCount: number, thresholds: EntryScoreThresholds = { enter: 78, small: 62, wait: 42 }): EntryVerdict {
  if (sampleCount < 10 || confidence < 25) return score >= thresholds.small + 3 ? "小倉" : "等待";
  if (score >= thresholds.enter && confidence >= 55) return "進場";
  if (score >= thresholds.small && confidence >= 40) return "小倉";
  if (score >= thresholds.wait) return "等待";
  return "禁止";
}

function currentEntrySignal(candles: Candle[], strategy: BacktestStrategy) {
  const ctx = buildFeatureContext(candles);
  const i = candles.length - 2;
  const sig = detectSignal(strategy, candles, i, {
    rsi: ctx.rsi,
    macdHist: ctx.macd.hist,
    ema20: ctx.ema20,
    ema50: ctx.ema50,
    ema200: ctx.ema200,
    bb: ctx.bb,
    atr: ctx.atr,
    adx: ctx.adx,
    vwap: ctx.vwap,
    cvd: ctx.cvd,
  });
  const features = extractFeaturesFromContext(candles, i, ctx, sig.quality);
  const atr = safeNum(ctx.atr[i]);
  return { index: i, signal: sig, features, atr, candle: candles[i], entryCandle: candles[candles.length - 1] };
}

export async function scoreEntry(options: EntryTrainerOptions, candles: Candle[]): Promise<EntryScoreResult> {
  const minSamples = options.minSamples ?? 30;
  const defaults = getStrategyRiskDefaults(options.strategy);
  const labelMode = options.labelMode ?? "conservative";
  let model = await loadEntryModel(options.symbol, options.timeframe, options.strategy);
  const needsTrainerUpgrade = !model?.metadata.featureWeights || !model?.metadata.featureImportance || !model?.metadata.scoreThresholds || !model?.metadata.trainingDiagnostics || !model?.metadata.validationStats;
  if (!model || needsTrainerUpgrade || model.metadata.sampleCount < minSamples || model.metadata.dataEndTime !== candles[candles.length - 1]?.time || (model.metadata.labelMode ?? "conservative") !== labelMode) {
    model = await trainEntryModel({ ...options, labelMode }, candles);
  }

  const current = currentEntrySignal(candles, options.strategy);
  const labelStats = {
    win: model.samples.filter(s => s.label === "win").length,
    loss: model.samples.filter(s => s.label === "loss").length,
    timeout: model.samples.filter(s => s.label === "timeout").length,
  };

  if (!current.signal.direction) {
    const baseConfidence = clamp(Math.min(55, model.metadata.sampleCount / 2), 10, 55);
    return {
      symbol: options.symbol,
      timeframe: options.timeframe,
      strategy: options.strategy,
      score: 28,
      verdict: "等待",
      direction: "none",
      winRate: model.metadata.winRate,
      sampleCount: model.metadata.sampleCount,
      confidence: Math.round(baseConfidence),
      entry: null,
      sl: null,
      tp: null,
      rr: null,
      labelMode: model.metadata.labelMode ?? labelMode,
      localWinRate: 0,
      weightedR: 0,
      diagnostics: [
        model.metadata.sampleCount < minSamples ? `樣本不足：目前 ${model.metadata.sampleCount} 筆，低於建議門檻 ${minSamples} 筆。` : "樣本量達基本門檻。",
        "最新已收 K 線沒有觸發策略訊號，因此評分以等待為主。",
        `目前採用 ${model.metadata.labelMode ?? labelMode} 同根 TP/SL 標籤規則。`,
      ],
      labelStats,
      modelUpdatedAt: model.metadata.generatedAt,
      marketRegime: null,
      regimeWinRate: null,
      regimeAvgR: null,
      scoreThresholds: getThresholds(model),
      trainingQuality: model.metadata.trainingDiagnostics?.quality ?? "usable",
      topFeatures: (model.metadata.featureImportance ?? []).slice(0, 5),
      validationStats: model.metadata.validationStats ?? unverifiedValidationStats(model.metadata.sampleCount),
      aiInsights: buildAiInsights(model, null, undefined),
      reasons: [
        "目前最後一根已收 K 線未形成此策略的明確進場訊號，因此不建議主動追單。",
        `歷史訓練樣本 ${model.metadata.sampleCount} 筆，僅作為等待下一個訊號時的勝率背景。`,
      ],
      nearestSamples: [],
    };
  }

  const thresholds = getThresholds(model);
  const featureWeights = model.metadata.featureWeights ?? featureWeightMap(model.metadata.featureImportance ?? []);
  const marketRegime = classifyMarketRegime(current.features);
  const regimeStat = model.metadata.regimeStats?.find(x => x.regime === marketRegime);
  const sameDirection = model.samples.filter(s => s.direction === current.signal.direction);
  const ranked = sameDirection
    .map(s => ({ sample: s, dist: distance(current.features, s.features, featureWeights) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, Math.min(35, Math.max(8, Math.floor(sameDirection.length * 0.25))));
  const neighborhood = ranked.length > 0 ? ranked : model.samples.map(s => ({ sample: s, dist: distance(current.features, s.features, featureWeights) })).sort((a, b) => a.dist - b.dist).slice(0, 20);
  const weights = neighborhood.map(x => 1 / (0.05 + x.dist));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const weightedWin = neighborhood.reduce((s, x, idx) => s + sampleOutcomeCredit(x.sample) * weights[idx], 0) / weightSum;
  const weightedR = neighborhood.reduce((s, x, idx) => s + x.sample.rMultiple * weights[idx], 0) / weightSum;
  const regimeAdjustment = regimeStat && regimeStat.sampleCount >= 20 ? clamp(regimeStat.avgRMultiple * 5 + (regimeStat.winRate - model.metadata.winRate) * 10, -6, 6) : 0;
  const rawScore = weightedWin * 72 + clamp((weightedR + 1) / 3, 0, 1) * 18 + current.features.setup_quality * 10 + regimeAdjustment;
  const confidence = clamp(neighborhood.length * 2.2 + Math.min(28, model.metadata.sampleCount / 8) + Math.max(0, 1 - (neighborhood[0]?.dist ?? 1)) * 22 + (model.metadata.trainingDiagnostics?.quality === "strong" ? 4 : model.metadata.trainingDiagnostics?.quality === "weak" ? -6 : 0), 18, 94);
  const score = Math.round(clamp(rawScore, 0, 100));
  const verdict = verdictFromScore(score, confidence, model.metadata.sampleCount, thresholds);
  const entry = current.entryCandle?.open ?? current.candle.close;
  const atrSlMult = options.atrSlMult ?? model.metadata.atrSlMult ?? defaults.atrSlMult;
  const atrTpMult = options.atrTpMult ?? model.metadata.atrTpMult ?? defaults.atrTpMult;
  const sl = current.signal.direction === "long" ? entry - current.atr * atrSlMult : entry + current.atr * atrSlMult;
  const tp = current.signal.direction === "long" ? entry + current.atr * atrTpMult : entry - current.atr * atrTpMult;
  const localWinCount = neighborhood.filter(x => x.sample.label === "win").length;
  const localLossCount = neighborhood.filter(x => x.sample.label === "loss").length;
  const localTimeoutCount = neighborhood.filter(x => x.sample.label === "timeout").length;
  const localResolved = localWinCount + localLossCount;
  const localWinRate = localResolved > 0 ? localWinCount / localResolved : 0;
  const diagnostics = [
    model.metadata.sampleCount < minSamples ? `樣本不足：目前 ${model.metadata.sampleCount} 筆，低於建議門檻 ${minSamples} 筆。` : `樣本量正常：目前 ${model.metadata.sampleCount} 筆。`,
    neighborhood.length < 8 ? `相似樣本偏少：僅 ${neighborhood.length} 筆，信心需打折。` : `相似樣本 ${neighborhood.length} 筆，可形成局部勝率參考。`,
    `同根 TP/SL 採用 ${model.metadata.labelMode ?? labelMode} 規則；SL=${atrSlMult} ATR，TP=${atrTpMult} ATR。`,
    weightedR <= 0 ? "相似樣本平均 R 倍數不佳，需等待更高品質訊號。" : "相似樣本平均 R 倍數為正，具備統計優勢跡象。",
    `AI 加權距離：目前以 ${String((model.metadata.featureImportance ?? [])[0]?.name ?? "setup_quality")} 等高重要性特徵提高相似樣本辨識權重。`,
    regimeStat ? `市場 regime：${regimeLabel(marketRegime)}，同類樣本勝率 ${Math.round(regimeStat.winRate * 100)}%，平均 R ${regimeStat.avgRMultiple.toFixed(2)}。` : `市場 regime：${regimeLabel(marketRegime)}，同類歷史樣本不足。`,
  ];

  const reasons = [
    `${current.signal.reason}，目前方向為 ${current.signal.direction === "long" ? "多方" : "空方"}。`,
    `相似歷史樣本 ${neighborhood.length} 筆：勝 ${localWinCount}、敗 ${localLossCount}、逾時 ${localTimeoutCount}，加權勝率約 ${Math.round(weightedWin * 100)}%。`,
    `全體訓練樣本 ${model.metadata.sampleCount} 筆，已結案勝率 ${Math.round(model.metadata.winRate * 100)}%，平均 R 倍數 ${model.metadata.avgRMultiple.toFixed(2)}。`,
    `動態門檻：進場 ≥ ${thresholds.enter}、小倉 ≥ ${thresholds.small}、等待 ≥ ${thresholds.wait}。`,
  ];
  if (score >= thresholds.enter) reasons.push("進場品質高於本策略動態門檻，但仍需依既定風控控制單筆風險。 ");
  else if (score >= thresholds.small) reasons.push("條件具備但非極高勝率型態，建議小倉或等待更佳價格。 ");
  else if (score >= thresholds.wait) reasons.push("相似樣本優勢不足，建議等待下一根 K 線確認或提高 RR 條件。 ");
  else reasons.push("歷史相似樣本不利，建議禁止進場或等待訊號重置。 ");

  return {
    symbol: options.symbol,
    timeframe: options.timeframe,
    strategy: options.strategy,
    score,
    verdict,
    direction: current.signal.direction,
    winRate: round(weightedWin, 4),
    sampleCount: model.metadata.sampleCount,
    confidence: Math.round(confidence),
    entry: round(entry, 2),
    sl: round(sl, 2),
    tp: round(tp, 2),
    rr: round(Math.abs(tp - entry) / Math.max(1e-9, Math.abs(entry - sl)), 2),
    labelMode: model.metadata.labelMode ?? labelMode,
    localWinRate: round(localWinRate, 4),
    weightedR: round(weightedR, 4),
    diagnostics,
    labelStats,
    modelUpdatedAt: model.metadata.generatedAt,
    marketRegime,
    regimeWinRate: regimeStat ? regimeStat.winRate : null,
    regimeAvgR: regimeStat ? regimeStat.avgRMultiple : null,
    scoreThresholds: thresholds,
    trainingQuality: model.metadata.trainingDiagnostics?.quality ?? "usable",
    topFeatures: (model.metadata.featureImportance ?? []).slice(0, 5),
    validationStats: model.metadata.validationStats ?? unverifiedValidationStats(model.metadata.sampleCount),
    aiInsights: buildAiInsights(model, marketRegime, regimeStat),
    reasons,
    nearestSamples: neighborhood.slice(0, 8).map(x => ({
      time: x.sample.time,
      direction: x.sample.direction,
      label: x.sample.label,
      rMultiple: x.sample.rMultiple,
      barsHeld: x.sample.barsHeld,
      similarity: round(clamp(1 - x.dist, 0, 1), 4),
    })),
  };
}

export async function getEntryTrainerStatus(symbol: string, timeframe: string, strategy: BacktestStrategy): Promise<EntryTrainerStatus> {
  const model = await loadEntryModel(symbol, timeframe, strategy);
  if (!model) {
    return {
      symbol,
      timeframe,
      strategy,
      trained: false,
      sampleCount: 0,
      winRate: 0,
      confidence: 0,
      updatedAt: null,
      dataStartTime: null,
      dataEndTime: null,
      trainingQuality: "insufficient",
      scoreThresholds: { enter: 78, small: 62, wait: 42 },
      topFeatures: [],
      validationStats: unverifiedValidationStats(0),
      message: "尚未建立 AI Entry Trainer 訓練檔，首次查詢 entryScore 時會自動訓練。",
    };
  }
  const confidence = clamp(model.metadata.sampleCount / 2 + Math.min(35, (model.metadata.winCount + model.metadata.lossCount) / 3), 10, 95);
  return {
    symbol,
    timeframe,
    strategy,
    trained: true,
    sampleCount: model.metadata.sampleCount,
    winRate: model.metadata.winRate,
    confidence: Math.round(confidence),
    updatedAt: model.metadata.generatedAt,
    dataStartTime: model.metadata.dataStartTime,
    dataEndTime: model.metadata.dataEndTime,
    trainingQuality: model.metadata.trainingDiagnostics?.quality ?? "usable",
    scoreThresholds: getThresholds(model),
    topFeatures: (model.metadata.featureImportance ?? []).slice(0, 5),
    validationStats: model.metadata.validationStats ?? unverifiedValidationStats(model.metadata.sampleCount),
    message: `Entry Trainer 已訓練：${model.metadata.sampleCount} 筆進場樣本，已結案勝率 ${Math.round(model.metadata.winRate * 100)}%，訓練品質 ${(model.metadata.trainingDiagnostics?.quality ?? "usable").toUpperCase()}。`,
  };
}

export function clearEntryTrainerCache(symbol?: string, timeframe?: string, strategy?: BacktestStrategy): void {
  if (!symbol || !timeframe || !strategy) {
    memoryModels.clear();
    return;
  }
  memoryModels.delete(getCacheKey(symbol, timeframe, strategy));
}

export function getEntryStrategyReliability(
  symbol: string,
  timeframe: string,
  candles: Candle[],
  strategies: BacktestStrategy[],
  labelMode: EntryLabelMode = "conservative",
): { symbol: string; timeframe: string; currentRegime: EntryMarketRegime | null; leaderboard: EntryStrategyReliability[]; generatedAt: string } {
  const regimeProbe = candles.length >= 180 ? currentEntrySignal(candles, strategies[0] ?? "v8_hybrid") : null;
  const currentRegime = regimeProbe ? classifyMarketRegime(regimeProbe.features) : null;
  const rows = strategies.map(strategy => {
    const defaults = getStrategyRiskDefaults(strategy);
    const samples = generateEntrySamples(candles, strategy, defaults.atrSlMult, defaults.atrTpMult, defaults.lookforward, labelMode);
    const featureImportance = computeFeatureImportance(samples);
    const diagnostics = computeTrainingDiagnostics(samples, featureImportance);
    const validation = computeOutOfSampleValidation(samples);
    const regimeStats = computeRegimeStats(samples);
    const regimeStat = currentRegime ? regimeStats.find(x => x.regime === currentRegime) : undefined;
    const wins = samples.filter(s => s.label === "win").length;
    const losses = samples.filter(s => s.label === "loss").length;
    const resolved = wins + losses;
    const winRate = resolved > 0 ? wins / resolved : 0;
    const avgRMultiple = samples.reduce((sum, s) => sum + s.rMultiple, 0) / Math.max(1, samples.length);
    const qualityBonus = diagnostics.quality === "strong" ? 8 : diagnostics.quality === "usable" ? 3 : diagnostics.quality === "weak" ? -6 : -14;
    const sampleFactor = clamp(samples.length / 180, 0.35, 1);
    const regimeBonus = regimeStat && regimeStat.sampleCount >= 12 ? clamp((regimeStat.winRate - 0.5) * 18 + regimeStat.avgRMultiple * 8, -10, 12) : -4;
    // 實戰保守緩衝：OOS 平均 R 太低時，扣除手續費、滑價與訊號延遲後可能沒有淨 edge。
    const feeSlipBufferR = 0.08;
    const netEdgePenalty = validation.oosAvgRMultiple < feeSlipBufferR ? clamp((feeSlipBufferR - validation.oosAvgRMultiple) * 120, 0, 14) : 0;
    const reliabilityScore = Math.round(clamp((validation.edgeScore * 0.68 + winRate * 18 + clamp((avgRMultiple + 1) / 2, 0, 1) * 14) * sampleFactor + qualityBonus + regimeBonus - validation.overfitRisk * 0.18 - netEdgePenalty, 0, 100));
    const hasPracticalEdge = validation.verdict !== "fragile" && validation.oosAvgRMultiple >= feeSlipBufferR && validation.predictedTradeCount >= 16 && validation.overfitRisk <= 45;
    const hasTradableRegime = !!regimeStat && regimeStat.sampleCount >= 12 && regimeStat.avgRMultiple > 0;
    const recommendation: EntryStrategyRecommendation = reliabilityScore >= 72 && hasPracticalEdge && hasTradableRegime ? "優先" : reliabilityScore >= 58 && validation.verdict !== "fragile" ? "可觀察" : reliabilityScore >= 42 ? "保守" : "避免";
    const notes = [
      `OOS ${validation.verdict}，edge ${validation.edgeScore}，overfit ${validation.overfitRisk}。`,
      regimeStat ? `${regimeLabel(regimeStat.regime)} regime 樣本 ${regimeStat.sampleCount} 筆，勝率 ${Math.round(regimeStat.winRate * 100)}%。` : "目前 regime 樣本不足。",
      validation.oosAvgRMultiple < feeSlipBufferR ? "OOS 平均 R 低於實戰費用滑價緩衝，暫不列為優先策略。" : "OOS 平均 R 已高於保守費用滑價緩衝。",
    ];
    return {
      rank: 0,
      strategy,
      sampleCount: samples.length,
      winRate: round(winRate, 4),
      avgRMultiple: round(avgRMultiple, 4),
      currentRegime,
      regimeSampleCount: regimeStat?.sampleCount ?? 0,
      regimeWinRate: regimeStat ? regimeStat.winRate : null,
      regimeAvgRMultiple: regimeStat ? regimeStat.avgRMultiple : null,
      trainingQuality: diagnostics.quality,
      validation,
      reliabilityScore,
      recommendation,
      notes,
    };
  }).sort((a, b) => b.reliabilityScore - a.reliabilityScore).map((row, idx) => ({ ...row, rank: idx + 1 }));
  return { symbol, timeframe, currentRegime, leaderboard: rows, generatedAt: new Date().toISOString() };
}
