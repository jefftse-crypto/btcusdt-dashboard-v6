/**
 * lstmPredictor.ts — LSTM 神經網路預測引擎
 * 使用歷史 K 線 + 技術指標特徵訓練 LSTM，預測未來 1 小時走勢
 */

// 使用 CommonJS require 方式載入 tfjs-node（ESM 環境下需要 createRequire）
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tf: any;
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = null;
}

import type { Candle } from "./analysis.js";
import {
  calcRsiArr,
  calcMacdArr,
  calcEmaArr,
  calcAtrArr,
  calcBollingerArr,
  calcAdxArr,
  calcCmfArr,
  calcSupertrend,
} from "./utils/indicators.js";

// ─── 常數 ──────────────────────────────────────────────────────────────────
const LOOKBACK = 60;        // 用過去 60 根 K 線作為輸入序列
const FEATURE_COUNT = 14;   // 每根 K 線的特徵數量
const EPOCHS = 30;          // 訓練輪數
const BATCH_SIZE = 32;
const HIDDEN_UNITS = 64;

// ─── 型別 ──────────────────────────────────────────────────────────────────
export interface LstmPrediction {
  symbol: string;
  timeframe: string;
  timestamp: number;
  direction: "bullish" | "bearish" | "neutral";
  bullProb: number;        // 多頭概率 0–1
  bearProb: number;        // 空頭概率 0–1
  neutralProb: number;     // 震盪概率 0–1
  predictedClose: number;  // 預測收盤價
  priceRangeLow: number;   // 預測價格區間下限
  priceRangeHigh: number;  // 預測價格區間上限
  confidence: number;      // 信心指數 0–100
  trainedOn: number;       // 訓練資料根數
  accuracy: number;        // 回測準確率 0–1
  modelVersion: string;
  trainedAt: number;       // 訓練完成時間戳
}

export interface TrainResult {
  accuracy: number;
  loss: number;
  epochs: number;
  trainSamples: number;
  durationMs: number;
}

// ─── 特徵工程 ──────────────────────────────────────────────────────────────
/**
 * 從 K 線陣列提取標準化特徵矩陣
 * 特徵：[return, rsi_norm, macd_norm, bb_pos, ema_cross, atr_norm, adx_norm, cmf, supertrend_dir, vol_norm, hl_range, body_ratio, upper_shadow, lower_shadow]
 */
function extractFeatures(candles: Candle[]): number[][] {
  const closes = candles.map(c => c.close);
  const highs  = candles.map(c => c.high);
  const lows   = candles.map(c => c.low);
  const opens  = candles.map(c => c.open);
  const vols   = candles.map(c => c.volume);

  const rsiArr  = calcRsiArr(closes, 14);
  const macdObj = calcMacdArr(closes);
  const ema20   = calcEmaArr(closes, 20);
  const ema50   = calcEmaArr(closes, 50);
  const atrArr  = calcAtrArr(candles, 14);
  const adxObj  = calcAdxArr(candles, 14);
  const bbArr   = calcBollingerArr(closes, 20, 2);
  const cmfArr  = calcCmfArr(candles, 20);
  const stArr   = calcSupertrend(candles, 10, 3);

  // 計算成交量的滾動均值（20 期）用於標準化
  const volMa20 = calcEmaArr(vols, 20);

  const features: number[][] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = i > 0 ? candles[i - 1].close : c.close;

    // 1. 價格回報率（標準化到 -1~1，±5% 範圍）
    const ret = Math.max(-1, Math.min(1, (c.close - prevClose) / prevClose / 0.05));

    // 2. RSI 標準化（0~1）
    const rsi = isFinite(rsiArr[i]) ? rsiArr[i] / 100 : 0.5;

    // 3. MACD 標準化（相對於 ATR）
    const macd = macdObj.macd[i] ?? 0;
    const atr  = atrArr[i] > 0 ? atrArr[i] : 1;
    const macdNorm = Math.max(-2, Math.min(2, macd / atr)) / 2;

    // 4. 布林帶位置（0=下軌, 0.5=中線, 1=上軌）
    const bb = bbArr[i];
    const bbRange = bb ? (bb.upper - bb.lower) : 1;
    const bbPos = bb && bbRange > 0 ? Math.max(0, Math.min(1, (c.close - bb.lower) / bbRange)) : 0.5;

    // 5. EMA 交叉信號（-1=空頭, 0=平, 1=多頭）
    const emaCross = ema20[i] && ema50[i]
      ? Math.max(-1, Math.min(1, (ema20[i] - ema50[i]) / (ema50[i] * 0.02)))
      : 0;

    // 6. ATR 標準化（相對於收盤價，0~1）
    const atrNorm = Math.min(1, atr / c.close * 100);

    // 7. ADX 標準化（0~1）
    const adx = adxObj.adx[i] ?? 25;
    const adxNorm = Math.min(1, adx / 100);

    // 8. CMF（-1~1）
    const cmf = Math.max(-1, Math.min(1, cmfArr[i] ?? 0));

    // 9. Supertrend 方向（-1=空, 1=多）
    const stDir = stArr[i]?.direction === "up" ? 1 : -1;

    // 10. 成交量相對強度（0~2，1=均值）
    const volNorm = Math.min(2, vols[i] / (volMa20[i] || vols[i] || 1));

    // 11. 高低振幅（相對 ATR）
    const hlRange = Math.min(3, (c.high - c.low) / atr);

    // 12. 實體比例（0=十字星, 1=大陽/陰線）
    const bodyRatio = Math.abs(c.close - c.open) / (c.high - c.low || 1);

    // 13. 上影線比例
    const upperShadow = (c.high - Math.max(c.open, c.close)) / (c.high - c.low || 1);

    // 14. 下影線比例
    const lowerShadow = (Math.min(c.open, c.close) - c.low) / (c.high - c.low || 1);

    features.push([
      ret, rsi, macdNorm, bbPos, emaCross,
      atrNorm, adxNorm, cmf, stDir, volNorm,
      hlRange, bodyRatio, upperShadow, lowerShadow,
    ]);
  }

  return features;
}

/**
 * 建立訓練樣本：X = 過去 LOOKBACK 根的特徵序列, Y = 下一根 K 線的方向
 * Y: 0=bearish(<-0.3%), 1=neutral, 2=bullish(>+0.3%)
 */
function buildDataset(candles: Candle[]): { xs: number[][][]; ys: number[] } {
  const features = extractFeatures(candles);
  const xs: number[][][] = [];
  const ys: number[] = [];
  const THRESHOLD = 0.003; // 0.3% 閾值

  for (let i = LOOKBACK; i < candles.length - 1; i++) {
    const seq = features.slice(i - LOOKBACK, i);
    xs.push(seq);

    const currClose = candles[i].close;
    const nextClose = candles[i + 1].close;
    const ret = (nextClose - currClose) / currClose;

    if (ret > THRESHOLD) ys.push(2);        // bullish
    else if (ret < -THRESHOLD) ys.push(0);  // bearish
    else ys.push(1);                         // neutral
  }

  return { xs, ys };
}

// ─── 模型定義 ──────────────────────────────────────────────────────────────
function buildModel(): unknown {
  const model = tf.sequential();

  model.add(tf.layers.lstm({
    units: HIDDEN_UNITS,
    inputShape: [LOOKBACK, FEATURE_COUNT],
    returnSequences: true,
    dropout: 0.2,
    recurrentDropout: 0.1,
  }));

  model.add(tf.layers.lstm({
    units: 32,
    returnSequences: false,
    dropout: 0.2,
  }));

  model.add(tf.layers.dense({ units: 16, activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({ units: 3, activation: "softmax" }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "sparseCategoricalCrossentropy",
    metrics: ["accuracy"],
  });

  return model;
}

// ─── 模型快取 ──────────────────────────────────────────────────────────────
interface ModelCache {
  model: unknown;
  trainResult: TrainResult;
  features: number[][];  // 最後 LOOKBACK 根的特徵（用於推理）
  lastCandles: Candle[]; // 最後的 K 線（用於計算預測價格）
  trainedAt: number;
}

const modelCache = new Map<string, ModelCache>();
const RETRAIN_INTERVAL = 2 * 60 * 60 * 1000; // 每 2 小時重新訓練

// ─── 訓練函數 ──────────────────────────────────────────────────────────────
export async function trainLstm(
  symbol: string,
  timeframe: string,
  candles: Candle[]
): Promise<TrainResult> {
  if (!tf) throw new Error("TensorFlow.js 未安裝");
  if (candles.length < LOOKBACK + 50) {
    throw new Error(`K 線數量不足，需要至少 ${LOOKBACK + 50} 根，目前 ${candles.length} 根`);
  }

  const startTime = Date.now();
  const { xs, ys } = buildDataset(candles);

  // 分割訓練集和驗證集（80/20）
  const splitIdx = Math.floor(xs.length * 0.8);
  const xTrain = xs.slice(0, splitIdx);
  const yTrain = ys.slice(0, splitIdx);
  const xVal   = xs.slice(splitIdx);
  const yVal   = ys.slice(splitIdx);

  const xTrainTensor = tf.tensor3d(xTrain);
  const yTrainTensor = tf.tensor1d(yTrain, "int32");
  const xValTensor   = tf.tensor3d(xVal);
  const yValTensor   = tf.tensor1d(yVal, "int32");

  const model = buildModel();

  let finalAcc = 0;
  let finalLoss = 0;

  await (model as { fit: Function }).fit(xTrainTensor, yTrainTensor, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    validationData: [xValTensor, yValTensor],
    verbose: 0,
    callbacks: {
      onEpochEnd: (_epoch: number, logs: Record<string, number>) => {
        finalAcc  = logs?.val_acc  ?? logs?.val_accuracy ?? 0;
        finalLoss = logs?.val_loss ?? 0;
      },
    },
  });

  // 計算驗證集準確率
  const predTensor = (model as { predict: Function }).predict(xValTensor) as unknown;
  const predArray  = (predTensor as { argMax: Function }).argMax(1).dataSync() as Int32Array;
  let correct = 0;
  for (let i = 0; i < predArray.length; i++) {
    if (predArray[i] === yVal[i]) correct++;
  }
  const accuracy = correct / predArray.length;

  // 儲存特徵（最後 LOOKBACK 根，用於推理）
  const allFeatures = extractFeatures(candles);
  const lastFeatures = allFeatures.slice(-LOOKBACK);

  // 清理 tensor
  xTrainTensor.dispose();
  yTrainTensor.dispose();
  xValTensor.dispose();
  yValTensor.dispose();

  const trainResult: TrainResult = {
    accuracy,
    loss: finalLoss,
    epochs: EPOCHS,
    trainSamples: xTrain.length,
    durationMs: Date.now() - startTime,
  };

  const cacheKey = `${symbol}_${timeframe}`;
  modelCache.set(cacheKey, {
    model,
    trainResult,
    features: lastFeatures,
    lastCandles: candles.slice(-LOOKBACK - 1),
    trainedAt: Date.now(),
  });

  console.log(`[LSTM] ${cacheKey} 訓練完成 | 準確率: ${(accuracy * 100).toFixed(1)}% | 耗時: ${trainResult.durationMs}ms`);
  return trainResult;
}

// ─── 推理函數 ──────────────────────────────────────────────────────────────
export async function predictLstm(
  symbol: string,
  timeframe: string,
  candles: Candle[]
): Promise<LstmPrediction> {
  if (!tf) throw new Error("TensorFlow.js 未安裝");

  const cacheKey = `${symbol}_${timeframe}`;
  let cache = modelCache.get(cacheKey);

  // 若無快取或超過重訓間隔，重新訓練
  const needRetrain = !cache || (Date.now() - cache.trainedAt > RETRAIN_INTERVAL);
  if (needRetrain) {
    await trainLstm(symbol, timeframe, candles);
    cache = modelCache.get(cacheKey)!;
  } else {
    // 更新最新特徵（使用最新 K 線）
    const allFeatures = extractFeatures(candles);
    cache.features = allFeatures.slice(-LOOKBACK);
    cache.lastCandles = candles.slice(-LOOKBACK - 1);
  }

  const { model, trainResult, features, lastCandles } = cache;

  // 推理
  const inputTensor = tf.tensor3d([features]);
  const predTensor  = (model as { predict: Function }).predict(inputTensor) as unknown;
  const probs       = Array.from((predTensor as { dataSync: Function }).dataSync() as Float32Array) as number[];
  inputTensor.dispose();

  const [bearProb, neutralProb, bullProb] = probs;

  // 決定方向
  let direction: "bullish" | "bearish" | "neutral";
  if (bullProb > bearProb && bullProb > neutralProb) direction = "bullish";
  else if (bearProb > bullProb && bearProb > neutralProb) direction = "bearish";
  else direction = "neutral";

  // 信心指數：最高概率與第二高概率的差距
  const sorted = [...probs].sort((a, b) => b - a);
  const confidence = Math.round((sorted[0] - sorted[1]) * 100 + 50);

  // 預測價格：基於方向和 ATR 估算
  const lastClose = lastCandles[lastCandles.length - 1]?.close ?? 0;
  const atrArr = calcAtrArr(lastCandles, 14);
  const atr = atrArr[atrArr.length - 1] ?? lastClose * 0.005;

  let predictedClose: number;
  if (direction === "bullish") predictedClose = lastClose + atr * bullProb * 1.5;
  else if (direction === "bearish") predictedClose = lastClose - atr * bearProb * 1.5;
  else predictedClose = lastClose + atr * (bullProb - bearProb) * 0.5;

  const priceRangeLow  = predictedClose - atr * 1.0;
  const priceRangeHigh = predictedClose + atr * 1.0;

  return {
    symbol,
    timeframe,
    timestamp: Date.now(),
    direction,
    bullProb: parseFloat(bullProb.toFixed(4)),
    bearProb: parseFloat(bearProb.toFixed(4)),
    neutralProb: parseFloat(neutralProb.toFixed(4)),
    predictedClose: parseFloat(predictedClose.toFixed(2)),
    priceRangeLow: parseFloat(priceRangeLow.toFixed(2)),
    priceRangeHigh: parseFloat(priceRangeHigh.toFixed(2)),
    confidence: Math.max(0, Math.min(100, confidence)),
    trainedOn: trainResult.trainSamples,
    accuracy: parseFloat(trainResult.accuracy.toFixed(4)),
    modelVersion: "LSTM-v1.0",
    trainedAt: cache.trainedAt,
  };
}

// ─── 快取清理 ──────────────────────────────────────────────────────────────
export function clearModelCache(symbol?: string, timeframe?: string): void {
  if (symbol && timeframe) {
    modelCache.delete(`${symbol}_${timeframe}`);
  } else {
    modelCache.clear();
  }
}

export function getModelStatus(symbol: string, timeframe: string): {
  trained: boolean;
  trainedAt?: number;
  accuracy?: number;
  trainSamples?: number;
} {
  const cache = modelCache.get(`${symbol}_${timeframe}`);
  if (!cache) return { trained: false };
  return {
    trained: true,
    trainedAt: cache.trainedAt,
    accuracy: cache.trainResult.accuracy,
    trainSamples: cache.trainResult.trainSamples,
  };
}
