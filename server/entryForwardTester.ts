import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Candle } from "@shared/schemas";
import { fetchCandles } from "./analysis";
import type { BacktestStrategy } from "./backtest";
import { LIVE_SCAN_STRATEGIES } from "./signalScanner";
import {
  getEntryStrategyReliability,
  scoreEntry,
  type EntryScoreResult,
  type EntryStrategyRecommendation,
  type EntryValidationVerdict,
} from "./entryTrainer";

const RUNTIME_DIR = path.resolve(process.cwd(), "runtime");
const STATE_PATH = path.join(RUNTIME_DIR, "entry_forward_test_state.json");
const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
const TIMEFRAMES = ["15m", "1h"] as const;
const SCAN_LIMIT = 700;
const FORWARD_TEST_INTERVAL_MS = Number(process.env.ENTRY_FORWARD_TEST_INTERVAL_MS ?? 5 * 60 * 1000);
const PAPER_MODE = true as const;

type ForwardTradeStatus = "open" | "closed";
type ForwardTradeOutcome = "tp" | "sl" | "timeout" | null;
type ForwardDirection = "long" | "short";

export interface EntryForwardTrade {
  id: string;
  symbol: string;
  timeframe: string;
  strategy: BacktestStrategy;
  direction: ForwardDirection;
  status: ForwardTradeStatus;
  outcome: ForwardTradeOutcome;
  openedAt: string;
  updatedAt: string;
  signalTime: number;
  entryTime: number;
  entry: number;
  sl: number;
  tp: number;
  rr: number | null;
  score: number;
  verdict: EntryScoreResult["verdict"];
  confidence: number;
  winRate: number;
  weightedR: number;
  marketRegime: EntryScoreResult["marketRegime"];
  validationVerdict: EntryValidationVerdict;
  oosAvgRMultiple: number;
  overfitRisk: number;
  reliabilityScore: number;
  recommendation: EntryStrategyRecommendation;
  sizeUnit: number;
  timeoutBars: number;
  closeTime: number | null;
  closePrice: number | null;
  rMultiple: number | null;
  closeReason: string | null;
  paperOnly: true;
}

export interface EntryForwardTestState {
  version: "v1-paper-forward-test";
  paperOnly: true;
  enabled: boolean;
  startedAt: string;
  lastRunAt: string | null;
  lastRunError: string | null;
  trades: EntryForwardTrade[];
}

export interface EntryForwardStatsBreakdown {
  key: string;
  total: number;
  closed: number;
  open: number;
  winRate: number;
  avgR: number;
  profitFactor: number | null;
}

export interface EntryForwardStats {
  paperOnly: true;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunError: string | null;
  total: number;
  open: number;
  closed: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  avgR: number;
  totalR: number;
  profitFactor: number | null;
  recent20AvgR: number;
  byStrategy: EntryForwardStatsBreakdown[];
  byTimeframe: EntryForwardStatsBreakdown[];
  openTrades: EntryForwardTrade[];
  recentClosedTrades: EntryForwardTrade[];
}

let timer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

function nowIso(): string {
  return new Date().toISOString();
}

function round(value: number, digits = 4): number {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function defaultState(): EntryForwardTestState {
  return {
    version: "v1-paper-forward-test",
    paperOnly: PAPER_MODE,
    enabled: true,
    startedAt: nowIso(),
    lastRunAt: null,
    lastRunError: null,
    trades: [],
  };
}

async function loadState(): Promise<EntryForwardTestState> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as EntryForwardTestState;
    if (!Array.isArray(parsed.trades)) return defaultState();
    return { ...defaultState(), ...parsed, paperOnly: PAPER_MODE };
  } catch {
    return defaultState();
  }
}

async function saveState(state: EntryForwardTestState): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function timeoutBarsFor(timeframe: string): number {
  if (timeframe === "15m") return 32;
  if (timeframe === "1h") return 48;
  return 40;
}

function openTradeKey(trade: Pick<EntryForwardTrade, "symbol" | "timeframe" | "strategy" | "direction">): string {
  return `${trade.symbol}:${trade.timeframe}:${trade.strategy}:${trade.direction}`;
}

function tradeRisk(trade: EntryForwardTrade): number {
  return Math.max(1e-9, Math.abs(trade.entry - trade.sl));
}

function rMultipleAt(trade: EntryForwardTrade, price: number): number {
  const raw = trade.direction === "long" ? price - trade.entry : trade.entry - price;
  return raw / tradeRisk(trade);
}

function closeTrade(trade: EntryForwardTrade, candle: Candle, outcome: Exclude<ForwardTradeOutcome, null>, closePrice: number, reason: string): void {
  trade.status = "closed";
  trade.outcome = outcome;
  trade.closeTime = candle.time;
  trade.closePrice = round(closePrice, 2);
  trade.rMultiple = round(rMultipleAt(trade, closePrice), 4);
  trade.closeReason = reason;
  trade.updatedAt = nowIso();
}

function closeOpenTradesForCandles(state: EntryForwardTestState, symbol: string, timeframe: string, candles: Candle[]): number {
  let closed = 0;
  for (const trade of state.trades) {
    if (trade.status !== "open" || trade.symbol !== symbol || trade.timeframe !== timeframe) continue;
    const futureCandles = candles.filter(c => c.time > trade.entryTime);
    for (const candle of futureCandles) {
      const barsHeld = futureCandles.findIndex(c => c.time === candle.time) + 1;
      const hitSl = trade.direction === "long" ? candle.low <= trade.sl : candle.high >= trade.sl;
      const hitTp = trade.direction === "long" ? candle.high >= trade.tp : candle.low <= trade.tp;
      if (hitSl && hitTp) {
        closeTrade(trade, candle, "sl", trade.sl, "同根同時觸及 TP/SL，採保守 SL 優先");
        closed++;
        break;
      }
      if (hitSl) {
        closeTrade(trade, candle, "sl", trade.sl, "觸及 paper SL");
        closed++;
        break;
      }
      if (hitTp) {
        closeTrade(trade, candle, "tp", trade.tp, "觸及 paper TP");
        closed++;
        break;
      }
      if (barsHeld >= trade.timeoutBars) {
        closeTrade(trade, candle, "timeout", candle.close, `超過 ${trade.timeoutBars} 根 K 線未觸及 TP/SL，以收盤價結案`);
        closed++;
        break;
      }
    }
  }
  return closed;
}

function canOpenTrade(score: EntryScoreResult, recommendation: EntryStrategyRecommendation, validationVerdict: EntryValidationVerdict, reliabilityScore: number, oosAvgRMultiple: number): boolean {
  if (score.direction !== "long" && score.direction !== "short") return false;
  if (score.entry === null || score.sl === null || score.tp === null) return false;
  if (score.verdict !== "進場" && score.verdict !== "小倉") return false;
  if (score.score < score.scoreThresholds.small) return false;
  if (score.validationStats.verdict === "fragile" || validationVerdict === "fragile") return false;
  if (recommendation === "保守" || recommendation === "避免") return false;
  if (reliabilityScore < 58) return false;
  if (oosAvgRMultiple < 0.08) return false;
  if (score.confidence < 35) return false;
  return true;
}

function buildTrade(score: EntryScoreResult, recommendation: EntryStrategyRecommendation, reliabilityScore: number, oosAvgRMultiple: number, overfitRisk: number, signalTime: number, entryTime: number): EntryForwardTrade {
  if (score.direction !== "long" && score.direction !== "short" || score.entry === null || score.sl === null || score.tp === null) {
    throw new Error("invalid score for paper forward trade");
  }
  const openedAt = nowIso();
  return {
    id: `${score.symbol}-${score.timeframe}-${score.strategy}-${score.direction}-${entryTime}`,
    symbol: score.symbol,
    timeframe: score.timeframe,
    strategy: score.strategy,
    direction: score.direction,
    status: "open",
    outcome: null,
    openedAt,
    updatedAt: openedAt,
    signalTime,
    entryTime,
    entry: score.entry,
    sl: score.sl,
    tp: score.tp,
    rr: score.rr,
    score: score.score,
    verdict: score.verdict,
    confidence: score.confidence,
    winRate: score.winRate,
    weightedR: score.weightedR,
    marketRegime: score.marketRegime,
    validationVerdict: score.validationStats.verdict,
    oosAvgRMultiple: score.validationStats.oosAvgRMultiple,
    overfitRisk,
    reliabilityScore,
    recommendation,
    sizeUnit: score.verdict === "進場" ? 1 : 0.5,
    timeoutBars: timeoutBarsFor(score.timeframe),
    closeTime: null,
    closePrice: null,
    rMultiple: null,
    closeReason: null,
    paperOnly: PAPER_MODE,
  };
}

async function scanSymbolTimeframe(state: EntryForwardTestState, symbol: string, timeframe: string, strategies: BacktestStrategy[]): Promise<{ opened: number; closed: number }> {
  const candles = await fetchCandles(symbol, timeframe, SCAN_LIMIT);
  if (!candles || candles.length < 220) return { opened: 0, closed: 0 };

  const closed = closeOpenTradesForCandles(state, symbol, timeframe, candles);
  const reliability = getEntryStrategyReliability(symbol, timeframe, candles, strategies);
  const reliabilityByStrategy = new Map(reliability.leaderboard.map(row => [row.strategy, row]));
  const openKeys = new Set(state.trades.filter(t => t.status === "open").map(openTradeKey));
  const lastClosedCandle = candles[candles.length - 2];
  const entryCandle = candles[candles.length - 1];
  if (!lastClosedCandle || !entryCandle) return { opened: 0, closed };

  let opened = 0;
  for (const strategy of strategies) {
    const row = reliabilityByStrategy.get(strategy);
    if (!row) continue;
    const score = await scoreEntry({ symbol, timeframe, strategy }, candles);
    if (!canOpenTrade(score, row.recommendation, row.validation.verdict, row.reliabilityScore, row.validation.oosAvgRMultiple)) continue;
    if (score.direction !== "long" && score.direction !== "short") continue;
    const key = `${symbol}:${timeframe}:${strategy}:${score.direction}`;
    if (openKeys.has(key)) continue;
    const duplicateId = `${symbol}-${timeframe}-${strategy}-${score.direction}-${entryCandle.time}`;
    if (state.trades.some(t => t.id === duplicateId)) continue;
    const trade = buildTrade(score, row.recommendation, row.reliabilityScore, row.validation.oosAvgRMultiple, row.validation.overfitRisk, lastClosedCandle.time, entryCandle.time);
    state.trades.push(trade);
    openKeys.add(openTradeKey(trade));
    opened++;
  }
  return { opened, closed };
}

export async function runEntryForwardTestOnce(): Promise<{ opened: number; closed: number; stats: EntryForwardStats }> {
  if (isRunning) return { opened: 0, closed: 0, stats: await getEntryForwardStats() };
  isRunning = true;
  const state = await loadState();
  let opened = 0;
  let closed = 0;
  try {
    const strategies = LIVE_SCAN_STRATEGIES.length > 0 ? LIVE_SCAN_STRATEGIES : (["pa", "rsi_reversal", "v8_hybrid"] as BacktestStrategy[]);
    for (const symbol of SYMBOLS) {
      for (const timeframe of TIMEFRAMES) {
        const result = await scanSymbolTimeframe(state, symbol, timeframe, strategies);
        opened += result.opened;
        closed += result.closed;
      }
    }
    state.lastRunAt = nowIso();
    state.lastRunError = null;
    await saveState(state);
    return { opened, closed, stats: computeStats(state) };
  } catch (err) {
    state.lastRunAt = nowIso();
    state.lastRunError = err instanceof Error ? err.message : String(err);
    await saveState(state);
    throw err;
  } finally {
    isRunning = false;
  }
}

function computeBreakdown(trades: EntryForwardTrade[], getKey: (trade: EntryForwardTrade) => string): EntryForwardStatsBreakdown[] {
  const map = new Map<string, EntryForwardTrade[]>();
  for (const trade of trades) {
    const key = getKey(trade);
    const rows = map.get(key) ?? [];
    rows.push(trade);
    map.set(key, rows);
  }
  return Array.from(map.entries()).map(([key, rows]) => {
    const closed = rows.filter(t => t.status === "closed");
    const wins = closed.filter(t => (t.rMultiple ?? 0) > 0);
    const gains = closed.filter(t => (t.rMultiple ?? 0) > 0).reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
    const losses = Math.abs(closed.filter(t => (t.rMultiple ?? 0) < 0).reduce((sum, t) => sum + (t.rMultiple ?? 0), 0));
    return {
      key,
      total: rows.length,
      closed: closed.length,
      open: rows.length - closed.length,
      winRate: closed.length > 0 ? round(wins.length / closed.length, 4) : 0,
      avgR: closed.length > 0 ? round(closed.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / closed.length, 4) : 0,
      profitFactor: losses > 0 ? round(gains / losses, 4) : gains > 0 ? null : 0,
    };
  }).sort((a, b) => b.closed - a.closed || b.avgR - a.avgR);
}

function computeStats(state: EntryForwardTestState): EntryForwardStats {
  const closed = state.trades.filter(t => t.status === "closed");
  const open = state.trades.filter(t => t.status === "open");
  const wins = closed.filter(t => (t.rMultiple ?? 0) > 0);
  const losses = closed.filter(t => (t.rMultiple ?? 0) < 0);
  const timeouts = closed.filter(t => t.outcome === "timeout");
  const totalR = closed.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
  const gains = wins.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
  const lossAbs = Math.abs(losses.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0));
  const recent20 = closed.slice(-20);
  return {
    paperOnly: PAPER_MODE,
    enabled: state.enabled,
    lastRunAt: state.lastRunAt,
    lastRunError: state.lastRunError,
    total: state.trades.length,
    open: open.length,
    closed: closed.length,
    wins: wins.length,
    losses: losses.length,
    timeouts: timeouts.length,
    winRate: closed.length > 0 ? round(wins.length / closed.length, 4) : 0,
    avgR: closed.length > 0 ? round(totalR / closed.length, 4) : 0,
    totalR: round(totalR, 4),
    profitFactor: lossAbs > 0 ? round(gains / lossAbs, 4) : gains > 0 ? null : 0,
    recent20AvgR: recent20.length > 0 ? round(recent20.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / recent20.length, 4) : 0,
    byStrategy: computeBreakdown(state.trades, t => t.strategy),
    byTimeframe: computeBreakdown(state.trades, t => t.timeframe),
    openTrades: open.slice(-20).reverse(),
    recentClosedTrades: closed.slice(-30).reverse(),
  };
}

export async function getEntryForwardStats(): Promise<EntryForwardStats> {
  const state = await loadState();
  return computeStats(state);
}

export function startEntryForwardTester(): void {
  if (timer) return;
  console.log(`[EntryForwardTester] 啟動 paper forward test，間隔 ${Math.round(FORWARD_TEST_INTERVAL_MS / 1000)} 秒，paperOnly=true`);
  setTimeout(() => {
    runEntryForwardTestOnce().catch(err => console.error("[EntryForwardTester] 首次執行失敗:", err));
  }, 30_000);
  timer = setInterval(() => {
    runEntryForwardTestOnce().catch(err => console.error("[EntryForwardTester] 排程執行失敗:", err));
  }, FORWARD_TEST_INTERVAL_MS);
}

export function stopEntryForwardTester(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  console.log("[EntryForwardTester] 已停止");
}
