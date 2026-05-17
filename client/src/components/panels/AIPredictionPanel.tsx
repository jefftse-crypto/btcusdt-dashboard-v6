/**
 * AIPredictionPanel.tsx — LSTM AI 預測面板
 * 顯示未來 1 小時方向概率、預測價格區間、信心指數
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, Clock, Cpu, BarChart2 } from "lucide-react";

interface AIPredictionPanelProps {
  symbol: string;
  timeframe?: "1h" | "4h" | "15m" | "5m";
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
  const [selectedTf, setSelectedTf] = useState<"1h" | "4h" | "15m" | "5m">(timeframe);
  const [isRetraining, setIsRetraining] = useState(false);

  // 查詢 AI 預測
  const {
    data: prediction,
    isLoading,
    isFetching,
    error,
    refetch,
  } = trpc.ai.predict.useQuery(
    { symbol, timeframe: selectedTf, limit: 800, forceRetrain: false },
    {
      staleTime: 5 * 60 * 1000,   // 5 分鐘快取
      refetchInterval: 10 * 60 * 1000, // 每 10 分鐘自動重新預測
      retry: 1,
    }
  );

  // 強制重新訓練
  const handleRetrain = useCallback(async () => {
    setIsRetraining(true);
    try {
      await trpc.ai.predict.useQuery(
        { symbol, timeframe: selectedTf, limit: 800, forceRetrain: true },
        { enabled: false }
      );
      await refetch();
    } finally {
      setIsRetraining(false);
    }
  }, [symbol, selectedTf, refetch]);

  const isWorking = isLoading || isFetching || isRetraining;

  // ─── 方向顏色與圖示 ──────────────────────────────────────────────────
  const directionConfig = {
    bullish:  { color: "#26d48a", label: "多頭",   icon: <TrendingUp size={18} />,  bg: "rgba(38,212,138,0.1)" },
    bearish:  { color: "#f04f5e", label: "空頭",   icon: <TrendingDown size={18} />, bg: "rgba(240,79,94,0.1)" },
    neutral:  { color: "#f5a623", label: "震盪",   icon: <Minus size={18} />,       bg: "rgba(245,166,35,0.1)" },
  };
  const dir = prediction ? directionConfig[prediction.direction] : null;

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

      {/* ── 載入中 ─────────────────────────────────────────────────────── */}
      {isWorking && !prediction && (
        <div className="rounded-xl p-6 text-center space-y-3" style={{ background: "#161b27", border: "1px solid #2a3148" }}>
          <div className="flex justify-center">
            <div className="relative">
              <Cpu size={32} className="text-[#5b8af5] animate-pulse" />
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#5b8af5] animate-ping" />
            </div>
          </div>
          <div className="text-sm font-semibold text-[#e2e8f0]">
            {isRetraining ? "重新訓練模型中..." : "LSTM 模型訓練中..."}
          </div>
          <div className="text-[11px] text-[#8896b0]">
            正在用 800 根 K 線訓練神經網路<br />
            14 特徵 × 60 時間步 × 30 輪訓練
          </div>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-[#5b8af5] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── 錯誤 ───────────────────────────────────────────────────────── */}
      {error && !isWorking && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "rgba(240,79,94,0.08)", border: "1px solid rgba(240,79,94,0.2)" }}>
          <AlertCircle size={16} className="text-[#f04f5e] mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-[#f04f5e]">預測失敗</div>
            <div className="text-[11px] text-[#8896b0] mt-0.5">{error.message}</div>
          </div>
        </div>
      )}

      {/* ── 預測結果 ───────────────────────────────────────────────────── */}
      {prediction && dir && (
        <>
          {/* 主方向卡片 */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: dir.bg, border: `1px solid ${dir.color}30` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div style={{ color: dir.color }}>{dir.icon}</div>
                <span className="text-base font-bold" style={{ color: dir.color }}>
                  {dir.label}方向
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: dir.color }} />
                <span className="text-[10px] font-semibold" style={{ color: dir.color }}>
                  {confidenceLevel?.label}
                </span>
              </div>
            </div>

            {/* 信心指數圓形進度 */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <CircleProgress value={prediction.confidence} color={dir.color} size={72} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: dir.color }}>
                    {prediction.confidence}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="text-[10px] text-[#8896b0]">信心指數</div>
                <div className="text-[11px] text-[#b0bcd4]">
                  模型對此預測的確信程度，越高越可靠
                </div>
                <div className="flex items-center gap-1 text-[10px]" style={{ color: accuracyColor }}>
                  <CheckCircle2 size={11} />
                  <span>回測準確率 {accuracyPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 三方向概率條 */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "#161b27", border: "1px solid #2a3148" }}>
            <div className="text-[11px] font-bold text-[#8896b0] uppercase tracking-wider">方向概率分佈</div>
            <ProbBar label="多頭" value={prediction.bullProb} color="#26d48a" icon={<TrendingUp size={12} />} />
            <ProbBar label="震盪" value={prediction.neutralProb} color="#f5a623" icon={<Minus size={12} />} />
            <ProbBar label="空頭" value={prediction.bearProb} color="#f04f5e" icon={<TrendingDown size={12} />} />
          </div>

          {/* 預測價格區間 */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "#161b27", border: "1px solid #2a3148" }}>
            <div className="text-[11px] font-bold text-[#8896b0] uppercase tracking-wider">預測價格區間（下一根 K 線）</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2.5 text-center" style={{ background: "#141820" }}>
                <div className="text-[10px] text-[#f04f5e] mb-1">下限</div>
                <div className="text-xs font-mono font-bold text-[#e2e8f0]">
                  {prediction.priceRangeLow.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: "#141820", border: `1px solid ${dir.color}40` }}>
                <div className="text-[10px] mb-1" style={{ color: dir.color }}>預測</div>
                <div className="text-xs font-mono font-bold" style={{ color: dir.color }}>
                  {prediction.predictedClose.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: "#141820" }}>
                <div className="text-[10px] text-[#26d48a] mb-1">上限</div>
                <div className="text-xs font-mono font-bold text-[#e2e8f0]">
                  {prediction.priceRangeHigh.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            {/* 現價對比 */}
            {currentPrice && (
              <div className="flex items-center justify-between text-[10px] pt-1 border-t" style={{ borderColor: "#2a3148" }}>
                <span className="text-[#8896b0]">現價</span>
                <span className="font-mono text-[#e2e8f0]">{currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span className={`font-semibold ${prediction.predictedClose > currentPrice ? "text-[#26d48a]" : "text-[#f04f5e]"}`}>
                  {prediction.predictedClose > currentPrice ? "▲" : "▼"}{" "}
                  {Math.abs(((prediction.predictedClose - currentPrice) / currentPrice) * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {/* 模型資訊 */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "#161b27", border: "1px solid #2a3148" }}>
            <div className="text-[11px] font-bold text-[#8896b0] uppercase tracking-wider">模型資訊</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#8896b0]">版本</span>
                <span className="text-[#b0bcd4] font-mono">{prediction.modelVersion}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#8896b0]">訓練樣本</span>
                <span className="text-[#b0bcd4] font-mono">{prediction.trainedOn.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#8896b0]">回測準確率</span>
                <span className="font-mono font-bold" style={{ color: accuracyColor }}>{accuracyPct}%</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#8896b0]">訓練時間</span>
                <span className="text-[#b0bcd4] font-mono flex items-center gap-1">
                  <Clock size={9} />
                  {new Date(prediction.trainedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          </div>

          {/* 重新訓練按鈕 */}
          <button
            onClick={handleRetrain}
            disabled={isWorking}
            className="w-full py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "rgba(91,138,245,0.12)", border: "1px solid rgba(91,138,245,0.25)", color: "#5b8af5" }}
          >
            <BarChart2 size={13} />
            {isWorking ? "訓練中..." : "強制重新訓練模型"}
          </button>

          {/* 免責聲明 */}
          <div className="rounded-lg p-2.5 text-[10px] text-[#6b7385] leading-relaxed" style={{ background: "#141820" }}>
            ⚠️ AI 預測僅供參考，不構成投資建議。加密貨幣市場受突發事件影響，任何模型均無法保證準確性。請結合其他指標和自身判斷做出交易決策。
          </div>
        </>
      )}
    </div>
  );
}
