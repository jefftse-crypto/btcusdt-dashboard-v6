/**
 * AIPredictionPanel.tsx — LSTM AI 預測面板
 * 顯示未來 1 小時方向概率、預測價格區間、信心指數
 */

import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle, Clock, Cpu } from "lucide-react";

interface AIPredictionPanelProps {
  symbol: string;
  timeframe?: string;
  currentPrice?: number | null;
}

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
  const [isRetraining, setIsRetraining] = useState(false);
  const [forceRetrainOnce, setForceRetrainOnce] = useState(false);

  // 當外部 timeframe 改變時同步
  useEffect(() => {
    setSelectedTf(normalizeTf(timeframe));
  }, [timeframe]);

  // 查詢 AI 預測
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
      onSuccess: () => {
        if (forceRetrainOnce) setForceRetrainOnce(false);
      }
    }
  );

  // 強制重新訓練
  const handleRetrain = useCallback(async () => {
    setIsRetraining(true);
    setForceRetrainOnce(true);
    try {
      await refetch();
    } finally {
      setIsRetraining(false);
    }
  }, [refetch]);

  const isWorking = isLoading || isFetching || isRetraining;

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
          onClick={() => refetch()}
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
