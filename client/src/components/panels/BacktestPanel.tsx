// BacktestPanel v3 — 全套技術指標選擇器 + 分組子圖
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
  ReferenceLine, AreaChart, Area, ComposedChart, Scatter
} from "recharts";
import { Info, Activity, ShieldCheck, Settings2, ChevronDown, ChevronUp } from "lucide-react";

interface Props { symbol: string; }

type Strategy = "ema_cross" | "rsi_reversal" | "bollinger" | "macd" | "smc" | "pa" | "chan"
  | "liquidity_sweep" | "vwap_reversion" | "composite" | "cannonball"
  | "hwr_model_a" | "hwr_model_b" | "hwr_model_c" | "v8_hybrid";

const STRATEGY_LABELS: Record<Strategy, string> = {
  ema_cross: "EMA 交叉", rsi_reversal: "RSI 反轉", bollinger: "布林帶", macd: "MACD",
  smc: "SMC 結構", pa: "PA 綜合分析", chan: "纏論策略",
  liquidity_sweep: "★ ICT 流動性掃山", vwap_reversion: "★ VWAP 偏差回歸",
  composite: "★ 最高勝率綜合", cannonball: "★ CannonBall 結構動能",
  hwr_model_a: "◆ HWR 模型 A：掃流動性反轉", hwr_model_b: "◆ HWR 模型 B：趨勢回踩延續",
  hwr_model_c: "◆ HWR 模型 C：中樞邊界反應", v8_hybrid: "🚀 V8 旗艦混合策略 (R-Multiples)",
};
const STRATEGY_DESC: Record<Strategy, string> = {
  ema_cross: "EMA20 與 EMA50 黃金/死亡交叉", rsi_reversal: "RSI 超買超賣反轉（<30 多 / >70 空）",
  bollinger: "價格觸及布林帶上下軌反轉", macd: "MACD 柱狀圖正負轉換",
  smc: "SMC 結構突破（BOS）", pa: "RSI + EMA + MACD + ADX 多因子評分",
  chan: "纏論段方向 + 中樞突破訊號",
  liquidity_sweep: "ICT 核心：掃山止損單後反向展開，EMA200 方向確認",
  vwap_reversion: "VWAP 偏離 2σ 回歸，ADX<25 震盪市場專用",
  composite: "SMC 30% + PA 25% + 旗波 20% + 纏論 25%（最高勝率綜合策略）",
  cannonball: "結構突破 + 訂單塊回踩 + Money Flow / RVOL 確認，使用自定義風控",
  hwr_model_a: "SMC 三部曲：流動性掃過 → CHoCH 結構轉折 → FVG 回踩進場",
  hwr_model_b: "EMA50 趨勢 + ADX>20 + Fib OTE 區間回踩進場",
  hwr_model_c: "纏論中樞邊界假突破反手，止損放邊界外側",
  v8_hybrid: "1H 入場 + 4H 趨勢過濾。結合均值回歸與趨勢追隨。以 R-Multiples 為核心評估，支援 2% 動態複利風控。",
};

// ── 指標定義 ──────────────────────────────────────────────────────────────────
type IndicatorKey =
  // 趨勢
  | "sma10" | "sma20" | "sma50" | "sma200"
  | "ema9" | "ema20" | "ema50" | "ema200"
  | "vwap"
  // 布林帶 / Keltner
  | "bb" | "bb1" | "keltner"
  // 震盪
  | "rsi" | "rsi9" | "macd" | "stoch" | "will_r" | "cci" | "roc"
  // 趨勢強度
  | "adx"
  // 成交量
  | "obv" | "cvd" | "mfi" | "volume";

interface IndicatorDef {
  label: string;
  color: string;
  group: "trend" | "band" | "oscillator" | "strength" | "volume";
  subChart: "price" | "rsi" | "macd" | "stoch" | "adx" | "volume" | "obv" | "mfi" | "cci" | "roc";
  fields: string[];  // candles_series 中對應的欄位名稱
  refLines?: { y: number; color: string; dash?: string }[];
}

const INDICATOR_DEFS: Record<IndicatorKey, IndicatorDef> = {
  // ── 趨勢 ──
  sma10:   { label: "SMA 10",   color: "#facc15", group: "trend",      subChart: "price",  fields: ["sma10"] },
  sma20:   { label: "SMA 20",   color: "#fb923c", group: "trend",      subChart: "price",  fields: ["sma20"] },
  sma50:   { label: "SMA 50",   color: "#60a5fa", group: "trend",      subChart: "price",  fields: ["sma50"] },
  sma200:  { label: "SMA 200",  color: "#c084fc", group: "trend",      subChart: "price",  fields: ["sma200"] },
  ema9:    { label: "EMA 9",    color: "#fde047", group: "trend",      subChart: "price",  fields: ["ema9"] },
  ema20:   { label: "EMA 20",   color: "#f59e0b", group: "trend",      subChart: "price",  fields: ["ema20"] },
  ema50:   { label: "EMA 50",   color: "#3b82f6", group: "trend",      subChart: "price",  fields: ["ema50"] },
  ema200:  { label: "EMA 200",  color: "#a855f7", group: "trend",      subChart: "price",  fields: ["ema200"] },
  vwap:    { label: "VWAP",     color: "#22d3ee", group: "trend",      subChart: "price",  fields: ["vwap"] },
  // ── 帶狀 ──
  bb:      { label: "布林帶 2σ", color: "#06b6d4", group: "band",      subChart: "price",  fields: ["bb_upper", "bb_mid", "bb_lower"] },
  bb1:     { label: "布林帶 1σ", color: "#0891b2", group: "band",      subChart: "price",  fields: ["bb1_upper", "bb1_lower"] },
  keltner: { label: "Keltner",  color: "#14b8a6", group: "band",       subChart: "price",  fields: ["kelt_upper", "kelt_lower"] },
  // ── 震盪 ──
  rsi:     { label: "RSI(14)",  color: "#10b981", group: "oscillator", subChart: "rsi",    fields: ["rsi"],
    refLines: [{ y: 70, color: "#f23645", dash: "3 2" }, { y: 30, color: "#089981", dash: "3 2" }, { y: 50, color: "#2a2e39" }] },
  rsi9:    { label: "RSI(9)",   color: "#34d399", group: "oscillator", subChart: "rsi",    fields: ["rsi9"],
    refLines: [{ y: 70, color: "#f23645", dash: "3 2" }, { y: 30, color: "#089981", dash: "3 2" }] },
  macd:    { label: "MACD",     color: "#f97316", group: "oscillator", subChart: "macd",   fields: ["macd", "macd_signal", "macd_hist"] },
  stoch:   { label: "Stoch",    color: "#818cf8", group: "oscillator", subChart: "stoch",  fields: ["stoch_k", "stoch_d"],
    refLines: [{ y: 80, color: "#f23645", dash: "3 2" }, { y: 20, color: "#089981", dash: "3 2" }] },
  will_r:  { label: "Williams %R", color: "#f472b6", group: "oscillator", subChart: "rsi", fields: ["will_r"],
    refLines: [{ y: -20, color: "#f23645", dash: "3 2" }, { y: -80, color: "#089981", dash: "3 2" }] },
  cci:     { label: "CCI(20)",  color: "#fb7185", group: "oscillator", subChart: "cci",    fields: ["cci"],
    refLines: [{ y: 100, color: "#f23645", dash: "3 2" }, { y: -100, color: "#089981", dash: "3 2" }, { y: 0, color: "#2a2e39" }] },
  roc:     { label: "ROC(10)",  color: "#a3e635", group: "oscillator", subChart: "roc",    fields: ["roc"],
    refLines: [{ y: 0, color: "#2a2e39" }] },
  // ── 趨勢強度 ──
  adx:     { label: "ADX(14)",  color: "#fbbf24", group: "strength",   subChart: "adx",    fields: ["adx", "plus_di", "minus_di"],
    refLines: [{ y: 25, color: "#787b86", dash: "3 2" }] },
  // ── 成交量 ──
  obv:     { label: "OBV",      color: "#4ade80", group: "volume",     subChart: "obv",    fields: ["obv"] },
  cvd:     { label: "CVD",      color: "#86efac", group: "volume",     subChart: "obv",    fields: ["cvd"] },
  mfi:     { label: "MFI(14)",  color: "#67e8f9", group: "volume",     subChart: "mfi",    fields: ["mfi"],
    refLines: [{ y: 80, color: "#f23645", dash: "3 2" }, { y: 20, color: "#089981", dash: "3 2" }] },
  volume:  { label: "成交量",    color: "#94a3b8", group: "volume",     subChart: "volume", fields: ["volume"] },
};

const GROUP_LABELS = {
  trend: "趨勢均線",
  band: "帶狀通道",
  oscillator: "震盪指標",
  strength: "趨勢強度",
  volume: "成交量",
};

// 每個策略建議指標
const STRATEGY_INDICATORS: Record<Strategy, IndicatorKey[]> = {
  ema_cross: ["ema20", "ema50", "adx"],
  rsi_reversal: ["rsi", "bb"],
  bollinger: ["bb", "rsi", "adx"],
  macd: ["macd", "ema20", "ema50"],
  smc: ["ema200", "adx"],
  pa: ["rsi", "macd", "ema20", "ema50", "adx"],
  chan: ["ema20", "ema50", "rsi"],
  liquidity_sweep: ["ema200", "adx", "obv"],
  vwap_reversion: ["vwap", "bb", "rsi"],
  composite: ["rsi", "macd", "ema20", "ema50", "adx"],
  cannonball: ["ema20", "ema50", "ema200", "obv", "adx"],
  hwr_model_a: ["ema50", "ema200", "adx"],
  hwr_model_b: ["ema50", "macd", "adx"],
  hwr_model_c: ["ema20", "rsi", "stoch"],
  v8_hybrid: ["ema20", "ema50", "rsi", "macd", "adx"],
};

// 子圖類型
type SubChartType = "none" | "rsi" | "macd" | "stoch" | "adx" | "volume" | "obv" | "mfi" | "cci" | "roc";
const SUB_CHART_LABELS: Record<SubChartType, string> = {
  none: "無", rsi: "RSI", macd: "MACD", stoch: "Stoch",
  adx: "ADX", volume: "成交量", obv: "OBV/CVD", mfi: "MFI", cci: "CCI", roc: "ROC",
};

interface BacktestTrade {
  entry_time: number; exit_time: number; direction: "long" | "short";
  entry_price: number; exit_price: number; sl_price: number; tp_price: number;
  pnl: number; pnl_pct: number; exit_reason: "sl" | "tp" | "trailing" | "end";
  r_multiple?: number;
}

type CandlePoint = Record<string, number | null> & {
  time: number; open: number; high: number; low: number; close: number; volume: number;
};

interface BacktestResult {
  strategy?: string; symbol?: string; interval?: string;
  total_trades?: number; win_rate?: number; profit_factor?: number;
  max_drawdown?: number; total_return?: number; total_return_net?: number;
  total_r_multiple?: number; sharpe_ratio?: number; sortino_ratio?: number;
  equity_curve?: number[]; trades?: BacktestTrade[];
  monte_carlo?: { p5_return: number; p50_return: number; p95_return: number; ruin_probability: number } | null;
  candles_series?: CandlePoint[];
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CandleTooltip({ active, payload, activeIndicators }: {
  active?: boolean;
  payload?: { payload: CandlePoint & { tradeEntry?: BacktestTrade; tradeExit?: BacktestTrade } }[];
  activeIndicators: Set<IndicatorKey>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const time = new Date((d.time as number) * 1000).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const isUp = (d.close as number) >= (d.open as number);
  return (
    <div className="bg-[#1e222d] border border-[#2a2e39] rounded p-2 text-[10px] space-y-0.5 shadow-xl min-w-[160px] max-w-[220px]">
      <div className="text-[#787b86] font-mono">{time}</div>
      <div className={`font-mono font-bold ${isUp ? "text-[#089981]" : "text-[#f23645]"}`}>
        O:{(d.open as number).toFixed(1)} H:{(d.high as number).toFixed(1)} L:{(d.low as number).toFixed(1)} C:{(d.close as number).toFixed(1)}
      </div>
      {Array.from(activeIndicators).map(key => {
        const def = INDICATOR_DEFS[key];
        if (def.subChart !== "price") return null;
        return def.fields.map(f => {
          const v = d[f];
          if (v == null) return null;
          return <div key={f} style={{ color: def.color }}>{f.toUpperCase()}: {(v as number).toFixed(2)}</div>;
        });
      })}
      {d.tradeEntry && (
        <div className={`mt-1 pt-1 border-t border-[#2a2e39] font-bold ${(d.tradeEntry as BacktestTrade).direction === "long" ? "text-[#089981]" : "text-[#f23645]"}`}>
          ▶ 進場 {(d.tradeEntry as BacktestTrade).direction.toUpperCase()} @ {(d.tradeEntry as BacktestTrade).entry_price.toFixed(1)}
        </div>
      )}
      {d.tradeExit && (
        <div className={`font-bold ${(d.tradeExit as BacktestTrade).pnl >= 0 ? "text-[#089981]" : "text-[#f23645]"}`}>
          ◀ 出場 [{(d.tradeExit as BacktestTrade).exit_reason}] {((d.tradeExit as BacktestTrade).pnl_pct * 100).toFixed(2)}%
        </div>
      )}
    </div>
  );
}

export function BacktestPanel({ symbol }: Props) {
  const [strategy, setStrategy] = useState<Strategy>("v8_hybrid");
  const [interval, setInterval] = useState("1H");
  const [limit, setLimit] = useState(4320);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [detailTab, setDetailTab] = useState<"chart" | "equity" | "trades" | "stats">("chart");
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(new Set(["ema20", "ema50", "rsi", "macd"]));
  const [subChart, setSubChart] = useState<SubChartType>("rsi");
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(true);

  const runMutation = trpc.backtest.run.useMutation({
    onSuccess: (data) => {
      setResult(data as BacktestResult);
      setDetailTab("chart");
      setActiveIndicators(new Set(STRATEGY_INDICATORS[strategy]));
      // 自動選擇第一個非 price 子圖
      const firstSub = STRATEGY_INDICATORS[strategy].find(k => INDICATOR_DEFS[k].subChart !== "price");
      if (firstSub) setSubChart(INDICATOR_DEFS[firstSub].subChart as SubChartType);
      toast.success("回測完成，已自動套用建議指標");
    },
    onError: (err) => { toast.error(`回測失敗：${err.message}`); },
  });

  const handleRun = () => {
    runMutation.mutate({
      symbol, interval: interval as "15m" | "1H" | "4H" | "1D",
      strategy: strategy as Strategy, limit,
      atr_sl_mult: 1.5, atr_tp_mult: 3.0,
      enable_mtf_filter: true, enable_fee: true,
      enable_trailing_stop: true, enable_adx_filter: true,
    });
  };

  const toggleIndicator = (key: IndicatorKey) => {
    setActiveIndicators(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── 圖表資料 ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!result?.candles_series) return [];
    const trades = result.trades ?? [];
    const entryMap = new Map<number, BacktestTrade>();
    const exitMap  = new Map<number, BacktestTrade>();
    for (const t of trades) { entryMap.set(t.entry_time, t); exitMap.set(t.exit_time, t); }
    return result.candles_series.map(c => ({
      ...c,
      tradeEntry: entryMap.get(c.time as number),
      tradeExit:  exitMap.get(c.time as number),
      entryLong:  entryMap.get(c.time as number)?.direction === "long"  ? (c.low as number) * 0.998 : null,
      entryShort: entryMap.get(c.time as number)?.direction === "short" ? (c.high as number) * 1.002 : null,
      exitWin:    exitMap.get(c.time as number) && (exitMap.get(c.time as number)?.pnl ?? 0) >= 0 ? c.close : null,
      exitLoss:   exitMap.get(c.time as number) && (exitMap.get(c.time as number)?.pnl ?? 0) <  0 ? c.close : null,
    }));
  }, [result]);

  const equityCurveData = useMemo(() => (result?.equity_curve ?? []).map((v, i) => ({ index: i, value: v })), [result]);

  const monthlyData = useMemo(() => {
    if (!result?.trades?.length) return [];
    const map = new Map<string, { trades: number; wins: number; pnl: number }>();
    for (const t of result.trades) {
      const d = new Date(t.entry_time * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key) ?? { trades: 0, wins: 0, pnl: 0 };
      cur.trades++; if (t.pnl > 0) cur.wins++; cur.pnl += t.pnl_pct;
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, s]) => ({ month, pnl_pct: s.pnl * 100, trades: s.trades }));
  }, [result]);

  const pnlDistData = useMemo(() => {
    if (!result?.trades?.length) return [];
    const buckets: Record<string, number> = {};
    for (const t of result.trades) {
      const bucket = (Math.round(t.pnl_pct * 100 * 2) / 2).toFixed(1);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    return Object.entries(buckets).sort(([a], [b]) => parseFloat(a) - parseFloat(b))
      .map(([pct, count]) => ({ pct: parseFloat(pct), count }));
  }, [result]);

  const retColor = (r: number) => r >= 0 ? "text-green-400" : "text-red-400";
  const winRateColor = (wr: number) => wr >= 60 ? "text-green-400" : wr >= 45 ? "text-yellow-400" : "text-red-400";

  // ── 指標選擇器（分組） ────────────────────────────────────────────────────
  const IndicatorSelector = () => {
    const groups = (["trend", "band", "oscillator", "strength", "volume"] as const);
    return (
      <div className="bg-[#0d0d0d] border border-[#2a2e39] rounded-lg">
        <button
          onClick={() => setIndicatorPanelOpen(p => !p)}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-[#787b86] hover:text-white transition-colors"
        >
          <span className="flex items-center gap-1 font-bold uppercase"><Settings2 size={11} /> 指標選擇器（{activeIndicators.size} 個已啟用）</span>
          {indicatorPanelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {indicatorPanelOpen && (
          <div className="px-3 pb-3 space-y-3 border-t border-[#1e1e1e]">
            {/* 子圖選擇 */}
            <div className="pt-2">
              <div className="text-[9px] text-[#787b86] uppercase font-bold mb-1.5">下方子圖</div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(SUB_CHART_LABELS) as SubChartType[]).map(s => (
                  <button key={s} onClick={() => setSubChart(s)}
                    className={`text-[9px] px-2 py-0.5 rounded font-bold transition-colors ${
                      subChart === s ? "bg-[#2962ff] text-white" : "text-[#787b86] hover:text-white border border-[#2a2e39]"
                    }`}>
                    {SUB_CHART_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            {/* 分組指標 */}
            {groups.map(group => {
              const keys = (Object.keys(INDICATOR_DEFS) as IndicatorKey[]).filter(k => INDICATOR_DEFS[k].group === group);
              return (
                <div key={group}>
                  <div className="text-[9px] text-[#787b86] uppercase font-bold mb-1.5">{GROUP_LABELS[group]}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {keys.map(key => {
                      const def = INDICATOR_DEFS[key];
                      const active = activeIndicators.has(key);
                      return (
                        <button key={key} onClick={() => toggleIndicator(key)}
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all"
                          style={active ? {
                            borderColor: def.color, backgroundColor: def.color + "25", color: def.color,
                          } : { borderColor: "#2a2e39", color: "#787b86" }}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ backgroundColor: active ? def.color : "#444" }} />
                          {def.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── 主圖（價格 + 疊加指標） ───────────────────────────────────────────────
  const PriceChart = () => {
    const priceIndicators = Array.from(activeIndicators).filter(k => INDICATOR_DEFS[k].subChart === "price");
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={40} />
          <Tooltip content={<CandleTooltip activeIndicators={activeIndicators} />} />
          {/* 疊加所有 price 子圖指標 */}
          {priceIndicators.map(key => {
            const def = INDICATOR_DEFS[key];
            return def.fields.map((field, fi) => (
              <Line key={`${key}-${field}`} type="monotone" dataKey={field}
                stroke={def.color} strokeWidth={fi === 0 ? 1.5 : 1}
                strokeDasharray={fi > 0 ? "4 2" : undefined}
                dot={false} connectNulls />
            ));
          })}
          {/* 收盤價 */}
          <Line type="monotone" dataKey="close" stroke="#d1d4dc" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: "#2962ff" }} />
          {/* 交易標記 */}
          <Scatter dataKey="entryLong"  fill="#089981" shape={(props: { cx?: number; cy?: number }) => {
            const { cx = 0, cy = 0 } = props;
            return <polygon points={`${cx},${cy - 8} ${cx - 5},${cy + 2} ${cx + 5},${cy + 2}`} fill="#089981" opacity={0.9} />;
          }} />
          <Scatter dataKey="entryShort" fill="#f23645" shape={(props: { cx?: number; cy?: number }) => {
            const { cx = 0, cy = 0 } = props;
            return <polygon points={`${cx},${cy + 8} ${cx - 5},${cy - 2} ${cx + 5},${cy - 2}`} fill="#f23645" opacity={0.9} />;
          }} />
          <Scatter dataKey="exitWin"  fill="#089981" shape="circle" />
          <Scatter dataKey="exitLoss" fill="#f23645" shape="square" />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  // ── 子圖渲染 ──────────────────────────────────────────────────────────────
  const SubChartPanel = () => {
    if (subChart === "none") return null;
    const height = 80;
    const common = { margin: { top: 0, right: 8, left: 0, bottom: 0 } };

    if (subChart === "rsi") {
      // 找出所有 rsi 子圖的指標
      const rsiKeys = Array.from(activeIndicators).filter(k => INDICATOR_DEFS[k].subChart === "rsi");
      const refLines = rsiKeys.flatMap(k => INDICATOR_DEFS[k].refLines ?? []);
      const uniqueRef = refLines.filter((r, i, arr) => arr.findIndex(x => x.y === r.y) === i);
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
            {uniqueRef.map((r, i) => <ReferenceLine key={i} y={r.y} stroke={r.color} strokeDasharray={r.dash} strokeWidth={1} />)}
            {rsiKeys.map(key => INDICATOR_DEFS[key].fields.map(f => (
              <Line key={f} type="monotone" dataKey={f} stroke={INDICATOR_DEFS[key].color} strokeWidth={1.5} dot={false} connectNulls />
            )))}
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (subChart === "macd") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
            <ReferenceLine y={0} stroke="#2a2e39" strokeWidth={1} />
            <Bar dataKey="macd_hist" opacity={0.75}>
              {chartData.map((entry, i) => <Cell key={i} fill={((entry as Record<string, unknown>).macd_hist as number ?? 0) >= 0 ? "#089981" : "#f23645"} />)}
            </Bar>
            <Line type="monotone" dataKey="macd"        stroke="#f97316" strokeWidth={1.2} dot={false} connectNulls />
            <Line type="monotone" dataKey="macd_signal" stroke="#3b82f6" strokeWidth={1.2} dot={false} strokeDasharray="4 2" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (subChart === "stoch") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} width={40} ticks={[20, 50, 80]} />
            <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
            <ReferenceLine y={80} stroke="#f23645" strokeDasharray="3 2" strokeWidth={1} />
            <ReferenceLine y={20} stroke="#089981" strokeDasharray="3 2" strokeWidth={1} />
            <Line type="monotone" dataKey="stoch_k" stroke="#818cf8" strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="stoch_d" stroke="#c084fc" strokeWidth={1.2} dot={false} strokeDasharray="4 2" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (subChart === "adx") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 60]} tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} width={40} ticks={[0, 25, 50]} />
            <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
            <ReferenceLine y={25} stroke="#787b86" strokeDasharray="3 2" strokeWidth={1} />
            <Line type="monotone" dataKey="adx"      stroke="#fbbf24" strokeWidth={1.8} dot={false} connectNulls />
            <Line type="monotone" dataKey="plus_di"  stroke="#089981" strokeWidth={1.2} dot={false} strokeDasharray="4 2" connectNulls />
            <Line type="monotone" dataKey="minus_di" stroke="#f23645" strokeWidth={1.2} dot={false} strokeDasharray="4 2" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (subChart === "volume") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} {...common}>
            <XAxis dataKey="time" hide />
            <YAxis tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
            <Bar dataKey="volume" opacity={0.65}>
              {chartData.map((entry, i) => <Cell key={i} fill={(entry.close as number) >= (entry.open as number) ? "#089981" : "#f23645"} />)}
            </Bar>
            <Line type="monotone" dataKey="vol_sma20" stroke="#94a3b8" strokeWidth={1.2} dot={false} connectNulls />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (subChart === "obv") {
      const obvKeys = Array.from(activeIndicators).filter(k => INDICATOR_DEFS[k].subChart === "obv");
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
            {obvKeys.map(key => INDICATOR_DEFS[key].fields.map(f => (
              <Line key={f} type="monotone" dataKey={f} stroke={INDICATOR_DEFS[key].color} strokeWidth={1.5} dot={false} connectNulls />
            )))}
            {obvKeys.length === 0 && (
              <Line type="monotone" dataKey="obv" stroke="#4ade80" strokeWidth={1.5} dot={false} connectNulls />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (subChart === "mfi") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} width={40} ticks={[20, 50, 80]} />
            <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
            <ReferenceLine y={80} stroke="#f23645" strokeDasharray="3 2" strokeWidth={1} />
            <ReferenceLine y={20} stroke="#089981" strokeDasharray="3 2" strokeWidth={1} />
            <Line type="monotone" dataKey="mfi" stroke="#67e8f9" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (subChart === "cci") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
            <ReferenceLine y={100}  stroke="#f23645" strokeDasharray="3 2" strokeWidth={1} />
            <ReferenceLine y={-100} stroke="#089981" strokeDasharray="3 2" strokeWidth={1} />
            <ReferenceLine y={0}    stroke="#2a2e39" strokeWidth={1} />
            <Line type="monotone" dataKey="cci" stroke="#fb7185" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (subChart === "roc") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${v.toFixed(1)}%`} />
            <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
            <ReferenceLine y={0} stroke="#2a2e39" strokeWidth={1} />
            <Bar dataKey="roc" opacity={0.7}>
              {chartData.map((entry, i) => <Cell key={i} fill={((entry as Record<string, unknown>).roc as number ?? 0) >= 0 ? "#089981" : "#f23645"} />)}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  // ── 圖例 ─────────────────────────────────────────────────────────────────
  const ChartLegend = () => {
    const priceKeys = Array.from(activeIndicators).filter(k => INDICATOR_DEFS[k].subChart === "price");
    return (
      <div className="flex flex-wrap items-center gap-2 px-1 text-[9px] text-[#787b86]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-[#089981]" /> 多單進場
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#f23645]" /> 空單進場
        </span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#089981] inline-block" /> 獲利出場</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#f23645] inline-block" /> 虧損出場</span>
        {priceKeys.map(key => (
          <span key={key} className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: INDICATOR_DEFS[key].color }} />
            {INDICATOR_DEFS[key].label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── 設定面板 ── */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4 border-b border-[#1e1e1e] pb-2">
          <Activity size={16} className="text-[#2962ff]" />
          <h3 className="text-sm font-bold text-white/90">策略回測引擎 V8.0</h3>
          <span className="ml-auto text-[10px] text-[#787b86]">全套指標 + K 線圖表</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-[#787b86] uppercase font-bold">選擇策略</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value as Strategy)}
              className="w-full bg-[#0d0d0d] border border-[#2a2e39] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2962ff]/50">
              {(Object.keys(STRATEGY_LABELS) as Strategy[]).map(s => (
                <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-[#787b86] uppercase font-bold">時間框架</label>
            <select value={interval} onChange={e => setInterval(e.target.value)}
              className="w-full bg-[#0d0d0d] border border-[#2a2e39] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2962ff]/50">
              {["15m", "1H", "4H", "1D"].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-[#787b86] uppercase font-bold">回測範圍 (K線)</label>
            <select value={limit} onChange={e => setLimit(Number(e.target.value))}
              className="w-full bg-[#0d0d0d] border border-[#2a2e39] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2962ff]/50">
              {[1000, 2000, 4320, 8640].map(v => <option key={v} value={v}>{v} 根</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleRun} disabled={runMutation.isPending}
              className="w-full bg-[#2962ff] hover:bg-[#2962ff]/80 text-white font-bold text-xs">
              {runMutation.isPending ? "回測中..." : "▶ 執行回測"}
            </Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-2 bg-[#2962ff]/5 border border-[#2962ff]/10 rounded flex items-start gap-2">
            <Info size={14} className="text-[#2962ff] mt-0.5 shrink-0" />
            <p className="text-[10px] text-[#787b86] leading-relaxed">{STRATEGY_DESC[strategy]}</p>
          </div>
          <div className="p-2 bg-[#f59e0b]/5 border border-[#f59e0b]/10 rounded">
            <div className="text-[10px] text-[#f59e0b] font-bold mb-1">此策略建議觀察指標</div>
            <div className="flex flex-wrap gap-1">
              {STRATEGY_INDICATORS[strategy].map(k => (
                <span key={k} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                  style={{ backgroundColor: INDICATOR_DEFS[k].color + "30", color: INDICATOR_DEFS[k].color }}>
                  {INDICATOR_DEFS[k].label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 結果區域 ── */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* 左側：核心指標 */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg p-4">
              <div className="text-[10px] text-[#787b86] uppercase font-bold mb-3">核心績效指標</div>
              <div className="space-y-3">
                {[
                  { label: "總收益率",   val: `${((result.total_return ?? 0) * 100).toFixed(2)}%`,  color: retColor(result.total_return ?? 0) },
                  { label: "勝率",       val: `${((result.win_rate ?? 0) * 100).toFixed(1)}%`,       color: winRateColor((result.win_rate ?? 0) * 100) },
                  { label: "盈虧比(PF)", val: (result.profit_factor ?? 0).toFixed(2),               color: "text-white/90" },
                  { label: "最大回撤",   val: `-${((result.max_drawdown ?? 0) * 100).toFixed(1)}%`, color: "text-[#f23645]" },
                  { label: "總交易數",   val: String(result.total_trades ?? 0),                     color: "text-white/80" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-end border-b border-[#1e1e1e] pb-2">
                    <span className="text-xs text-[#787b86]">{item.label}</span>
                    <span className={`text-base font-mono font-bold ${item.color}`}>{item.val}</span>
                  </div>
                ))}
                {result.total_r_multiple !== undefined && (
                  <div className="flex justify-between items-end border-b border-[#2962ff]/20 pb-2 bg-[#2962ff]/5 px-1 rounded">
                    <span className="text-xs text-[#2962ff]">累積 R 倍數</span>
                    <span className="text-base font-mono font-bold text-[#2962ff]">{result.total_r_multiple.toFixed(2)}R</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg p-4">
              <div className="text-[10px] text-[#787b86] uppercase font-bold mb-3">風險調整收益</div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: "Sharpe", val: (result.sharpe_ratio ?? 0).toFixed(2) }, { label: "Sortino", val: (result.sortino_ratio ?? 0).toFixed(2) }].map(item => (
                  <div key={item.label} className="bg-[#0d0d0d] p-2 rounded border border-[#2a2e39]">
                    <div className="text-[9px] text-[#787b86] uppercase">{item.label}</div>
                    <div className="text-sm font-mono text-white/80">{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
            {result.monte_carlo && (
              <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg p-4">
                <div className="text-[10px] text-[#787b86] uppercase font-bold mb-3">蒙地卡羅模擬</div>
                <div className="space-y-1 text-[10px]">
                  {[
                    { label: "P5 (悲觀)",  val: `${(result.monte_carlo.p5_return  * 100).toFixed(1)}%`, color: "text-[#f23645]" },
                    { label: "P50 (中位)", val: `${(result.monte_carlo.p50_return * 100).toFixed(1)}%`, color: "text-white/80" },
                    { label: "P95 (樂觀)", val: `${(result.monte_carlo.p95_return * 100).toFixed(1)}%`, color: "text-[#089981]" },
                    { label: "破產機率",   val: `${(result.monte_carlo.ruin_probability * 100).toFixed(1)}%`, color: "text-[#f97316]" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between">
                      <span className="text-[#787b86]">{item.label}</span>
                      <span className={`font-mono font-bold ${item.color}`}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右側：圖表 */}
          <div className="lg:col-span-3 bg-[#141414] border border-[#1e1e1e] rounded-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e]">
              <div className="flex gap-4">
                {[
                  { id: "chart",  label: "K 線圖表" },
                  { id: "equity", label: "資金曲線" },
                  { id: "trades", label: "交易歷史" },
                  { id: "stats",  label: "統計分析" },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setDetailTab(tab.id as typeof detailTab)}
                    className={`text-xs font-bold transition-colors ${detailTab === tab.id ? "text-[#2962ff]" : "text-[#787b86] hover:text-white"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-[#089981]" />
                <span className="text-[10px] text-[#787b86]">含 0.08% 手續費</span>
              </div>
            </div>

            <div className="flex-1 p-4 min-h-[480px]">
              {/* K 線圖表 */}
              {detailTab === "chart" && (
                <div className="space-y-2 h-full">
                  <IndicatorSelector />
                  {chartData.length > 0 ? (
                    <>
                      <PriceChart />
                      <SubChartPanel />
                      <ChartLegend />
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-[#787b86] text-sm">圖表資料載入中...</div>
                  )}
                </div>
              )}

              {/* 資金曲線 */}
              {detailTab === "equity" && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurveData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2962ff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2962ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2e39" vertical={false} />
                    <XAxis dataKey="index" hide />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#787b86" }} axisLine={false} tickLine={false}
                      tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "11px", color: "#d1d4dc" }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, "Equity"]} />
                    <Area type="monotone" dataKey="value" stroke="#2962ff" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {/* 交易歷史 */}
              {detailTab === "trades" && (
                <div className="overflow-auto max-h-[480px] custom-scrollbar">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="sticky top-0 bg-[#141414] border-b border-[#2a2e39] text-[#787b86] uppercase font-bold">
                      <tr>
                        <th className="py-2 px-2">進場時間</th>
                        <th className="py-2 px-2">方向</th>
                        <th className="py-2 px-2">進場價</th>
                        <th className="py-2 px-2">出場價</th>
                        <th className="py-2 px-2">PNL%</th>
                        <th className="py-2 px-2">PNL ($)</th>
                        <th className="py-2 px-2">原因</th>
                        {result.trades?.some(t => t.r_multiple !== undefined) && <th className="py-2 px-2">R 倍數</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e1e1e]">
                      {result.trades?.map((t, i) => (
                        <tr key={i} className="hover:bg-[#1e222d]/50 transition-colors">
                          <td className="py-1.5 px-2 text-[#787b86]">{new Date(t.entry_time * 1000).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                          <td className={`py-1.5 px-2 font-bold ${t.direction === "long" ? "text-[#089981]" : "text-[#f23645]"}`}>
                            {t.direction === "long" ? "▲ LONG" : "▼ SHORT"}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-white/80">{t.entry_price.toFixed(1)}</td>
                          <td className="py-1.5 px-2 font-mono text-white/80">{t.exit_price.toFixed(1)}</td>
                          <td className={`py-1.5 px-2 font-mono font-bold ${retColor(t.pnl_pct)}`}>{(t.pnl_pct * 100).toFixed(2)}%</td>
                          <td className={`py-1.5 px-2 font-mono ${retColor(t.pnl)}`}>${t.pnl.toFixed(2)}</td>
                          <td className="py-1.5 px-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                              t.exit_reason === "tp" ? "bg-[#089981]/20 text-[#089981]" :
                              t.exit_reason === "sl" ? "bg-[#f23645]/20 text-[#f23645]" : "bg-[#2a2e39] text-[#787b86]"
                            }`}>{t.exit_reason}</span>
                          </td>
                          {result.trades?.some(t => t.r_multiple !== undefined) && (
                            <td className={`py-1.5 px-2 font-mono ${retColor(t.r_multiple ?? 0)}`}>
                              {t.r_multiple !== undefined ? `${t.r_multiple.toFixed(2)}R` : "—"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 統計分析 */}
              {detailTab === "stats" && (
                <div className="space-y-4 overflow-auto max-h-[480px] custom-scrollbar">
                  {monthlyData.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[#787b86] uppercase font-bold mb-2">月度收益率</div>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={monthlyData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
                          <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }}
                            formatter={(v: number) => [`${v.toFixed(2)}%`, "月收益率"]} />
                          <ReferenceLine y={0} stroke="#2a2e39" />
                          <Bar dataKey="pnl_pct" radius={[2, 2, 0, 0]}>
                            {monthlyData.map((entry, i) => <Cell key={i} fill={entry.pnl_pct >= 0 ? "#089981" : "#f23645"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {pnlDistData.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[#787b86] uppercase font-bold mb-2">交易 PnL 分布</div>
                      <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={pnlDistData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" vertical={false} />
                          <XAxis dataKey="pct" tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                          <YAxis tick={{ fontSize: 9, fill: "#787b86" }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: "#1e222d", border: "1px solid #2a2e39", fontSize: "10px" }} />
                          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                            {pnlDistData.map((entry, i) => <Cell key={i} fill={entry.pct >= 0 ? "#089981" : "#f23645"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {result.trades && result.trades.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[#787b86] uppercase font-bold mb-2">出場原因統計</div>
                      <div className="grid grid-cols-3 gap-2">
                        {["tp", "sl", "trailing"].map(reason => {
                          const count = result.trades!.filter(t => t.exit_reason === reason).length;
                          const total = result.trades!.length;
                          return (
                            <div key={reason} className="bg-[#0d0d0d] rounded border border-[#2a2e39] p-2 text-center">
                              <div className={`text-xs font-bold uppercase ${reason === "tp" ? "text-[#089981]" : reason === "sl" ? "text-[#f23645]" : "text-[#f97316]"}`}>{reason}</div>
                              <div className="text-base font-mono font-bold text-white/90">{count}</div>
                              <div className="text-[9px] text-[#787b86]">{total > 0 ? (count / total * 100).toFixed(1) : 0}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
