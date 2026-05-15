// KlinePanel v3 — 全套技術指標選擇器 + lightweight-charts 多子圖
import { useEffect, useRef, useMemo, useState } from "react";
import { Maximize2, Minimize2, Settings2, Fingerprint, BarChart2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
import type { Timeframe, CryptoSnapshot } from "@shared/cryptoTypes";
import {
  createChart, CandlestickSeries, LineSeries, HistogramSeries,
  type IChartApi, type ISeriesApi,
  type CandlestickSeriesOptions, type LineSeriesOptions, type HistogramSeriesOptions,
  ColorType, CrosshairMode,
} from "lightweight-charts";

interface Props {
  symbol: string; timeframe: Timeframe; livePrice?: number | null;
  activeEmas?: number[]; height?: number; snapshot?: CryptoSnapshot | null;
  showVolume?: boolean; showMacd?: boolean; showSR?: boolean;
  showOB?: boolean; showMarkers?: boolean; showCvd?: boolean;
  showTpo?: boolean; showTrendline?: boolean;
}

type IndicatorKey =
  | "sma10" | "sma20" | "sma50" | "sma200"
  | "ema9" | "ema20" | "ema50" | "ema200" | "vwap"
  | "bb" | "bb1" | "keltner"
  | "rsi" | "rsi9" | "macd" | "stoch" | "will_r" | "cci" | "roc"
  | "adx" | "obv" | "cvd" | "mfi" | "volume";

interface IndicatorDef {
  label: string; color: string;
  group: "trend" | "band" | "oscillator" | "strength" | "volume";
  pane: "price" | "sub";
  subType?: "rsi" | "macd" | "stoch" | "adx" | "obv" | "mfi" | "volume" | "cci" | "roc";
}

const INDICATOR_DEFS: Record<IndicatorKey, IndicatorDef> = {
  sma10:   { label: "SMA 10",      color: "#facc15", group: "trend",      pane: "price" },
  sma20:   { label: "SMA 20",      color: "#fb923c", group: "trend",      pane: "price" },
  sma50:   { label: "SMA 50",      color: "#60a5fa", group: "trend",      pane: "price" },
  sma200:  { label: "SMA 200",     color: "#c084fc", group: "trend",      pane: "price" },
  ema9:    { label: "EMA 9",       color: "#fde047", group: "trend",      pane: "price" },
  ema20:   { label: "EMA 20",      color: "#f59e0b", group: "trend",      pane: "price" },
  ema50:   { label: "EMA 50",      color: "#3b82f6", group: "trend",      pane: "price" },
  ema200:  { label: "EMA 200",     color: "#a855f7", group: "trend",      pane: "price" },
  vwap:    { label: "VWAP",        color: "#22d3ee", group: "trend",      pane: "price" },
  bb:      { label: "布林帶 2σ",   color: "#06b6d4", group: "band",       pane: "price" },
  bb1:     { label: "布林帶 1σ",   color: "#0891b2", group: "band",       pane: "price" },
  keltner: { label: "Keltner",     color: "#14b8a6", group: "band",       pane: "price" },
  rsi:     { label: "RSI(14)",     color: "#10b981", group: "oscillator", pane: "sub", subType: "rsi" },
  rsi9:    { label: "RSI(9)",      color: "#34d399", group: "oscillator", pane: "sub", subType: "rsi" },
  macd:    { label: "MACD",        color: "#f97316", group: "oscillator", pane: "sub", subType: "macd" },
  stoch:   { label: "Stoch",       color: "#818cf8", group: "oscillator", pane: "sub", subType: "stoch" },
  will_r:  { label: "Williams %R", color: "#f472b6", group: "oscillator", pane: "sub", subType: "rsi" },
  cci:     { label: "CCI(20)",     color: "#fb7185", group: "oscillator", pane: "sub", subType: "cci" },
  roc:     { label: "ROC(10)",     color: "#a3e635", group: "oscillator", pane: "sub", subType: "roc" },
  adx:     { label: "ADX(14)",     color: "#fbbf24", group: "strength",   pane: "sub", subType: "adx" },
  obv:     { label: "OBV",         color: "#4ade80", group: "volume",     pane: "sub", subType: "obv" },
  cvd:     { label: "CVD",         color: "#86efac", group: "volume",     pane: "sub", subType: "obv" },
  mfi:     { label: "MFI(14)",     color: "#67e8f9", group: "volume",     pane: "sub", subType: "mfi" },
  volume:  { label: "成交量",       color: "#94a3b8", group: "volume",     pane: "sub", subType: "volume" },
};

const GROUP_LABELS = {
  trend: "趨勢均線", band: "帶狀通道", oscillator: "震盪指標", strength: "趨勢強度", volume: "成交量",
};

type SubType = "rsi" | "macd" | "stoch" | "adx" | "obv" | "mfi" | "volume" | "cci" | "roc" | "none";
const SUB_LABELS: Record<SubType, string> = {
  none: "無", rsi: "RSI", macd: "MACD", stoch: "Stoch",
  adx: "ADX", obv: "OBV/CVD", mfi: "MFI", volume: "成交量", cci: "CCI", roc: "ROC",
};

const DEFAULT_STRATEGY_INDICATORS: IndicatorKey[] = ["ema20", "ema50", "rsi", "macd", "adx"];

function getIndicatorFields(key: IndicatorKey): string[] {
  const map: Record<IndicatorKey, string[]> = {
    sma10: ["sma10"], sma20: ["sma20"], sma50: ["sma50"], sma200: ["sma200"],
    ema9: ["ema9"], ema20: ["ema20"], ema50: ["ema50"], ema200: ["ema200"],
    vwap: ["vwap"],
    bb: ["bb_upper", "bb_mid", "bb_lower"], bb1: ["bb1_upper", "bb1_lower"],
    keltner: ["kelt_upper", "kelt_lower"],
    rsi: ["rsi"], rsi9: ["rsi9"],
    macd: ["macd", "macd_signal", "macd_hist"],
    stoch: ["stoch_k", "stoch_d"],
    will_r: ["will_r"], cci: ["cci"], roc: ["roc"],
    adx: ["adx", "plus_di", "minus_di"],
    obv: ["obv"], cvd: ["cvd"], mfi: ["mfi"], volume: ["volume"],
  };
  return map[key] ?? [];
}

type CandleWithIndicators = Record<string, number | null> & {
  time: number; open: number; high: number; low: number; close: number; volume: number;
};

// ── SMC / 纏論結構選擇器定義 ──
type StructureKey = "fvg_bull" | "fvg_bear" | "ob_bull" | "ob_bear" | "bos_choch" | "chan_bi" | "chan_zhongshu";
const STRUCTURE_DEFS: Record<StructureKey, { label: string; color: string; group: "smc" | "chan" }> = {
  fvg_bull:     { label: "FVG 多",    color: "#26d48a", group: "smc" },
  fvg_bear:     { label: "FVG 空",    color: "#f04f5e", group: "smc" },
  ob_bull:      { label: "OB 多",     color: "#4f9e6a", group: "smc" },
  ob_bear:      { label: "OB 空",     color: "#b04060", group: "smc" },
  bos_choch:    { label: "BOS/CHoCH", color: "#f59e0b", group: "smc" },
  chan_bi:      { label: "纏論筆",    color: "#818cf8", group: "chan" },
  chan_zhongshu:{ label: "中樞",      color: "#c084fc", group: "chan" },
};

export function KlinePanel({ symbol, timeframe, livePrice, height = 280, snapshot }: Props) {
  const isMobile = useIsMobile();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const subChartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const subChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlaySeriesRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const subSeriesRefs = useRef<ISeriesApi<"Line" | "Histogram">[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const [hoveredOhlcv, setHoveredOhlcv] = useState<{ o: number; h: number; l: number; c: number; v: number; time: string | number } | null>(null);
  const [hoveredIndicators, setHoveredIndicators] = useState<Record<string, number | null>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(new Set(DEFAULT_STRATEGY_INDICATORS));
  const [subChart, setSubChart] = useState<SubType>("rsi");
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false);
  const [activeStructures, setActiveStructures] = useState<Set<StructureKey>>(new Set(["fvg_bull", "fvg_bear", "ob_bull", "ob_bear", "bos_choch", "chan_bi", "chan_zhongshu"]));
  const smcSeriesRefs = useRef<ISeriesApi<"Line" | "Histogram">[]>([]);
  const [klineLimit, setKlineLimit] = useState(isMobile ? 150 : 500);

  const toggleStructure = (key: StructureKey) => {
    setActiveStructures(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const { data: structureData } = trpc.crypto.getKlineStructures.useQuery(
    { symbol, timeframe, limit: klineLimit },
    { refetchInterval: 90_000 }
  );

  const { data: candlesRaw } = trpc.crypto.getKlines.useQuery(
    { symbol, timeframe, limit: klineLimit, withIndicators: true },
    { refetchInterval: 60_000 }
  );
  const candles = candlesRaw as CandleWithIndicators[] | undefined;

  // [修復] sortedCandles: 排序與去重後的完整 candle 資料（含指標欄位），供 K 線圖與指標一起使用
  const sortedCandles = useMemo((): CandleWithIndicators[] => {
    if (!candles?.length) return [];
    const seen = new Set<number>();
    return candles
      .map(c => ({ ...c, time: c.time > 1_000_000_000_000 ? Math.floor(c.time / 1000) : Math.floor(c.time) } as CandleWithIndicators))
      .sort((a, b) => a.time - b.time)
      .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });
  }, [candles]);

  const chartCandles = useMemo(() => {
    return sortedCandles.map(c => ({
      time: c.time as unknown as import("lightweight-charts").Time,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
  }, [sortedCandles]);

  const toggleIndicator = (key: IndicatorKey) => {
    setActiveIndicators(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── 主圖建立 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; candleSeriesRef.current = null; overlaySeriesRefs.current.clear(); }
    const chart = createChart(container, {
      width: container.clientWidth,
      height: isMobile ? height - 60 : height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#787b86", fontSize: isMobile ? 10 : 11 },
      grid: { vertLines: { color: "rgba(42,46,57,0.3)" }, horzLines: { color: "rgba(42,46,57,0.3)" } },
      crosshair: {
        mode: isMobile ? CrosshairMode.Magnet : CrosshairMode.Normal,
        vertLine: { color: "rgba(41,98,255,0.5)", width: 1, labelBackgroundColor: "#2962ff" },
        horzLine: { color: "rgba(41,98,255,0.5)", width: 1, labelBackgroundColor: "#2962ff" },
      },
      rightPriceScale: { borderColor: "#2a2e39", scaleMargins: { top: 0.1, bottom: 0.15 } },
      timeScale: { borderColor: "#2a2e39", timeVisible: true, secondsVisible: false, fixLeftEdge: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26d48a", downColor: "#f04f5e",
      borderUpColor: "#26d48a", borderDownColor: "#f04f5e",
      wickUpColor: "#26d48a", wickDownColor: "#f04f5e",
    } as Partial<CandlestickSeriesOptions>);
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    chart.subscribeCrosshairMove(param => {
      if (param.point && param.time && candles) {
        const data = param.seriesData.get(candleSeries) as { open: number; high: number; low: number; close: number } | undefined;
        if (data) {
          const idx = chartCandles.findIndex(c => (c.time as unknown as number) === param.time);
          setHoveredOhlcv({ o: data.open, h: data.high, l: data.low, c: data.close, v: idx >= 0 ? sortedCandles[idx]?.volume ?? 0 : 0, time: param.time as string | number });
          if (idx >= 0 && sortedCandles[idx]) {
            const c = sortedCandles[idx];
            const indVals: Record<string, number | null> = {};
            for (const key of Array.from(activeIndicators)) {
              for (const f of getIndicatorFields(key)) {
                const v = c[f];
                indVals[f] = typeof v === "number" ? v : null;
              }
            }
            setHoveredIndicators(indVals);
          }
        }
      } else { setHoveredOhlcv(null); setHoveredIndicators({}); }
    });
    const ro = new ResizeObserver(() => { if (container && chartRef.current) chartRef.current.applyOptions({ width: container.clientWidth }); });
    ro.observe(container);
    return () => { ro.disconnect(); if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, [height, symbol, timeframe, isMobile]);

  // ── K 線資料更新 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (candleSeriesRef.current && chartCandles.length) {
      candleSeriesRef.current.setData(chartCandles as Parameters<typeof candleSeriesRef.current.setData>[0]);
      chartRef.current?.timeScale().fitContent();
    }
  }, [chartCandles]);

  // ── 疊加指標更新 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !sortedCandles.length) return;
    overlaySeriesRefs.current.forEach(s => { try { chart.removeSeries(s); } catch {} });
    overlaySeriesRefs.current.clear();
    const timeArr = chartCandles.map(c => c.time);
    for (const key of Array.from(activeIndicators).filter(k => INDICATOR_DEFS[k].pane === "price")) {
      const def = INDICATOR_DEFS[key];
      getIndicatorFields(key).forEach((field, fi) => {
        const series = chart.addSeries(LineSeries, {
          color: def.color, lineWidth: fi === 0 ? 1.5 : 1, lineStyle: fi > 0 ? 2 : 0,
          priceLineVisible: false, lastValueVisible: !isMobile, crosshairMarkerVisible: false,
        } as Partial<LineSeriesOptions>);
        // [修復] 使用 sortedCandles 確保時間序列與 chartCandles 一致
        const data = sortedCandles.map((c, i) => {
          const v = c[field];
          if (v == null || typeof v !== "number") return null;
          return { time: timeArr[i], value: v };
        }).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];
        series.setData(data);
        overlaySeriesRefs.current.set(`${key}-${field}`, series);
      });
    }
  }, [activeIndicators, sortedCandles, chartCandles, isMobile]);

  // ── SMC / 纏論結構標記（使用 Recharts 層疊图覆蓋在 lightweight-charts 上方）──
  // 由於 lightweight-charts 不支援任意形狀，我們用 SVG overlay 絕對定位方式繪製標記
  // 不需要圖表库，直接用 lightweight-charts 的 LineSeries 繪製水平線表示區域
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !sortedCandles.length || !structureData) return;
    // 清除舊的 SMC 結構系列
    smcSeriesRefs.current.forEach(s => { try { chart.removeSeries(s); } catch {} });
    smcSeriesRefs.current = [];
    const timeArr = chartCandles.map(c => c.time);
    const { smc, chan } = structureData;
    // ── FVG 多（綠色半透明區域）──
    if (activeStructures.has("fvg_bull") && smc?.fvgs_bull) {
      for (const fvg of smc.fvgs_bull) {
        const s = chart.addSeries(LineSeries, { color: "#26d48a", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        const t = timeArr[Math.min(fvg.candle_idx, timeArr.length - 1)] ?? timeArr[timeArr.length - 1];
        const tEnd = timeArr[timeArr.length - 1];
        if (t && tEnd) { s.setData([{ time: t, value: fvg.top }, { time: tEnd, value: fvg.top }]); smcSeriesRefs.current.push(s as ISeriesApi<"Line" | "Histogram">); }
        const s2 = chart.addSeries(LineSeries, { color: "#26d48a", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        if (t && tEnd) { s2.setData([{ time: t, value: fvg.bottom }, { time: tEnd, value: fvg.bottom }]); smcSeriesRefs.current.push(s2 as ISeriesApi<"Line" | "Histogram">); }
      }
    }
    // ── FVG 空（紅色半透明區域）──
    if (activeStructures.has("fvg_bear") && smc?.fvgs_bear) {
      for (const fvg of smc.fvgs_bear) {
        const s = chart.addSeries(LineSeries, { color: "#f04f5e", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        const t = timeArr[Math.min(fvg.candle_idx, timeArr.length - 1)] ?? timeArr[timeArr.length - 1];
        const tEnd = timeArr[timeArr.length - 1];
        if (t && tEnd) { s.setData([{ time: t, value: fvg.top }, { time: tEnd, value: fvg.top }]); smcSeriesRefs.current.push(s as ISeriesApi<"Line" | "Histogram">); }
        const s2 = chart.addSeries(LineSeries, { color: "#f04f5e", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        if (t && tEnd) { s2.setData([{ time: t, value: fvg.bottom }, { time: tEnd, value: fvg.bottom }]); smcSeriesRefs.current.push(s2 as ISeriesApi<"Line" | "Histogram">); }
      }
    }
    // ── OB 多（綠色實線）──
    if (activeStructures.has("ob_bull") && smc?.obs_bull) {
      for (const ob of smc.obs_bull) {
        const s = chart.addSeries(LineSeries, { color: "#4f9e6a", lineWidth: ob.strength === "strong" ? 2 : 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        const tEnd = timeArr[timeArr.length - 1];
        if (tEnd) { s.setData([{ time: timeArr[0], value: ob.top }, { time: tEnd, value: ob.top }]); smcSeriesRefs.current.push(s as ISeriesApi<"Line" | "Histogram">); }
        const s2 = chart.addSeries(LineSeries, { color: "#4f9e6a", lineWidth: ob.strength === "strong" ? 2 : 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        if (tEnd) { s2.setData([{ time: timeArr[0], value: ob.bottom }, { time: tEnd, value: ob.bottom }]); smcSeriesRefs.current.push(s2 as ISeriesApi<"Line" | "Histogram">); }
      }
    }
    // ── OB 空（紅色實線）──
    if (activeStructures.has("ob_bear") && smc?.obs_bear) {
      for (const ob of smc.obs_bear) {
        const s = chart.addSeries(LineSeries, { color: "#b04060", lineWidth: ob.strength === "strong" ? 2 : 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        const tEnd = timeArr[timeArr.length - 1];
        if (tEnd) { s.setData([{ time: timeArr[0], value: ob.top }, { time: tEnd, value: ob.top }]); smcSeriesRefs.current.push(s as ISeriesApi<"Line" | "Histogram">); }
        const s2 = chart.addSeries(LineSeries, { color: "#b04060", lineWidth: ob.strength === "strong" ? 2 : 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        if (tEnd) { s2.setData([{ time: timeArr[0], value: ob.bottom }, { time: tEnd, value: ob.bottom }]); smcSeriesRefs.current.push(s2 as ISeriesApi<"Line" | "Histogram">); }
      }
    }
    // ── BOS/CHoCH 標記（橫線）──
    if (activeStructures.has("bos_choch") && smc?.bos_choch) {
      for (const b of smc.bos_choch) {
        const color = b.direction === "bullish" ? "#f59e0b" : "#f97316";
        const s = chart.addSeries(LineSeries, { color, lineWidth: 1, lineStyle: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        const t = timeArr[Math.min(b.idx, timeArr.length - 1)] ?? timeArr[timeArr.length - 1];
        const tEnd = timeArr[timeArr.length - 1];
        if (t && tEnd) { s.setData([{ time: t, value: b.price }, { time: tEnd, value: b.price }]); smcSeriesRefs.current.push(s as ISeriesApi<"Line" | "Histogram">); }
      }
    }
    // ── 纏論筆（紫色折線）──
    if (activeStructures.has("chan_bi") && chan?.bis) {
      for (const bi of chan.bis) {
        const color = bi.direction === "up" ? "#818cf8" : "#a78bfa";
        const s = chart.addSeries(LineSeries, { color, lineWidth: 2 as 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
        const tStart = (bi.start_time > 1e12 ? Math.floor(bi.start_time / 1000) : bi.start_time) as unknown as import("lightweight-charts").Time;
        const tEnd   = (bi.end_time   > 1e12 ? Math.floor(bi.end_time   / 1000) : bi.end_time)   as unknown as import("lightweight-charts").Time;
        if (tStart && tEnd) { s.setData([{ time: tStart, value: bi.start }, { time: tEnd, value: bi.end }]); smcSeriesRefs.current.push(s as ISeriesApi<"Line" | "Histogram">); }
      }
    }
    // ── 纏論中樞（紫色水平區域）──
    if (activeStructures.has("chan_zhongshu") && chan?.in_zhongshu && chan.zhongshu_top && chan.zhongshu_bottom) {
      const s = chart.addSeries(LineSeries, { color: "#c084fc", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
      const tEnd = timeArr[timeArr.length - 1];
      if (tEnd) { s.setData([{ time: timeArr[0], value: chan.zhongshu_top }, { time: tEnd, value: chan.zhongshu_top }]); smcSeriesRefs.current.push(s as ISeriesApi<"Line" | "Histogram">); }
      const s2 = chart.addSeries(LineSeries, { color: "#c084fc", lineWidth: 2, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
      if (tEnd) { s2.setData([{ time: timeArr[0], value: chan.zhongshu_bottom }, { time: tEnd, value: chan.zhongshu_bottom }]); smcSeriesRefs.current.push(s2 as ISeriesApi<"Line" | "Histogram">); }
    }
  }, [activeStructures, structureData, chartCandles, sortedCandles]);

  // ── 子圖建立 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = subChartContainerRef.current;
    if (!container) return;
    if (subChartRef.current) { subChartRef.current.remove(); subChartRef.current = null; subSeriesRefs.current = []; }
    if (subChart === "none" || !sortedCandles.length) return;
    const chart = createChart(container, {
      width: container.clientWidth, height: 90,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#787b86", fontSize: 10 },
      grid: { vertLines: { color: "rgba(42,46,57,0.2)" }, horzLines: { color: "rgba(42,46,57,0.2)" } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "rgba(41,98,255,0.4)", width: 1, labelBackgroundColor: "#2962ff" }, horzLine: { color: "rgba(41,98,255,0.4)", width: 1, labelBackgroundColor: "#2962ff" } },
      rightPriceScale: { borderColor: "#2a2e39", scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: "#2a2e39", visible: false },
      handleScroll: false, handleScale: false,
    });
    subChartRef.current = chart;
    const timeArr = chartCandles.map(c => c.time);
    const addLine = (field: string, color: string, width = 1.5, dash = 0) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: width as 1, lineStyle: dash, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false } as Partial<LineSeriesOptions>);
      // [修復] 使用 sortedCandles 確保時間序列一致
      const data = sortedCandles.map((c, i) => { const v = c[field]; if (v == null || typeof v !== "number") return null; return { time: timeArr[i], value: v }; }).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];
      s.setData(data);
      subSeriesRefs.current.push(s as ISeriesApi<"Line" | "Histogram">);
    };
    const addHist = (field: string, colorUp: string, colorDown: string) => {
      const s = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false } as Partial<HistogramSeriesOptions>);
      // [修復] 使用 sortedCandles 確保時間序列一致
      const data = sortedCandles.map((c, i) => { const v = c[field]; if (v == null || typeof v !== "number") return null; return { time: timeArr[i], value: v, color: v >= 0 ? colorUp : colorDown }; }).filter(Boolean) as { time: import("lightweight-charts").Time; value: number; color: string }[];
      s.setData(data);
      subSeriesRefs.current.push(s as ISeriesApi<"Line" | "Histogram">);
    };
    if (subChart === "rsi") {
      if (activeIndicators.has("rsi"))    addLine("rsi",    "#10b981", 1.5);
      if (activeIndicators.has("rsi9"))   addLine("rsi9",   "#34d399", 1.2, 2);
      if (activeIndicators.has("will_r")) addLine("will_r", "#f472b6", 1.2);
      if (!activeIndicators.has("rsi") && !activeIndicators.has("rsi9") && !activeIndicators.has("will_r")) addLine("rsi", "#10b981", 1.5);
    } else if (subChart === "macd") {
      addHist("macd_hist", "#089981", "#f23645");
      addLine("macd", "#f97316", 1.2);
      addLine("macd_signal", "#3b82f6", 1.2, 2);
    } else if (subChart === "stoch") {
      addLine("stoch_k", "#818cf8", 1.5);
      addLine("stoch_d", "#c084fc", 1.2, 2);
    } else if (subChart === "adx") {
      addLine("adx", "#fbbf24", 1.8);
      addLine("plus_di", "#089981", 1.2, 2);
      addLine("minus_di", "#f23645", 1.2, 2);
    } else if (subChart === "obv") {
      if (activeIndicators.has("obv")) addLine("obv", "#4ade80", 1.5);
      if (activeIndicators.has("cvd")) addLine("cvd", "#86efac", 1.2, 2);
      if (!activeIndicators.has("obv") && !activeIndicators.has("cvd")) addLine("obv", "#4ade80", 1.5);
    } else if (subChart === "mfi") {
      addLine("mfi", "#67e8f9", 1.5);
    } else if (subChart === "volume") {
      addHist("volume", "#089981", "#f23645");
      addLine("vol_sma20", "#94a3b8", 1.2);
    } else if (subChart === "cci") {
      addLine("cci", "#fb7185", 1.5);
    } else if (subChart === "roc") {
      addHist("roc", "#089981", "#f23645");
    }
    if (chartRef.current) {
      chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range && subChartRef.current) subChartRef.current.timeScale().setVisibleLogicalRange(range);
      });
    }
    const ro = new ResizeObserver(() => { if (container && subChartRef.current) subChartRef.current.applyOptions({ width: container.clientWidth }); });
    ro.observe(container);
    return () => { ro.disconnect(); if (subChartRef.current) { subChartRef.current.remove(); subChartRef.current = null; } };
  }, [subChart, activeIndicators, sortedCandles, chartCandles]);

  // ── 即時價格更新 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (candleSeriesRef.current && livePrice && chartCandles.length > 0) {
      const last = chartCandles[chartCandles.length - 1];
      if (last) {
        try {
          candleSeriesRef.current.update({ time: last.time, open: last.open, high: Math.max(last.high, livePrice), low: Math.min(last.low, livePrice), close: livePrice });
        } catch {}
      }
    }
  }, [livePrice, chartCandles]);

  return (
    <div ref={panelRef} className={`relative flex flex-col h-full w-full bg-[#0e1117] overflow-hidden ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
      {/* ── HUD 頂部 ── */}
      <div className="absolute top-2 left-3 z-10 pointer-events-none flex flex-col gap-1">
        <div className="flex items-center gap-2 bg-[#1e222d]/80 backdrop-blur-sm px-2 py-1 rounded border border-[#2a3148] shadow-lg">
          <span className="text-[10px] sm:text-[11px] font-bold text-white">{symbol}</span>
          <span className="text-[9px] sm:text-[10px] text-[#8896b0]">{timeframe.toUpperCase()}</span>
          {hoveredOhlcv && (
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono">
              <span className="text-[#8896b0]">O<span className="text-white ml-0.5">{hoveredOhlcv.o.toFixed(1)}</span></span>
              <span className="text-[#8896b0]">H<span className="text-white ml-0.5">{hoveredOhlcv.h.toFixed(1)}</span></span>
              <span className="text-[#8896b0]">L<span className="text-white ml-0.5">{hoveredOhlcv.l.toFixed(1)}</span></span>
              <span className="text-[#8896b0]">C<span className={`ml-0.5 ${hoveredOhlcv.c >= hoveredOhlcv.o ? "text-[#089981]" : "text-[#f23645]"}`}>{hoveredOhlcv.c.toFixed(1)}</span></span>
            </div>
          )}
        </div>
        {hoveredOhlcv && Object.keys(hoveredIndicators).length > 0 && (
          <div className="flex flex-wrap gap-1 pointer-events-none">
            {Array.from(activeIndicators).filter(k => INDICATOR_DEFS[k].pane === "price").map(key => {
              const fields = getIndicatorFields(key);
              const v = hoveredIndicators[fields[0]];
              if (v == null) return null;
              return (
                <span key={key} className="text-[9px] font-mono px-1 py-0.5 rounded bg-[#1e222d]/80 border border-[#2a3148]" style={{ color: INDICATOR_DEFS[key].color }}>
                  {INDICATOR_DEFS[key].label}: {v.toFixed(2)}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 右上角工具列 ── */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        {/* K 線數量快速切換 */}
        <div className="flex items-center rounded overflow-hidden border border-[#2a3148] bg-[#1e222d]/80">
          {(isMobile ? [100, 200, 500] : [200, 500, 1000]).map(n => (
            <button key={n} onClick={() => setKlineLimit(n)}
              className={`px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
                klineLimit === n ? "bg-[#2962ff] text-white" : "text-[#8896b0] hover:text-white"
              }`}>
              {n >= 1000 ? "1K" : n}
            </button>
          ))}
        </div>
        <button onClick={() => setIndicatorPanelOpen(p => !p)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-colors border ${indicatorPanelOpen ? "bg-[#2962ff] text-white border-[#2962ff]" : "bg-[#1e222d]/80 text-[#8896b0] hover:text-white border-[#2a3148]"}`}>
          <Settings2 size={11} />
          {!isMobile && <span>指標</span>}
          <span className="text-[9px] opacity-70">({activeIndicators.size})</span>
        </button>
        <button onClick={() => setIsFullscreen(p => !p)} className="p-1.5 rounded bg-[#1e222d]/80 text-[#8896b0] hover:text-white border border-[#2a3148] transition-colors">
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* ── 指標選擇面板 ── */}
      {indicatorPanelOpen && (
        <div className="absolute top-10 right-2 z-30 w-72 bg-[#1e222d] border border-[#2a3148] rounded-lg shadow-2xl p-3 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white uppercase">技術指標選擇器</span>
            <button onClick={() => setIndicatorPanelOpen(false)} className="text-[#8896b0] hover:text-white text-xs">✕</button>
          </div>
          {/* 子圖 */}
          <div>
            <div className="text-[9px] text-[#8896b0] uppercase font-bold mb-1.5">下方子圖</div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(SUB_LABELS) as SubType[]).map(s => (
                <button key={s} onClick={() => setSubChart(s)}
                  className={`text-[9px] px-2 py-0.5 rounded font-bold transition-colors ${subChart === s ? "bg-[#2962ff] text-white" : "text-[#8896b0] hover:text-white border border-[#2a3148]"}`}>
                  {SUB_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          {/* 分組指標 */}
          {(["trend", "band", "oscillator", "strength", "volume"] as const).map(group => {
            const keys = (Object.keys(INDICATOR_DEFS) as IndicatorKey[]).filter(k => INDICATOR_DEFS[k].group === group);
            return (
              <div key={group}>
                <div className="text-[9px] text-[#8896b0] uppercase font-bold mb-1.5">{GROUP_LABELS[group]}</div>
                <div className="flex flex-wrap gap-1.5">
                  {keys.map(key => {
                    const def = INDICATOR_DEFS[key];
                    const active = activeIndicators.has(key);
                    return (
                      <button key={key} onClick={() => toggleIndicator(key)}
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all"
                        style={active ? { borderColor: def.color, backgroundColor: def.color + "25", color: def.color } : { borderColor: "#2a2e39", color: "#787b86" }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: active ? def.color : "#444" }} />
                        {def.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* SMC 結構 */}
          <div className="pt-2 border-t border-[#2a3148]">
            <div className="text-[9px] uppercase font-bold mb-1.5" style={{ color: "#f59e0b" }}>SMC 結構</div>
            <div className="flex flex-wrap gap-1.5">
              {(["fvg_bull", "fvg_bear", "ob_bull", "ob_bear", "bos_choch"] as StructureKey[]).map(key => {
                const def = STRUCTURE_DEFS[key];
                const active = activeStructures.has(key);
                return (
                  <button key={key} onClick={() => toggleStructure(key)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all"
                    style={active ? { borderColor: def.color, backgroundColor: def.color + "25", color: def.color } : { borderColor: "#252b3a", color: "#6b7385" }}>
                    <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: active ? def.color : "#444" }} />
                    {def.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* 纏論結構 */}
          <div className="pt-2 border-t border-[#2a3148]">
            <div className="text-[9px] uppercase font-bold mb-1.5" style={{ color: "#c084fc" }}>纏論結構</div>
            <div className="flex flex-wrap gap-1.5">
              {(["chan_bi", "chan_zhongshu"] as StructureKey[]).map(key => {
                const def = STRUCTURE_DEFS[key];
                const active = activeStructures.has(key);
                return (
                  <button key={key} onClick={() => toggleStructure(key)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all"
                    style={active ? { borderColor: def.color, backgroundColor: def.color + "25", color: def.color } : { borderColor: "#252b3a", color: "#6b7385" }}>
                    <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: active ? def.color : "#444" }} />
                    {def.label}
                  </button>
                );
              })}
            </div>
            {structureData?.chan && (
              <div className="mt-1.5 text-[9px] space-y-0.5">
                <div className="flex gap-2">
                  <span style={{ color: "#6b7385" }}>趨勢：</span>
                  <span className="font-bold" style={{ color: structureData.chan.trend === "bullish" ? "#26d48a" : structureData.chan.trend === "bearish" ? "#f04f5e" : "#9ba3b5" }}>
                    {structureData.chan.trend === "bullish" ? "偏多" : structureData.chan.trend === "bearish" ? "偏空" : "震盪"}
                  </span>
                  <span style={{ color: "#6b7385" }}>筆數：</span>
                  <span style={{ color: "#c8cdd8" }}>{structureData.chan.bi_count}</span>
                  {structureData.chan.in_zhongshu && <span className="px-1 rounded" style={{ background: "#c084fc30", color: "#c084fc" }}>在中樞內</span>}
                </div>
                {structureData.chan.divergence && (
                  <div className="flex gap-1">
                    <span style={{ color: "#6b7385" }}>背馳：</span>
                    <span className="font-bold" style={{ color: structureData.chan.divergence === "top" ? "#f04f5e" : "#26d48a" }}>
                      {structureData.chan.divergence === "top" ? "頂背馳 ⚠️" : "底背馳 ✅"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* 策略建議 */}
          <div className="pt-2 border-t border-[#2a3148]">
            <div className="text-[9px] text-[#f59e0b] uppercase font-bold mb-1.5">V8 策略建議指標</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {DEFAULT_STRATEGY_INDICATORS.map(k => (
                <span key={k} className="text-[9px] px-1.5 py-0.5 rounded font-mono cursor-pointer"
                  style={{ backgroundColor: INDICATOR_DEFS[k].color + "30", color: INDICATOR_DEFS[k].color }}
                  onClick={() => toggleIndicator(k)}>
                  {INDICATOR_DEFS[k].label}
                </span>
              ))}
            </div>
            <button onClick={() => setActiveIndicators(new Set(DEFAULT_STRATEGY_INDICATORS))}
              className="w-full text-[9px] py-1 rounded border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10 transition-colors">
              套用 V8 建議指標
            </button>
          </div>
        </div>
      )}

      {/* ── 主圖 ── */}
      <div className="flex-1 relative">
        <div ref={chartContainerRef} className="w-full h-full" />
        {isMobile && !hoveredOhlcv && (
          <div className="absolute bottom-4 right-4 bg-[#1e222d]/60 p-2 rounded-full border border-[#2a3148] animate-pulse">
            <Fingerprint size={20} className="text-[#2962ff]" />
          </div>
        )}
      </div>

      {/* ── 子圖 ── */}
      {subChart !== "none" && (
        <div className="border-t border-[#2a3148] relative">
          <div className="absolute left-2 top-1 z-10 text-[9px] text-[#8896b0] font-bold uppercase">
            {SUB_LABELS[subChart]}
            {subChart === "rsi" && <span className="ml-1 opacity-60">· 超買 70 / 超賣 30</span>}
            {subChart === "adx" && <span className="ml-1 opacity-60">· 趨勢強度 25</span>}
            {subChart === "stoch" && <span className="ml-1 opacity-60">· 超買 80 / 超賣 20</span>}
          </div>
          <div ref={subChartContainerRef} className="w-full" style={{ height: 90 }} />
        </div>
      )}

      {/* ── 底部狀態列 ── */}
      {!isMobile && (
        <div className="bg-[#1e222d] border-t border-[#2a3148] px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={11} className="text-[#2962ff]/60" />
            <span className="text-[10px] text-[#8896b0] truncate max-w-xs">
              {Array.from(activeIndicators).map(k => INDICATOR_DEFS[k].label).join(" · ")}
            </span>
          </div>
          <div className="text-[10px] font-mono text-[#8896b0] shrink-0">
            {hoveredOhlcv?.time ? new Date(Number(hoveredOhlcv.time) * 1000).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
          </div>
        </div>
      )}
    </div>
  );
}
