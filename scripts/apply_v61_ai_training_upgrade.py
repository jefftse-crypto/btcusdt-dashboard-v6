from pathlib import Path

root = Path('/home/ubuntu/btcusdt_dashboard_v6')
lstm_path = root / 'server/lstmPredictor.ts'
panel_path = root / 'client/src/components/panels/AIPredictionPanel.tsx'

s = lstm_path.read_text()

s = s.replace('import type { Candle } from "./analysis.js";\n', 'import path from "node:path";\nimport { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";\nimport type { Candle } from "./analysis.js";\n')

s = s.replace('const HIDDEN_UNITS = 64;\n', 'const HIDDEN_UNITS = 64;\nconst MODEL_VERSION = "LSTM-v1.1-persisted";\nconst MODEL_ROOT = process.env.LSTM_MODEL_DIR\n  ? path.resolve(process.env.LSTM_MODEL_DIR)\n  : path.resolve(process.cwd(), "runtime", "lstm_models");\n')

s = s.replace('  modelVersion: string;\n  trainedAt: number;       // 訓練完成時間戳\n}\n\nexport interface TrainResult {', '  modelVersion: string;\n  trainedAt: number;       // 訓練完成時間戳\n}\n\nexport interface ModelStatus {\n  trained: boolean;\n  persisted?: boolean;\n  stale?: boolean;\n  modelVersion?: string;\n  trainedAt?: number;\n  expiresAt?: number;\n  nextRetrainInMs?: number;\n  accuracy?: number;\n  loss?: number;\n  epochs?: number;\n  trainSamples?: number;\n  durationMs?: number;\n  dataStartTime?: number | string | null;\n  dataEndTime?: number | string | null;\n  modelPath?: string;\n}\n\ninterface PersistedModelMetadata {\n  cacheKey: string;\n  symbol: string;\n  timeframe: string;\n  modelVersion: string;\n  trainedAt: number;\n  trainResult: TrainResult;\n  features: number[][];\n  lastCandles: Candle[];\n  dataStartTime?: number | string | null;\n  dataEndTime?: number | string | null;\n  lookback: number;\n  featureCount: number;\n  epochs: number;\n}\n\nexport interface TrainResult {')

insert_after = 'const modelCache = new Map<string, ModelCache>();\nconst RETRAIN_INTERVAL = 2 * 60 * 60 * 1000; // 每 2 小時重新訓練\n'
helpers = r'''

function getCacheKey(symbol: string, timeframe: string): string {
  return `${symbol}_${timeframe}`;
}

function getModelDir(cacheKey: string): string {
  return path.join(MODEL_ROOT, cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_"));
}

function getMetadataPath(cacheKey: string): string {
  return path.join(getModelDir(cacheKey), "metadata.json");
}

function candleTime(candle: Candle | undefined): number | string | null {
  if (!candle) return null;
  const c = candle as unknown as Record<string, unknown>;
  const value = c.time ?? c.timestamp ?? c.openTime ?? null;
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function buildMetadata(cacheKey: string, symbol: string, timeframe: string, trainResult: TrainResult, features: number[][], lastCandles: Candle[], trainedAt: number, candles: Candle[]): PersistedModelMetadata {
  return {
    cacheKey,
    symbol,
    timeframe,
    modelVersion: MODEL_VERSION,
    trainedAt,
    trainResult,
    features,
    lastCandles,
    dataStartTime: candleTime(candles[0]),
    dataEndTime: candleTime(candles[candles.length - 1]),
    lookback: LOOKBACK,
    featureCount: FEATURE_COUNT,
    epochs: EPOCHS,
  };
}

async function persistModel(cacheKey: string, model: unknown, metadata: PersistedModelMetadata): Promise<void> {
  const modelDir = getModelDir(cacheKey);
  rmSync(modelDir, { recursive: true, force: true });
  mkdirSync(modelDir, { recursive: true });
  await (model as { save: (url: string) => Promise<unknown> }).save(`file://${modelDir}`);
  writeFileSync(getMetadataPath(cacheKey), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(`[LSTM] ${cacheKey} 模型已持久化：${modelDir}`);
}

function readModelMetadata(cacheKey: string): PersistedModelMetadata | null {
  const metadataPath = getMetadataPath(cacheKey);
  if (!existsSync(metadataPath)) return null;
  try {
    return JSON.parse(readFileSync(metadataPath, "utf8")) as PersistedModelMetadata;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[LSTM] ${cacheKey} metadata 讀取失敗：${msg}`);
    return null;
  }
}

async function loadPersistedModel(cacheKey: string): Promise<ModelCache | null> {
  if (!tf) return null;
  const metadata = readModelMetadata(cacheKey);
  if (!metadata) return null;
  const modelJsonPath = path.join(getModelDir(cacheKey), "model.json");
  if (!existsSync(modelJsonPath)) return null;
  try {
    const model = await tf.loadLayersModel(`file://${modelJsonPath}`);
    const cache: ModelCache = {
      model,
      trainResult: metadata.trainResult,
      features: metadata.features,
      lastCandles: metadata.lastCandles,
      trainedAt: metadata.trainedAt,
    };
    modelCache.set(cacheKey, cache);
    console.log(`[LSTM] ${cacheKey} 已從磁碟載入模型`);
    return cache;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[LSTM] ${cacheKey} 模型載入失敗，將重新訓練：${msg}`);
    return null;
  }
}

function toModelStatus(cacheKey: string, cache: ModelCache | null, metadata: PersistedModelMetadata | null): ModelStatus {
  const trainedAt = cache?.trainedAt ?? metadata?.trainedAt;
  if (!trainedAt) return { trained: false, persisted: Boolean(metadata) };
  const trainResult = cache?.trainResult ?? metadata?.trainResult;
  const ageMs = Date.now() - trainedAt;
  const expiresAt = trainedAt + RETRAIN_INTERVAL;
  return {
    trained: true,
    persisted: Boolean(metadata),
    stale: ageMs > RETRAIN_INTERVAL,
    modelVersion: metadata?.modelVersion ?? MODEL_VERSION,
    trainedAt,
    expiresAt,
    nextRetrainInMs: Math.max(0, expiresAt - Date.now()),
    accuracy: trainResult?.accuracy,
    loss: trainResult?.loss,
    epochs: trainResult?.epochs,
    trainSamples: trainResult?.trainSamples,
    durationMs: trainResult?.durationMs,
    dataStartTime: metadata?.dataStartTime,
    dataEndTime: metadata?.dataEndTime,
    modelPath: getModelDir(cacheKey),
  };
}
'''
if helpers not in s:
    s = s.replace(insert_after, insert_after + helpers)

s = s.replace('  const cacheKey = `${symbol}_${timeframe}`;\n  modelCache.set(cacheKey, {\n    model,\n    trainResult,\n    features: lastFeatures,\n    lastCandles: candles.slice(-LOOKBACK - 1),\n    trainedAt: Date.now(),\n  });\n\n  console.log(`[LSTM] ${cacheKey} 訓練完成 | 準確率: ${(accuracy * 100).toFixed(1)}% | 耗時: ${trainResult.durationMs}ms`);\n  return trainResult;\n}', '  const cacheKey = getCacheKey(symbol, timeframe);\n  const trainedAt = Date.now();\n  const lastCandles = candles.slice(-LOOKBACK - 1);\n  modelCache.set(cacheKey, {\n    model,\n    trainResult,\n    features: lastFeatures,\n    lastCandles,\n    trainedAt,\n  });\n\n  const metadata = buildMetadata(cacheKey, symbol, timeframe, trainResult, lastFeatures, lastCandles, trainedAt, candles);\n  await persistModel(cacheKey, model, metadata);\n\n  console.log(`[LSTM] ${cacheKey} 訓練完成 | 準確率: ${(accuracy * 100).toFixed(1)}% | 耗時: ${trainResult.durationMs}ms`);\n  return trainResult;\n}')

s = s.replace('  const cacheKey = `${symbol}_${timeframe}`;\n  let cache = modelCache.get(cacheKey);\n\n  // 若無快取或超過重訓間隔，重新訓練\n  const needRetrain = !cache || (Date.now() - cache.trainedAt > RETRAIN_INTERVAL);', '  const cacheKey = getCacheKey(symbol, timeframe);\n  let cache = modelCache.get(cacheKey) ?? await loadPersistedModel(cacheKey);\n\n  // 若無快取或超過重訓間隔，重新訓練\n  const needRetrain = !cache || (Date.now() - cache.trainedAt > RETRAIN_INTERVAL);')

s = s.replace('    modelVersion: "LSTM-v1.0",\n', '    modelVersion: MODEL_VERSION,\n')

s = s.replace('export function clearModelCache(symbol?: string, timeframe?: string): void {\n  if (symbol && timeframe) {\n    modelCache.delete(`${symbol}_${timeframe}`);\n  } else {\n    modelCache.clear();\n  }\n}\n\nexport function getModelStatus(symbol: string, timeframe: string): {\n  trained: boolean;\n  trainedAt?: number;\n  accuracy?: number;\n  trainSamples?: number;\n} {\n  const cache = modelCache.get(`${symbol}_${timeframe}`);\n  if (!cache) return { trained: false };\n  return {\n    trained: true,\n    trainedAt: cache.trainedAt,\n    accuracy: cache.trainResult.accuracy,\n    trainSamples: cache.trainResult.trainSamples,\n  };\n}\n', 'export function clearModelCache(symbol?: string, timeframe?: string): void {\n  if (symbol && timeframe) {\n    const cacheKey = getCacheKey(symbol, timeframe);\n    modelCache.delete(cacheKey);\n    rmSync(getModelDir(cacheKey), { recursive: true, force: true });\n  } else {\n    modelCache.clear();\n    rmSync(MODEL_ROOT, { recursive: true, force: true });\n  }\n}\n\nexport function getModelStatus(symbol: string, timeframe: string): ModelStatus {\n  const cacheKey = getCacheKey(symbol, timeframe);\n  const cache = modelCache.get(cacheKey) ?? null;\n  const metadata = readModelMetadata(cacheKey);\n  return toModelStatus(cacheKey, cache, metadata);\n}\n')

lstm_path.write_text(s)

p = panel_path.read_text()
p = p.replace('import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle, Clock, Cpu } from "lucide-react";', 'import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle, Clock, Cpu, Database, HardDrive, TimerReset } from "lucide-react";')

p = p.replace('  const [forceRetrainOnce, setForceRetrainOnce] = useState(false);\n', '  const [forceRetrainOnce, setForceRetrainOnce] = useState(false);\n\n  const formatTime = (ts?: number | string | null) => {\n    if (!ts) return "--";\n    const n = typeof ts === "number" ? ts : Number(ts);\n    const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(ts));\n    return Number.isNaN(d.getTime()) ? "--" : d.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });\n  };\n\n  const formatDuration = (ms?: number | null) => {\n    if (!ms || ms <= 0) return "--";\n    const mins = Math.floor(ms / 60000);\n    const hrs = Math.floor(mins / 60);\n    if (hrs > 0) return `${hrs}小時${mins % 60}分`;\n    if (mins > 0) return `${mins}分`;\n    return `${Math.max(1, Math.round(ms / 1000))}秒`;\n  };\n')

p = p.replace('  // 查詢 AI 預測\n  const {', '  const {\n    data: modelStatus,\n    refetch: refetchStatus,\n  } = trpc.ai.status.useQuery(\n    { symbol, timeframe: selectedTf },\n    { staleTime: 60 * 1000, refetchInterval: 60 * 1000 }\n  );\n\n  // 查詢 AI 預測\n  const {')

p = p.replace('      onSuccess: () => {\n        if (forceRetrainOnce) setForceRetrainOnce(false);\n      }', '      onSuccess: () => {\n        if (forceRetrainOnce) setForceRetrainOnce(false);\n        refetchStatus();\n      }')

p = p.replace('      await refetch();\n    } finally {', '      await refetch();\n      await refetchStatus();\n    } finally {')

p = p.replace('  const isWorking = isLoading || isFetching || isRetraining;\n', '  const isWorking = isLoading || isFetching || isRetraining;\n  const statusAccuracyPct = modelStatus?.accuracy !== undefined ? Math.round(modelStatus.accuracy * 100) : null;\n  const statusStale = Boolean(modelStatus?.stale);\n')

p = p.replace('      {/* ── 預測結果 ───────────────────────────────────────────────────── */}\n', '      {/* ── 模型狀態 ───────────────────────────────────────────────────── */}\n      <div className="p-3 rounded-xl border border-[#252b3a] bg-[#141820] space-y-2">\n        <div className="flex items-center justify-between">\n          <div className="flex items-center gap-2 text-[10px] text-[#8896b0] uppercase font-bold tracking-wider">\n            <Database size={12} />\n            模型狀態\n          </div>\n          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${modelStatus?.trained ? (statusStale ? "text-[#f5a623] bg-[#f5a623]/10" : "text-[#26d48a] bg-[#26d48a]/10") : "text-[#8896b0] bg-white/5"}`}>\n            {modelStatus?.trained ? (statusStale ? "需重訓" : "可用") : "未訓練"}\n          </span>\n        </div>\n        <div className="grid grid-cols-2 gap-2 text-[10px]">\n          <div className="rounded-lg bg-[#1c2030] p-2">\n            <div className="flex items-center gap-1 text-[#8896b0]"><Clock size={11} />上次訓練</div>\n            <div className="mt-1 font-mono text-[#e2e8f0]">{formatTime(modelStatus?.trainedAt)}</div>\n          </div>\n          <div className="rounded-lg bg-[#1c2030] p-2">\n            <div className="flex items-center gap-1 text-[#8896b0]"><TimerReset size={11} />下次重訓</div>\n            <div className="mt-1 font-mono text-[#e2e8f0]">{formatDuration(modelStatus?.nextRetrainInMs)}</div>\n          </div>\n          <div className="rounded-lg bg-[#1c2030] p-2">\n            <div className="flex items-center gap-1 text-[#8896b0]"><HardDrive size={11} />持久化</div>\n            <div className="mt-1 font-mono text-[#e2e8f0]">{modelStatus?.persisted ? "磁碟已保存" : "僅記憶體 / 尚無"}</div>\n          </div>\n          <div className="rounded-lg bg-[#1c2030] p-2">\n            <div className="text-[#8896b0]">驗證準確率</div>\n            <div className="mt-1 font-mono text-[#e2e8f0]">{statusAccuracyPct !== null ? `${statusAccuracyPct}%` : "--"}</div>\n          </div>\n        </div>\n        {modelStatus?.modelVersion && (\n          <div className="text-[9px] text-[#8896b0] truncate">版本：{modelStatus.modelVersion} · 樣本：{modelStatus.trainSamples ?? "--"} · 訓練耗時：{formatDuration(modelStatus.durationMs)}</div>\n        )}\n      </div>\n\n      {/* ── 預測結果 ───────────────────────────────────────────────────── */}\n')

panel_path.write_text(p)
print('v6.1 AI training upgrade applied')
