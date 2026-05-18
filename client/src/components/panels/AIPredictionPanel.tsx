/**
 * AIPredictionPanel.tsx — LSTM AI 預測面板
 * 顯示未來 1 小時方向概率、預測價格區間、信心指數
 */

import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle, Clock, Cpu, Database, HardDrive, TimerReset } from "lucide-react";

interface AIPredictionPanelProps {
  symbol: string;
  timeframe?: string;
  currentPrice?: number | null;
}

type EntryStrategy = "ema_cross" | "rsi_reversal" | "bollinger" | "macd" | "smc" | "pa" | "chan" | "liquidity_sweep" | "vwap_reversion" | "composite" | "cannonball" | "hwr_model_a" | "hwr_model_b" | "hwr_model_c" | "v8_hybrid";
type EntryLabelMode = "conservative" | "optimistic" | "ohlc_path";

const ENTRY_LABEL_MODES: Array<{ value: EntryLabelMode; label: string; hint: string }> = [
  { value: "conservative", label: "保守", hint: "同根同時碰 TP/SL 時先算 SL" },
  { value: "ohlc_path", label: "OHLC 路徑", hint: "依 K 線開收與距離推估先後" },
  { value: "optimistic", label: "樂觀", hint: "同根同時碰 TP/SL 時先算 TP" },
];

const ENTRY_STRATEGIES: Array<{ value: EntryStrategy; label: string }> = [
  { value: "v8_hybrid", label: "V8 Hybrid" },
  { value: "composite", label: "Composite" },
  { value: "cannonball", label: "Cannonball" },
  { value: "smc", label: "SMC" },
  { value: "liquidity_sweep", label: "Liquidity Sweep" },
  { value: "pa", label: "PA" },
  { value: "chan", label: "纏論" },
  { value: "ema_cross", label: "EMA Cross" },
  { value: "rsi_reversal", label: "RSI Reversal" },
  { value: "bollinger", label: "Bollinger" },
  { value: "macd", label: "MACD" },
  { value: "vwap_reversion", label: "VWAP Reversion" },
  { value: "hwr_model_a", label: "HWR-A" },
  { value: "hwr_model_b", label: "HWR-B" },
  { value: "hwr_model_c", label: "HWR-C" },
];

// ─── 圓形進度條元件 ───────────────────────────────────────────────────────
function CircleProgress({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#252b3a" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

// ─── 概率條元件 ───────────────────────────────────────────────────────────
function ProbBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5" style={{ color }}>
          {icon}
          <span className="font-semibold">{label}</span>
        </div>
        <span className="font-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#252b3a" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── 主元件 ──────────────────────────────────────────────────────────────
export function AIPredictionPanel({ symbol, timeframe = "1h", currentPrice }: AIPredictionPanelProps) {
  // 確保初始 timeframe 是小寫且符合 enum
  const normalizeTf = (tf: string): "1h" | "4h" | "15m" | "5m" => {
    const lower = tf.toLowerCase();
    if (["1h", "4h", "15m", "5m"].includes(lower)) return lower as any;
    return "1h";
  };

  const [selectedTf, setSelectedTf] = useState<"1h" | "4h" | "15m" | "5m">(normalizeTf(timeframe));
  const [entryStrategy, setEntryStrategy] = useState<EntryStrategy>("v8_hybrid");
  const [entryLabelMode, setEntryLabelMode] = useState<EntryLabelMode>("conservative");
  const [isRetraining, setIsRetraining] = useState(false);
  const [forceRetrainOnce, setForceRetrainOnce] = useState(false);
  const [forceEntryRetrainOnce, setForceEntryRetrainOnce] = useState(false);

  const formatTime = (ts?: number | string | null) => {
    if (!ts) return "--";
    const n = typeof ts === "number" ? ts : Number(ts);
    const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(ts));
    return Number.isNaN(d.getTime()) ? "--" : d.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const toMs = (ts?: number | string | null) => {
    if (!ts) return null;
    const n = typeof ts === "number" ? ts : Number(ts);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    const parsed = new Date(String(ts)).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };

  const formatDuration = (ms?: number | null) => {
    if (ms == null) return "--";
    if (ms <= 0) return "已到期 / 下次查詢會更新";
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}小時${mins % 60}分`;
    if (mins > 0) return `${mins}分`;
    return `${Math.max(1, Math.round(ms / 1000))}秒`;
  };

  const timeframeMs = (tf: string) => {
    switch (tf) {
      case "5m": return 5 * 60 * 1000;
      case "15m": return 15 * 60 * 1000;
      case "4h": return 4 * 60 * 60 * 1000;
      case "1h":
      default: return 60 * 60 * 1000;
    }
  };

  const estimateNextRetrainAt = (dataEndTime?: number | string | null) => {
    const endMs = toMs(dataEndTime);
    return endMs ? endMs + timeframeMs(selectedTf) : null;
  };

  // 當外部 timeframe 改變時同步
  useEffect(() => {
    setSelectedTf(normalizeTf(timeframe));
  }, [timeframe]);

  const {
    data: modelStatus,
    refetch: refetchStatus,
  } = trpc.ai.status.useQuery(
    { symbol, timeframe: selectedTf },
    { staleTime: 60 * 1000, refetchInterval: 60 * 1000 }
  );

  // 查詢 AI 預測
  const {
    data: aiDecision,
    isLoading: isDecisionLoading,
    isFetching: isDecisionFetching,
    error: decisionError,
    refetch: refetchDecision,
  } = trpc.ai.decision.useQuery(
    { symbol, timeframe: selectedTf, limit: 800 },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
    }
  );

  const {
    data: prediction,
    isLoading,
    isFetching,
    error,
    refetch,
  } = trpc.ai.predict.useQuery(
    { symbol, timeframe: selectedTf, limit: 800, forceRetrain: forceRetrainOnce },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
      // [優化] 只有當 modelStatus.trained 為 true 時才觸發預測請求，減少後端無效計算
      enabled: !!modelStatus?.trained || forceRetrainOnce,
    }
  );

  const {
    data: entryTrainerStatus,
    refetch: refetchEntryStatus,
  } = trpc.ai.entryTrainerStatus.useQuery(
    { symbol, timeframe: selectedTf, strategy: entryStrategy },
    { staleTime: 60 * 1000, refetchInterval: 2 * 60 * 1000 }
  );

  const {
    data: entryScore,
    isLoading: isEntryScoreLoading,
    isFetching: isEntryScoreFetching,
    error: entryScoreError,
    refetch: refetchEntryScore,
  } = trpc.ai.entryScore.useQuery(
    { symbol, timeframe: selectedTf, strategy: entryStrategy, limit: 3000, labelMode: entryLabelMode, forceRetrain: forceEntryRetrainOnce },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
      // [優化] 延長過期時間，減少 Render 負荷
    }
  );

  const {
    data: entryStrategyReliability,
    isFetching: isEntryReliabilityFetching,
    refetch: refetchEntryReliability,
  } = trpc.ai.entryStrategyReliability.useQuery(
    { symbol, timeframe: selectedTf, limit: 3000, labelMode: entryLabelMode },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
    }
  );

  const {
    data: forwardTestStats,
    isFetching: isForwardTestFetching,
    refetch: refetchForwardTestStats,
  } = trpc.ai.entryForwardTestStats.useQuery(
    { symbol, timeframe: selectedTf },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
    }
  );

  useEffect(() => {
    if (!prediction) return;
    if (forceRetrainOnce) setForceRetrainOnce(false);
    refetchStatus();
    refetchDecision();
  }, [prediction, forceRetrainOnce, refetchStatus, refetchDecision]);

  useEffect(() => {
    if (!entryScore) return;
    if (forceEntryRetrainOnce) setForceEntryRetrainOnce(false);
    refetchEntryStatus();
    refetchEntryReliability();
    refetchForwardTestStats();
  }, [entryScore, forceEntryRetrainOnce, refetchEntryStatus, refetchEntryReliability, refetchForwardTestStats]);

  // 強制重新訓練
  const handleRetrain = useCallback(async () => {
    setIsRetraining(true);
    setForceRetrainOnce(true);
    try {
      await refetch();
      await refetchStatus();
      await refetchDecision();
      await refetchEntryScore();
      await refetchEntryStatus();
      await refetchEntryReliability();
      await refetchForwardTestStats();
    } finally {
      setIsRetraining(false);
    }
  }, [refetch, refetchStatus, refetchDecision, refetchEntryScore, refetchEntryStatus, refetchEntryReliability, refetchForwardTestStats]);

  const isWorking = isLoading || isFetching || isRetraining;
  const statusAccuracyPct = modelStatus?.accuracy !== undefined ? Math.round(modelStatus.accuracy * 100) : null;
  const statusStale = Boolean(modelStatus?.stale);

  // ─── 方向顏色與圖示 ──────────────────────────────────────────────────
  const directionConfig = {
    bullish:  { color: "#26d48a", label: "多頭",   icon: <TrendingUp size={18} />,  bg: "rgba(38,212,138,0.1)" },
    bearish:  { color: "#f04f5e", label: "空頭",   icon: <TrendingDown size={18} />, bg: "rgba(240,79,94,0.1)" },
    neutral:  { color: "#f5a623", label: "震盪",   icon: <Minus size={18} />,       bg: "rgba(245,166,35,0.1)" },
  };
  
  const dir = prediction ? directionConfig[prediction.direction as keyof typeof directionConfig] : null;

  // ─── 信心等級 ─────────────────────────────────────────────────────────
  const confidenceLevel = prediction
    ? prediction.confidence >= 75 ? { label: "高信心", color: "#26d48a" }
    : prediction.confidence >= 55 ? { label: "中信心", color: "#f5a623" }
    : { label: "低信心", color: "#f04f5e" }
    : null;

  const aiActionColor = aiDecision?.action === "long" ? "#26d48a" : aiDecision?.action === "short" ? "#f04f5e" : "#f5a623";
  const aiRiskColor = aiDecision?.riskLevel === "low" ? "#26d48a" : aiDecision?.riskLevel === "medium" ? "#f5a623" : "#f04f5e";
  const aiDecisionWorking = isDecisionLoading || isDecisionFetching;
  const entryScoreWorking = isEntryScoreLoading || isEntryScoreFetching || isEntryReliabilityFetching;
  const entryVerdictColor = entryScore?.verdict === "進場" ? "#26d48a" : entryScore?.verdict === "小倉" ? "#5b8af5" : entryScore?.verdict === "等待" ? "#f5a623" : "#f04f5e";
  const entryDirectionColor = entryScore?.direction === "long" ? "#26d48a" : entryScore?.direction === "short" ? "#f04f5e" : "#8896b0";
  const entryThresholds = entryScore?.scoreThresholds ?? entryTrainerStatus?.scoreThresholds ?? { enter: 78, small: 62, wait: 42 };
  const entryTrainingQuality = entryScore?.trainingQuality ?? entryTrainerStatus?.trainingQuality ?? "usable";
  const entryTrainingQualityLabel = entryTrainingQuality === "strong" ? "強" : entryTrainingQuality === "usable" ? "可用" : entryTrainingQuality === "weak" ? "偏弱" : "不足";
  const entryTrainingQualityColor = entryTrainingQuality === "strong" ? "#26d48a" : entryTrainingQuality === "usable" ? "#5b8af5" : entryTrainingQuality === "weak" ? "#f5a623" : "#f04f5e";
  const entryRegimeLabel = entryScore?.marketRegime === "trend" ? "趨勢" : entryScore?.marketRegime === "range" ? "震盪" : entryScore?.marketRegime === "high_volatility" ? "高波動" : entryScore?.marketRegime === "low_volatility" ? "低波動" : "無訊號";
  const entryRegimeColor = entryScore?.marketRegime === "trend" ? "#26d48a" : entryScore?.marketRegime === "range" ? "#f5a623" : entryScore?.marketRegime === "high_volatility" ? "#f04f5e" : "#8896b0";
  const topEntryFeatures = entryScore?.topFeatures ?? entryTrainerStatus?.topFeatures ?? [];
  const entryValidation = entryScore?.validationStats ?? entryTrainerStatus?.validationStats;
  const entryValidationVerdictLabel = entryValidation?.verdict === "robust" ? "穩健" : entryValidation?.verdict === "acceptable" ? "可接受" : entryValidation?.verdict === "fragile" ? "脆弱" : "未驗證";
  const entryValidationColor = entryValidation?.verdict === "robust" ? "#26d48a" : entryValidation?.verdict === "acceptable" ? "#5b8af5" : entryValidation?.verdict === "fragile" ? "#f5a623" : "#f04f5e";
  const strategyTopRows = entryStrategyReliability?.leaderboard?.slice(0, 5) ?? [];
  const entryModelUpdatedMs = toMs(entryScore?.modelUpdatedAt ?? entryTrainerStatus?.updatedAt);
  const entryDataEndMs = toMs(entryTrainerStatus?.dataEndTime);
  const nextEntryRetrainAt = estimateNextRetrainAt(entryTrainerStatus?.dataEndTime);
  const nextEntryRetrainIn = nextEntryRetrainAt ? nextEntryRetrainAt - Date.now() : null;
  const entryModelAgeMs = entryModelUpdatedMs ? Date.now() - entryModelUpdatedMs : null;

  // ─── 準確率等級 ───────────────────────────────────────────────────────
  const accuracyPct = prediction ? Math.round(prediction.accuracy * 100) : 0;
  const accuracyColor = accuracyPct >= 60 ? "#26d48a" : accuracyPct >= 50 ? "#f5a623" : "#f04f5e";

  return (
    <div className="space-y-4 text-[#e2e8f0]">
      {/* ── 標題列 ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: "rgba(91,138,245,0.15)" }}>
            <Brain size={16} className="text-[#5b8af5]" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#e2e8f0]">LSTM AI 預測</div>
            <div className="text-[10px] text-[#8896b0]">深度學習 · 14 特徵 · 2 層 LSTM</div>
          </div>
        </div>
        <button
          onClick={() => { refetch(); refetchDecision(); refetchEntryScore(); refetchEntryStatus(); refetchEntryReliability(); refetchForwardTestStats(); }}
          disabled={isWorking}
          className="p-1.5 rounded-lg transition-colors hover:bg-[#252b3a] disabled:opacity-50"
          title="重新預測"
        >
          <RefreshCw size={14} className={`text-[#8896b0] ${isWorking ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── 時間框架選擇 ───────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: "#141820" }}>
        {(["5m", "15m", "1h", "4h"] as const).map(tf => (
          <button
            key={tf}
            onClick={() => setSelectedTf(tf)}
            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${
              selectedTf === tf
                ? "text-[#e2e8f0] shadow-sm"
                : "text-[#8896b0] hover:text-[#e2e8f0]"
            }`}
            style={selectedTf === tf ? { background: "#5b8af5" } : {}}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── 模型狀態 ───────────────────────────────────────────────────── */}
      <div className="p-3 rounded-xl border border-[#252b3a] bg-[#141820] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-[#8896b0] uppercase font-bold tracking-wider">
            <Database size={12} />
            模型狀態
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${modelStatus?.trained ? (statusStale ? "text-[#f5a623] bg-[#f5a623]/10" : "text-[#26d48a] bg-[#26d48a]/10") : "text-[#8896b0] bg-white/5"}`}>
            {modelStatus?.trained ? (statusStale ? "需重訓" : "可用") : "未訓練"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg bg-[#1c2030] p-2">
            <div className="flex items-center gap-1 text-[#8896b0]"><Clock size={11} />上次訓練</div>
            <div className="mt-1 font-mono text-[#e2e8f0]">{formatTime(modelStatus?.trainedAt)}</div>
          </div>
          <div className="rounded-lg bg-[#1c2030] p-2">
            <div className="flex items-center gap-1 text-[#8896b0]"><TimerReset size={11} />下次重訓</div>
            <div className="mt-1 font-mono text-[#e2e8f0]">{formatDuration(modelStatus?.nextRetrainInMs)}</div>
          </div>
          <div className="rounded-lg bg-[#1c2030] p-2">
            <div className="flex items-center gap-1 text-[#8896b0]"><HardDrive size={11} />持久化</div>
            <div className="mt-1 font-mono text-[#e2e8f0]">{modelStatus?.persisted ? "磁碟已保存" : "僅記憶體 / 尚無"}</div>
          </div>
          <div className="rounded-lg bg-[#1c2030] p-2">
            <div className="text-[#8896b0]">驗證準確率</div>
            <div className="mt-1 font-mono text-[#e2e8f0]">{statusAccuracyPct !== null ? `${statusAccuracyPct}%` : "--"}</div>
          </div>
        </div>
        {modelStatus?.modelVersion && (
          <div className="text-[9px] text-[#8896b0] truncate">版本：{modelStatus.modelVersion} · 樣本：{modelStatus.trainSamples ?? "--"} · 訓練耗時：{formatDuration(modelStatus.durationMs)}</div>
        )}
      </div>

      {/* ── 預測結果 ───────────────────────────────────────────────────── */}
      {error ? (
        <div className="p-4 rounded-xl border border-[#f04f5e]/20 bg-[#f04f5e]/5 space-y-2">
          <div className="flex items-center gap-2 text-[#f04f5e]">
            <AlertCircle size={16} />
            <span className="text-xs font-bold">預測失敗</span>
          </div>
          <div className="text-[10px] text-[#8896b0] leading-relaxed">
            {error.message || "無法獲取 AI 預測數據，請稍後再試。"}
          </div>
        </div>
      ) : isWorking && !prediction ? (
        <div className="p-8 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[#5b8af5]/20 animate-ping" />
            <div className="relative p-4 rounded-full bg-[#141820] border border-[#5b8af5]/30">
              <Cpu size={32} className="text-[#5b8af5] animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-sm font-bold text-[#e2e8f0]">LSTM 模型訓練中...</div>
            <div className="text-[10px] text-[#8896b0]">正在用 800 根 K 線訓練神經網路<br/>14 特徵 × 60 時間步 × 30 輪訓練</div>
          </div>
        </div>
      ) : prediction ? (
        <div className="space-y-4 animate-in fade-in duration-500">
          {/* 方向與信心 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-[#252b3a] bg-[#141820] flex flex-col items-center justify-center space-y-2">
              <div className="text-[10px] text-[#8896b0] uppercase font-bold tracking-wider">預測方向</div>
              <div className="flex items-center gap-2" style={{ color: dir?.color }}>
                {dir?.icon}
                <span className="text-lg font-black">{dir?.label}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-[#252b3a] bg-[#141820] flex flex-col items-center justify-center space-y-2">
              <div className="text-[10px] text-[#8896b0] uppercase font-bold tracking-wider">信心指數</div>
              <div className="text-lg font-black" style={{ color: confidenceLevel?.color }}>
                {prediction.confidence}%
              </div>
              <div className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5" style={{ color: confidenceLevel?.color }}>
                {confidenceLevel?.label}
              </div>
            </div>
          </div>

          {/* 概率分佈 */}
          <div className="p-4 rounded-xl border border-[#252b3a] bg-[#141820] space-y-4">
            <div className="text-[10px] text-[#8896b0] uppercase font-bold tracking-wider flex items-center gap-2">
              <Clock size={12} />
              未來 1 根 K 線概率分佈
            </div>
            <div className="space-y-3">
              <ProbBar label="看漲 (Bullish)" value={prediction.bullProb} color="#26d48a" icon={<TrendingUp size={14} />} />
              <ProbBar label="看跌 (Bearish)" value={prediction.bearProb} color="#f04f5e" icon={<TrendingDown size={14} />} />
              <ProbBar label="震盪 (Neutral)" value={prediction.neutralProb} color="#f5a623" icon={<Minus size={14} />} />
            </div>
          </div>

          {/* 價格預測 */}
          <div className="p-4 rounded-xl border border-[#252b3a] bg-[#141820] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-[#8896b0] uppercase font-bold tracking-wider">預測收盤價</div>
              <div className="text-xs font-mono font-bold text-[#e2e8f0]">
                ${prediction.predictedClose.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#8896b0]">
                <span>預期區間 (Low)</span>
                <span>預期區間 (High)</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#252b3a] relative">
                <div 
                  className="absolute h-full bg-[#5b8af5] rounded-full opacity-30"
                  style={{ left: '20%', right: '20%' }}
                />
                <div 
                  className="absolute h-3 w-1 bg-white top-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                  style={{ left: '50%' }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#8896b0]">
                <span>${prediction.priceRangeLow.toLocaleString()}</span>
                <span>${prediction.priceRangeHigh.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* AI 綜合判讀與交易決策 */}
          <div className="p-4 rounded-xl border border-[#5b8af5]/25 bg-gradient-to-br from-[#141820] to-[#111827] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-[#5b8af5]" />
                <div>
                  <div className="text-[10px] text-[#8896b0] uppercase font-bold tracking-wider">AI 綜合判讀</div>
                  <div className="text-[9px] text-[#64748b]">LSTM + 技術指標 + 策略中心 + SMC/PA</div>
                </div>
              </div>
              <button
                onClick={() => refetchDecision()}
                disabled={aiDecisionWorking}
                className="text-[9px] font-bold text-[#5b8af5] hover:underline disabled:opacity-50"
              >
                {aiDecisionWorking ? "判讀中..." : "重新判讀"}
              </button>
            </div>

            {decisionError ? (
              <div className="text-[10px] text-[#f04f5e] leading-relaxed">AI 綜合判讀暫時不可用：{decisionError.message}</div>
            ) : aiDecision ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[9px] text-[#8896b0]">決策</div>
                    <div className="mt-1 text-xs font-black" style={{ color: aiActionColor }}>{aiDecision.actionLabel}</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[9px] text-[#8896b0]">信心</div>
                    <div className="mt-1 text-xs font-black text-[#e2e8f0]">{aiDecision.confidence}%</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[9px] text-[#8896b0]">風險</div>
                    <div className="mt-1 text-xs font-black" style={{ color: aiRiskColor }}>{aiDecision.riskLevel === "low" ? "低" : aiDecision.riskLevel === "medium" ? "中" : "高"}</div>
                  </div>
                </div>

                <div className="rounded-lg bg-[#1c2030] p-3 text-[10px] leading-relaxed text-[#cbd5e1]">
                  {aiDecision.summary}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">進場 / 失效</div>
                    <div className="mt-1 font-mono text-[#e2e8f0]">{aiDecision.tradePlan?.entry ? `$${aiDecision.tradePlan.entry.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "等待"}</div>
                    <div className="mt-0.5 text-[9px] text-[#8896b0]">SL {aiDecision.tradePlan?.sl ? `$${aiDecision.tradePlan.sl.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">目標 / RR</div>
                    <div className="mt-1 font-mono text-[#e2e8f0]">TP1 {aiDecision.tradePlan?.tp1 ? `$${aiDecision.tradePlan.tp1.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}</div>
                    <div className="mt-0.5 text-[9px] text-[#8896b0]">RR {aiDecision.tradePlan?.rrRatio ?? "--"}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[9px] text-[#8896b0] uppercase font-bold tracking-wider">主要理由</div>
                  {(aiDecision.reasons ?? []).slice(0, 3).map((reason: string, idx: number) => (
                    <div key={idx} className="text-[10px] text-[#cbd5e1] leading-relaxed flex gap-1.5">
                      <span className="text-[#5b8af5]">{idx + 1}.</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>

                {(aiDecision.warnings?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-[#f5a623]/20 bg-[#f5a623]/5 p-2 space-y-1">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-[#f5a623]"><AlertCircle size={11} />風控提醒</div>
                    <div className="text-[10px] text-[#cbd5e1] leading-relaxed">{aiDecision.warnings[0]}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-[#8896b0]">正在整合模型、指標與策略訊號...</div>
            )}
          </div>

          {/* AI Entry Trainer 進場品質評分 */}
          <div className="p-4 rounded-xl border border-[#26d48a]/20 bg-gradient-to-br from-[#121a22] to-[#111827] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#26d48a]/10">
                  <TrendingUp size={14} className="text-[#26d48a]" />
                </div>
                <div>
                  <div className="text-[10px] text-[#8896b0] uppercase font-bold tracking-wider">AI Entry Trainer</div>
                  <div className="text-[9px] text-[#64748b]">歷史策略樣本 · TP/SL 標籤 · 進場放行評分</div>
                </div>
              </div>
              <button
                onClick={async () => { setForceEntryRetrainOnce(true); await refetchEntryScore(); await refetchEntryStatus(); }}
                disabled={entryScoreWorking}
                className="text-[9px] font-bold text-[#26d48a] hover:underline disabled:opacity-50"
              >
                {entryScoreWorking ? "評分中..." : "重新評分"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={entryStrategy}
                onChange={(e) => setEntryStrategy(e.target.value as EntryStrategy)}
                className="flex-1 rounded-lg border border-[#252b3a] bg-[#1c2030] px-2 py-1.5 text-[10px] font-bold text-[#e2e8f0] outline-none focus:border-[#26d48a]/60"
              >
                {ENTRY_STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select
                value={entryLabelMode}
                onChange={(e) => setEntryLabelMode(e.target.value as EntryLabelMode)}
                className="w-24 rounded-lg border border-[#252b3a] bg-[#1c2030] px-2 py-1.5 text-[10px] font-bold text-[#e2e8f0] outline-none focus:border-[#26d48a]/60"
                title={ENTRY_LABEL_MODES.find(m => m.value === entryLabelMode)?.hint}
              >
                {ENTRY_LABEL_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
                  <span className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded-full ${entryTrainerStatus?.trained ? "text-[#26d48a] bg-[#26d48a]/10" : "text-[#f5a623] bg-[#f5a623]/10"}`}>
                    {entryTrainerStatus?.trained ? `${entryTrainerStatus.sampleCount} 樣本` : "首訓中"}
                  </span>
                  <span className="shrink-0 text-[9px] font-bold px-2 py-1 rounded-full bg-white/5" style={{ color: entryTrainingQualityColor }}>
                    品質 {entryTrainingQualityLabel}
                  </span>
            </div>

            {entryScoreError ? (
              <div className="rounded-lg border border-[#f04f5e]/20 bg-[#f04f5e]/5 p-3 text-[10px] text-[#f04f5e] leading-relaxed">
                Entry Trainer 暫時不可用：{entryScoreError.message}
              </div>
            ) : entryScore ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#1c2030] p-2 flex flex-col items-center justify-center">
                    <div className="relative flex items-center justify-center">
                      <CircleProgress value={entryScore.score} color={entryVerdictColor} size={58} />
                      <div className="absolute text-sm font-black" style={{ color: entryVerdictColor }}>{entryScore.score}</div>
                    </div>
                    <div className="mt-1 text-[9px] text-[#8896b0]">進場分數</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[9px] text-[#8896b0]">放行結果</div>
                    <div className="mt-1 text-base font-black" style={{ color: entryVerdictColor }}>{entryScore.verdict}</div>
                    <div className="mt-0.5 text-[9px] text-[#8896b0]">信心 {entryScore.confidence}%</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[9px] text-[#8896b0]">方向 / 勝率</div>
                    <div className="mt-1 text-xs font-black" style={{ color: entryDirectionColor }}>
                      {entryScore.direction === "long" ? "做多" : entryScore.direction === "short" ? "做空" : "無訊號"}
                    </div>
                    <div className="mt-0.5 text-[9px] text-[#8896b0]">相似勝率 {Math.round((entryScore.localWinRate ?? entryScore.winRate ?? 0) * 100)}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">Entry / SL</div>
                    <div className="mt-1 font-mono text-[#e2e8f0]">{entryScore.entry ? `$${entryScore.entry.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "等待"}</div>
                    <div className="mt-0.5 text-[9px] text-[#8896b0]">SL {entryScore.sl ? `$${entryScore.sl.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">TP / RR</div>
                    <div className="mt-1 font-mono text-[#e2e8f0]">TP {entryScore.tp ? `$${entryScore.tp.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}</div>
                    <div className="mt-0.5 text-[9px] text-[#8896b0]">RR {entryScore.rr ?? "--"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-lg bg-[#1c2030] p-2"><span className="text-[#8896b0]">勝</span><span className="ml-2 font-bold text-[#26d48a]">{entryScore.labelStats?.win ?? 0}</span></div>
                  <div className="rounded-lg bg-[#1c2030] p-2"><span className="text-[#8896b0]">敗</span><span className="ml-2 font-bold text-[#f04f5e]">{entryScore.labelStats?.loss ?? 0}</span></div>
                  <div className="rounded-lg bg-[#1c2030] p-2"><span className="text-[#8896b0]">逾時</span><span className="ml-2 font-bold text-[#f5a623]">{entryScore.labelStats?.timeout ?? 0}</span></div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">局部勝率</div>
                    <div className="mt-1 font-bold text-[#e2e8f0]">{Math.round((entryScore.localWinRate ?? 0) * 100)}%</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">加權 R</div>
                    <div className="mt-1 font-bold" style={{ color: (entryScore.weightedR ?? 0) > 0 ? "#26d48a" : "#f04f5e" }}>{(entryScore.weightedR ?? 0).toFixed(2)}</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">標籤規則</div>
                    <div className="mt-1 font-bold text-[#e2e8f0]">{ENTRY_LABEL_MODES.find(m => m.value === entryScore.labelMode)?.label ?? entryScore.labelMode ?? "保守"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">市場 Regime</div>
                    <div className="mt-1 font-bold" style={{ color: entryRegimeColor }}>{entryRegimeLabel}</div>
                    <div className="mt-0.5 text-[9px] text-[#64748b]">同類勝率 {entryScore.regimeWinRate != null ? `${Math.round(entryScore.regimeWinRate * 100)}%` : "--"}</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">動態門檻</div>
                    <div className="mt-1 font-bold text-[#e2e8f0]">{entryThresholds.enter}/{entryThresholds.small}/{entryThresholds.wait}</div>
                    <div className="mt-0.5 text-[9px] text-[#64748b]">進場 / 小倉 / 等待</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">訓練品質</div>
                    <div className="mt-1 font-bold" style={{ color: entryTrainingQualityColor }}>{entryTrainingQualityLabel}</div>
                    <div className="mt-0.5 text-[9px] text-[#64748b]">加權近鄰模型</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[9px] text-[#8896b0] uppercase font-bold tracking-wider">放行依據</div>
                  {(entryScore.reasons ?? []).slice(0, 3).map((reason: string, idx: number) => (
                    <div key={idx} className="text-[10px] text-[#cbd5e1] leading-relaxed flex gap-1.5">
                      <span className="text-[#26d48a]">{idx + 1}.</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>

                {(entryScore.aiInsights?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-[#26d48a]/20 bg-[#26d48a]/5 p-2 space-y-1">
                    <div className="text-[9px] text-[#26d48a] uppercase font-bold tracking-wider">AI 訓練分析</div>
                    {(entryScore.aiInsights ?? []).slice(0, 4).map((item: string, idx: number) => (
                      <div key={idx} className="text-[10px] text-[#cbd5e1] leading-relaxed">{item}</div>
                    ))}
                  </div>
                )}

                {topEntryFeatures.length > 0 && (
                  <div className="rounded-lg bg-[#1c2030] p-2 space-y-1.5">
                    <div className="text-[9px] text-[#8896b0] uppercase font-bold tracking-wider">特徵重要性 Top 5</div>
                    {topEntryFeatures.slice(0, 5).map((feature) => (
                      <div key={feature.name} className="grid grid-cols-[1fr_52px] gap-2 items-center text-[9px]">
                        <div className="truncate text-[#cbd5e1]">{feature.name}</div>
                        <div className="font-mono text-right text-[#e2e8f0]">×{feature.weight.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {(entryScore.diagnostics?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-[#5b8af5]/20 bg-[#5b8af5]/5 p-2 space-y-1">
                    <div className="text-[9px] text-[#5b8af5] uppercase font-bold tracking-wider">診斷</div>
                    {(entryScore.diagnostics ?? []).slice(0, 5).map((item: string, idx: number) => (
                      <div key={idx} className="text-[10px] text-[#cbd5e1] leading-relaxed">{item}</div>
                    ))}
                  </div>
                )}

                {entryValidation && (
                  <div className="rounded-lg border border-[#5b8af5]/20 bg-[#5b8af5]/5 p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[9px] text-[#5b8af5] uppercase font-bold tracking-wider">OOS 泛化驗證</div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ color: entryValidationColor, background: `${entryValidationColor}1A` }}>
                        {entryValidationVerdictLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">Edge</div><div className="font-mono font-bold text-[#e2e8f0]">{entryValidation.edgeScore}</div></div>
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">OOS 勝率</div><div className="font-mono font-bold text-[#e2e8f0]">{Math.round((entryValidation.oosWinRate ?? 0) * 100)}%</div></div>
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">平均 R</div><div className="font-mono font-bold text-[#e2e8f0]">{entryValidation.oosAvgRMultiple?.toFixed?.(2) ?? "--"}</div></div>
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">過擬合</div><div className="font-mono font-bold" style={{ color: (entryValidation.overfitRisk ?? 100) <= 40 ? "#26d48a" : (entryValidation.overfitRisk ?? 100) <= 65 ? "#f5a623" : "#f04f5e" }}>{entryValidation.overfitRisk}</div></div>
                    </div>
                    <div className="text-[9px] text-[#8896b0] leading-relaxed">
                      訓練 {entryValidation.trainSampleCount} 筆 / 驗證 {entryValidation.testSampleCount} 筆；驗證段放行 {entryValidation.predictedTradeCount} 筆，覆蓋率 {Math.round((entryValidation.coverage ?? 0) * 100)}%。
                    </div>
                    {(entryValidation.notes ?? []).slice(0, 2).map((note: string, idx: number) => (
                      <div key={idx} className="text-[9px] text-[#cbd5e1] leading-relaxed">{note}</div>
                    ))}
                  </div>
                )}

                {strategyTopRows.length > 0 && (
                  <div className="rounded-lg border border-[#252b3a] bg-[#0f1520] p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[9px] text-[#8896b0] uppercase font-bold tracking-wider">目前 Regime 策略可靠度</div>
                      <span className="text-[9px] text-[#64748b]">{entryStrategyReliability?.currentRegime ?? "--"}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1 text-[9px] text-[#64748b] font-bold">
                      <span>#</span><span className="col-span-2">策略</span><span>分數</span><span>OOS</span><span>建議</span>
                    </div>
                    {strategyTopRows.map((row) => {
                      const strategyLabel = ENTRY_STRATEGIES.find(s => s.value === row.strategy)?.label ?? row.strategy;
                      const recColor = row.recommendation === "優先" ? "#26d48a" : row.recommendation === "可觀察" ? "#5b8af5" : row.recommendation === "保守" ? "#f5a623" : "#f04f5e";
                      return (
                        <div key={row.strategy} className="grid grid-cols-6 gap-1 text-[9px] text-[#cbd5e1] items-center">
                          <span className="font-mono">{row.rank}</span>
                          <span className="col-span-2 truncate">{strategyLabel}</span>
                          <span className="font-mono font-bold text-[#e2e8f0]">{row.reliabilityScore}</span>
                          <span className="font-mono">{Math.round((row.validation?.oosWinRate ?? 0) * 100)}%</span>
                          <span style={{ color: recColor }}>{row.recommendation}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(entryScore.nearestSamples?.length ?? 0) > 0 && (
                  <div className="rounded-lg bg-[#1c2030] p-2 space-y-1.5">
                    <div className="text-[9px] text-[#8896b0] uppercase font-bold tracking-wider">最近相似樣本</div>
                    <div className="grid grid-cols-5 gap-1 text-[9px] text-[#64748b] font-bold">
                      <span>時間</span><span>方向</span><span>結果</span><span>R</span><span>相似</span>
                    </div>
                    {(entryScore.nearestSamples ?? []).slice(0, 5).map((sample, idx: number) => (
                      <div key={`${sample.time}-${idx}`} className="grid grid-cols-5 gap-1 text-[9px] text-[#cbd5e1]">
                        <span className="truncate">{formatTime(sample.time)}</span>
                        <span style={{ color: sample.direction === "long" ? "#26d48a" : "#f04f5e" }}>{sample.direction === "long" ? "多" : "空"}</span>
                        <span style={{ color: sample.label === "win" ? "#26d48a" : sample.label === "loss" ? "#f04f5e" : "#f5a623" }}>{sample.label === "win" ? "勝" : sample.label === "loss" ? "敗" : "逾時"}</span>
                        <span>{sample.rMultiple?.toFixed?.(2) ?? "--"}</span>
                        <span>{Math.round((sample.similarity ?? 0) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-[#252b3a] bg-[#0f1520] p-2 space-y-2">
                  <div className="flex items-center gap-1.5 text-[9px] text-[#8896b0] uppercase font-bold tracking-wider">
                    <Clock size={11} /> 模型時效
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <div className="text-[#64748b]">模型更新</div>
                      <div className="mt-0.5 font-mono text-[#e2e8f0]">{formatTime(entryScore.modelUpdatedAt ?? entryTrainerStatus?.updatedAt)}</div>
                      <div className="text-[9px] text-[#64748b]">距今 {formatDuration(entryModelAgeMs)}</div>
                    </div>
                    <div>
                      <div className="text-[#64748b]">最後 K 線</div>
                      <div className="mt-0.5 font-mono text-[#e2e8f0]">{formatTime(entryTrainerStatus?.dataEndTime)}</div>
                      <div className="text-[9px] text-[#64748b]">區間 {selectedTf}</div>
                    </div>
                    <div>
                      <div className="text-[#64748b]">下次可能重訓</div>
                      <div className="mt-0.5 font-mono text-[#e2e8f0]">{formatTime(nextEntryRetrainAt)}</div>
                      <div className="text-[9px] text-[#64748b]">約 {formatDuration(nextEntryRetrainIn)}</div>
                    </div>
                    <div>
                      <div className="text-[#64748b]">資料區間</div>
                      <div className="mt-0.5 font-mono text-[#e2e8f0]">{formatTime(entryTrainerStatus?.dataStartTime)} → {formatTime(entryTrainerStatus?.dataEndTime)}</div>
                      <div className="text-[9px] text-[#64748b]">新 K 線後按需更新</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#26d48a]/15 bg-[#26d48a]/5 p-2 space-y-1.5">
                  <div className="text-[9px] text-[#26d48a] uppercase font-bold tracking-wider">實戰引用</div>
                  <div className="text-[10px] text-[#cbd5e1] leading-relaxed">
                    以放行結果為第一層濾網：進場可按計畫執行，小倉只做輕倉，等待/禁止不追單；再用 RR、相似勝率、加權 R 與診斷確認是否符合你的風控。
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[9px] text-[#8896b0]">
                    <span>進場：分數 ≥ {entryThresholds.enter} 且信心足</span>
                    <span>小倉：{entryThresholds.small}–{entryThresholds.enter - 1}，需降低倉位</span>
                    <span>等待：無訊號或優勢不足</span>
                    <span>禁止：樣本/勝率/R 倍數不佳</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-[#8896b0]">正在建立進場樣本並計算 TP/SL 標籤...</div>
            )}
          </div>

          {/* 模型資訊 */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[9px] text-[#8896b0] uppercase">歷史準確率</span>
                <span className="text-xs font-bold" style={{ color: accuracyColor }}>{accuracyPct}%</span>
              </div>
              <div className="w-px h-6 bg-[#252b3a]" />
              <div className="flex flex-col">
                <span className="text-[9px] text-[#8896b0] uppercase">訓練樣本</span>
                <span className="text-xs font-bold text-[#e2e8f0]">{prediction.trainedOn} 根</span>
              </div>
            </div>
            <button 
              onClick={handleRetrain}
              disabled={isWorking}
              className="text-[9px] font-bold text-[#5b8af5] hover:underline disabled:opacity-50"
            >
              {isRetraining ? "訓練中..." : "重新訓練模型"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
