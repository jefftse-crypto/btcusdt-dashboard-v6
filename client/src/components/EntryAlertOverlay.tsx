/**
 * EntryAlertOverlay
 * 當 LSTM + AI 綜合判讀 + Entry Trainer 三個系統同時達到進場條件時，
 * 自動彈出視覺提示並播放提示音。
 *
 * 觸發條件（三個系統方向一致）：
 *  - LSTM: direction !== "neutral", confidence >= 55
 *  - AI 綜合判讀: action === "long" | "short", confidence >= 60
 *  - Entry Trainer: verdict === "進場" | "小倉", score >= 62, direction 有效
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, X, Bell, BellOff,
  Zap, ShieldCheck, Brain, Target
} from "lucide-react";

// ─── 型別 ───────────────────────────────────────────────────────────────────
interface AlertState {
  direction: "long" | "short";
  symbol: string;
  timeframe: string;
  lstmConfidence: number;
  aiConfidence: number;
  entryScore: number;
  entryVerdict: string;
  entryPrice?: number;
  sl?: number;
  tp?: number;
  rr?: number;
  triggeredAt: number;
}

// ─── 提示音產生器（Web Audio API，無需外部資源）────────────────────────────
function playAlertSound(direction: "long" | "short") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = direction === "long"
      ? [523.25, 659.25, 783.99]   // C5 E5 G5 上升和弦
      : [783.99, 659.25, 523.25];  // G5 E5 C5 下降和弦

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    // 瀏覽器不支援 Web Audio API 時靜默失敗
  }
}

// ─── 主元件 ──────────────────────────────────────────────────────────────────
interface EntryAlertOverlayProps {
  symbol: string;
  timeframe?: string;
}

export function EntryAlertOverlay({ symbol, timeframe = "1h" }: EntryAlertOverlayProps) {
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lastTriggeredKey, setLastTriggeredKey] = useState<string>("");
  const prevKeyRef = useRef<string>("");

  // ── 資料查詢（與 AIPredictionPanel 共用相同 tRPC 端點，自動快取）──────────
  const { data: prediction } = trpc.ai.predict.useQuery(
    { symbol, timeframe },
    { refetchInterval: 60000, staleTime: 30000 }
  );

  const { data: aiDecision } = trpc.ai.decision.useQuery(
    { symbol, timeframe },
    { refetchInterval: 60000, staleTime: 30000 }
  );

  const { data: entryScore } = trpc.ai.entryScore.useQuery(
    { symbol, timeframe, strategy: "v8_hybrid", labelMode: "conservative" },
    { refetchInterval: 90000, staleTime: 45000 }
  );

  // ── 條件判斷 ──────────────────────────────────────────────────────────────
  const checkConditions = useCallback(() => {
    if (!prediction || !aiDecision || !entryScore) return;

    // LSTM 條件
    const lstmDir = prediction.direction as string;
    const lstmOk =
      (lstmDir === "bullish" || lstmDir === "bearish") &&
      prediction.confidence >= 55;

    // AI 綜合判讀條件
    const aiAction = aiDecision.action as string;
    const aiOk =
      (aiAction === "long" || aiAction === "short") &&
      aiDecision.confidence >= 60;

    // Entry Trainer 條件
    const verdict = entryScore.verdict as string;
    const entryOk =
      (verdict === "進場" || verdict === "小倉") &&
      (entryScore.score ?? 0) >= 62 &&
      (entryScore.direction === "long" || entryScore.direction === "short");

    if (!lstmOk || !aiOk || !entryOk) return;

    // 方向一致性檢查
    const lstmLong = lstmDir === "bullish";
    const aiLong = aiAction === "long";
    const entryLong = entryScore.direction === "long";

    if (!(lstmLong === aiLong && aiLong === entryLong)) return;

    const direction: "long" | "short" = lstmLong ? "long" : "short";

    // 防止重複觸發（同方向 + 同 entryScore 分數視為同一次訊號）
    const triggerKey = `${symbol}-${timeframe}-${direction}-${entryScore.score}-${Math.floor(Date.now() / 300000)}`;
    if (triggerKey === prevKeyRef.current) return;
    prevKeyRef.current = triggerKey;

    const newAlert: AlertState = {
      direction,
      symbol,
      timeframe,
      lstmConfidence: prediction.confidence,
      aiConfidence: aiDecision.confidence,
      entryScore: entryScore.score ?? 0,
      entryVerdict: verdict,
      entryPrice: entryScore.entry,
      sl: entryScore.sl,
      tp: entryScore.tp,
      rr: entryScore.rr,
      triggeredAt: Date.now(),
    };

    setAlert(newAlert);
    setDismissed(false);
    setLastTriggeredKey(triggerKey);

    if (!muted) {
      playAlertSound(direction);
    }
  }, [prediction, aiDecision, entryScore, symbol, timeframe, muted]);

  useEffect(() => {
    checkConditions();
  }, [checkConditions]);

  const handleDismiss = () => setDismissed(true);
  const toggleMute = () => setMuted(m => !m);

  if (!alert || dismissed) {
    return (
      <button
        onClick={toggleMute}
        className="fixed bottom-20 right-4 z-40 p-2 rounded-full bg-[#1c2030] border border-[#2a3347] text-[#8896b0] hover:text-white transition-colors"
        title={muted ? "已靜音，點擊開啟提示音" : "提示音已開啟，點擊靜音"}
      >
        {muted ? <BellOff size={16} /> : <Bell size={16} />}
      </button>
    );
  }

  const isLong = alert.direction === "long";
  const dirColor = isLong ? "#26d48a" : "#f04f5e";
  const dirBg = isLong ? "rgba(38,212,138,0.08)" : "rgba(240,79,94,0.08)";
  const dirBorder = isLong ? "rgba(38,212,138,0.3)" : "rgba(240,79,94,0.3)";
  const dirLabel = isLong ? "做多 LONG" : "做空 SHORT";
  const DirIcon = isLong ? TrendingUp : TrendingDown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={handleDismiss}
      />

      {/* 彈窗主體 */}
      <div
        className="relative pointer-events-auto w-[92vw] max-w-sm rounded-2xl p-5 shadow-2xl"
        style={{
          background: "#141824",
          border: `1.5px solid ${dirBorder}`,
          boxShadow: `0 0 40px ${dirColor}33`,
        }}
      >
        {/* 關閉按鈕 */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full text-[#8896b0] hover:text-white"
        >
          <X size={18} />
        </button>

        {/* 靜音按鈕 */}
        <button
          onClick={toggleMute}
          className="absolute top-3 right-9 p-1 rounded-full text-[#8896b0] hover:text-white"
          title={muted ? "已靜音" : "靜音"}
        >
          {muted ? <BellOff size={16} /> : <Bell size={16} />}
        </button>

        {/* 標題 */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full"
            style={{ background: dirBg, border: `1px solid ${dirBorder}` }}
          >
            <Zap size={18} style={{ color: dirColor }} />
          </div>
          <div>
            <div className="text-xs text-[#8896b0] font-medium">三系統一致訊號</div>
            <div className="text-sm font-black text-white">進場提示</div>
          </div>
        </div>

        {/* 方向標籤 */}
        <div
          className="flex items-center justify-center gap-2 rounded-xl py-3 mb-4"
          style={{ background: dirBg, border: `1px solid ${dirBorder}` }}
        >
          <DirIcon size={22} style={{ color: dirColor }} />
          <span className="text-xl font-black" style={{ color: dirColor }}>
            {dirLabel}
          </span>
        </div>

        {/* 幣種 / 時框 */}
        <div className="flex justify-between text-xs text-[#8896b0] mb-3">
          <span className="font-bold text-white">{alert.symbol}</span>
          <span>{alert.timeframe.toUpperCase()} 時框</span>
        </div>

        {/* 三系統指標 */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between rounded-lg bg-[#1c2030] px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-[#8896b0]">
              <Brain size={13} />
              <span>LSTM 預測</span>
            </div>
            <span className="text-xs font-bold" style={{ color: dirColor }}>
              {isLong ? "看漲" : "看跌"} · 信心 {alert.lstmConfidence}%
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#1c2030] px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-[#8896b0]">
              <ShieldCheck size={13} />
              <span>AI 綜合判讀</span>
            </div>
            <span className="text-xs font-bold" style={{ color: dirColor }}>
              {isLong ? "做多" : "做空"} · 信心 {alert.aiConfidence}%
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#1c2030] px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-[#8896b0]">
              <Target size={13} />
              <span>Entry Trainer</span>
            </div>
            <span className="text-xs font-bold" style={{ color: dirColor }}>
              {alert.entryVerdict} · 分數 {alert.entryScore}
            </span>
          </div>
        </div>

        {/* 進場資訊 */}
        {(alert.entryPrice || alert.sl || alert.tp) && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {alert.entryPrice && (
              <div className="rounded-lg bg-[#1c2030] p-2 text-center">
                <div className="text-[9px] text-[#8896b0]">進場</div>
                <div className="text-xs font-mono font-bold text-white mt-0.5">
                  ${alert.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </div>
              </div>
            )}
            {alert.sl && (
              <div className="rounded-lg bg-[#1c2030] p-2 text-center">
                <div className="text-[9px] text-[#8896b0]">止損</div>
                <div className="text-xs font-mono font-bold text-[#f04f5e] mt-0.5">
                  ${alert.sl.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </div>
              </div>
            )}
            {alert.tp && (
              <div className="rounded-lg bg-[#1c2030] p-2 text-center">
                <div className="text-[9px] text-[#8896b0]">止盈 {alert.rr ? `RR${alert.rr}` : ""}</div>
                <div className="text-xs font-mono font-bold text-[#26d48a] mt-0.5">
                  ${alert.tp.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 提示文字 */}
        <div className="text-[10px] text-[#8896b0] text-center">
          點擊背景或右上角 × 關閉 · 此為輔助提示，請自行判斷風險
        </div>
      </div>
    </div>
  );
}
