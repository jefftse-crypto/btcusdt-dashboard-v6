/**
 * Nurse Neil Signal Scorer v1.0
 *
 * Purpose:
 * Convert discretionary Nurse Neil Telegram-style trade calls into a repeatable
 * 0-100 quantitative score that can be used as an external signal source,
 * a position sizing filter, or a paper-trading acceptance layer in the V6 system.
 *
 * Scope:
 * - Long-side spot/perp calls with CMP entry, close-based stop, and one or more TPs.
 * - Designed for signal triage and paper trading, not for blind live execution.
 */

export type NurseNeilDirection = 'long' | 'short';
export type NurseNeilLiquidityTier = 'major' | 'mid' | 'small' | 'illiquid';
export type NurseNeilStopType = 'structure_failure' | 'prior_low_or_support' | 'short_term_low' | 'percentage_only' | 'unclear';
export type NurseNeilTimeframe = '1H' | '2H' | '4H' | '1D' | string;
export type NurseNeilDecision = 'normal_size' | 'half_size' | 'quarter_size' | 'observe_only' | 'reject';
export type NurseNeilGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export interface NurseNeilSignalInput {
  symbol: string;
  direction: NurseNeilDirection;
  timeframe: NurseNeilTimeframe;
  entry: number;
  stopLoss: number;
  takeProfits: number[];
  tpWeights?: number[];

  // Structure checklist, max 25 points.
  trendlineBreak?: boolean;
  srFlip?: boolean;
  aboveKeyMa?: boolean;
  marketStructureShift?: boolean;
  notCatchingKnife?: boolean;

  // Manual/contextual execution inputs.
  stopType?: NurseNeilStopType;
  liquidityTier?: NurseNeilLiquidityTier;
  signalMovePct?: number; // percentage move away from CMP after the call; positive = already moved in trade direction.
  btc4hRisk?: 'supportive' | 'neutral' | 'bearish_breakdown';
  concurrentAltLongs?: number;
  hasClearTp?: boolean;
  hasClearSl?: boolean;
  note?: string;
}

export interface NurseNeilSignalScore {
  symbol: string;
  totalScore: number;
  grade: NurseNeilGrade;
  decision: NurseNeilDecision;
  suggestedAccountRiskPct: number;
  weightedRR: number;
  stopDistancePct: number;
  components: {
    structure: number;
    rr: number;
    stop: number;
    liquidity: number;
    slippage: number;
    volatility: number;
  };
  hardRejects: string[];
  warnings: string[];
  reasoning: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeWeights(takeProfits: number[], weights?: number[]): number[] {
  if (takeProfits.length === 0) return [];
  const fallback = [0.3, 0.3, 0.25, 0.15];
  const raw = weights && weights.length === takeProfits.length ? weights : takeProfits.map((_, i) => fallback[i] ?? 0);
  const positive = raw.map((w) => Math.max(0, w));
  const sum = positive.reduce((s, w) => s + w, 0);
  if (sum <= 0) return takeProfits.map(() => 1 / takeProfits.length);
  return positive.map((w) => w / sum);
}

export function calculateNurseNeilWeightedRR(input: NurseNeilSignalInput): number {
  if (!Number.isFinite(input.entry) || !Number.isFinite(input.stopLoss) || input.entry <= 0) return 0;
  const risk = input.direction === 'long' ? input.entry - input.stopLoss : input.stopLoss - input.entry;
  if (risk <= 0 || input.takeProfits.length === 0) return 0;
  const weights = normalizeWeights(input.takeProfits, input.tpWeights);
  return input.takeProfits.reduce((sum, tp, index) => {
    const reward = input.direction === 'long' ? tp - input.entry : input.entry - tp;
    const rr = reward > 0 ? reward / risk : 0;
    return sum + rr * weights[index];
  }, 0);
}

export function scoreNurseNeilStructure(input: NurseNeilSignalInput): number {
  let score = 0;
  if (input.trendlineBreak) score += 8;
  if (input.srFlip) score += 7;
  if (input.aboveKeyMa) score += 4;
  if (input.marketStructureShift) score += 4;
  if (input.notCatchingKnife) score += 2;
  return clamp(score, 0, 25);
}

export function scoreNurseNeilRR(weightedRR: number): number {
  if (weightedRR < 1.0) return 0;
  if (weightedRR < 1.5) return 8;
  if (weightedRR < 2.0) return 12;
  if (weightedRR < 3.0) return 17;
  if (weightedRR < 5.0) return 22;
  return 25;
}

export function scoreNurseNeilStop(stopType: NurseNeilStopType = 'unclear'): number {
  switch (stopType) {
    case 'structure_failure': return 15;
    case 'prior_low_or_support': return 12;
    case 'short_term_low': return 8;
    case 'percentage_only': return 4;
    default: return 0;
  }
}

export function scoreNurseNeilLiquidity(liquidityTier: NurseNeilLiquidityTier = 'small'): number {
  switch (liquidityTier) {
    case 'major': return 10;
    case 'mid': return 7;
    case 'small': return 5;
    case 'illiquid': return 2;
  }
}

export function scoreNurseNeilSlippage(input: NurseNeilSignalInput): number {
  const move = Math.max(0, input.signalMovePct ?? 0);
  let base = 6;
  if (input.liquidityTier === 'major') base = 10;
  else if (input.liquidityTier === 'mid') base = 8;
  else if (input.liquidityTier === 'small') base = 6;
  else if (input.liquidityTier === 'illiquid') base = 3;

  if (move > 5) base -= 6;
  else if (move > 3) base -= 4;
  else if (move > 2) base -= 2;

  if (String(input.timeframe).toUpperCase() === '1H') base -= 2;
  return clamp(base, 0, 10);
}

export function scoreNurseNeilVolatility(input: NurseNeilSignalInput): number {
  let score = 8;
  if (input.liquidityTier === 'major' && String(input.timeframe).toUpperCase() !== '1H') score = 14;
  else if (input.liquidityTier === 'mid' && String(input.timeframe).toUpperCase() !== '1H') score = 11;
  else if (input.liquidityTier === 'small') score = 7;
  else if (input.liquidityTier === 'illiquid') score = 3;

  if (String(input.timeframe).toUpperCase() === '1H') score -= 4;
  if (input.btc4hRisk === 'bearish_breakdown') score -= 5;
  if ((input.concurrentAltLongs ?? 0) >= 4) score -= 2;
  return clamp(score, 0, 15);
}

export function classifyNurseNeilGrade(totalScore: number): NurseNeilGrade {
  if (totalScore >= 90) return 'A+';
  if (totalScore >= 80) return 'A';
  if (totalScore >= 70) return 'B';
  if (totalScore >= 60) return 'C';
  return 'D';
}

export function decideNurseNeilPosition(totalScore: number, hardRejects: string[]): { decision: NurseNeilDecision; suggestedAccountRiskPct: number } {
  if (hardRejects.length > 0 || totalScore < 60) return { decision: 'reject', suggestedAccountRiskPct: 0 };
  if (totalScore >= 90) return { decision: 'normal_size', suggestedAccountRiskPct: 1.0 };
  if (totalScore >= 80) return { decision: 'half_size', suggestedAccountRiskPct: 0.75 };
  if (totalScore >= 70) return { decision: 'half_size', suggestedAccountRiskPct: 0.5 };
  return { decision: 'quarter_size', suggestedAccountRiskPct: 0.25 };
}

export function calculateNurseNeilPositionNotional(accountEquity: number, accountRiskPct: number, stopDistancePct: number): number {
  if (accountEquity <= 0 || accountRiskPct <= 0 || stopDistancePct <= 0) return 0;
  return accountEquity * (accountRiskPct / 100) / (stopDistancePct / 100);
}

export function scoreNurseNeilSignal(input: NurseNeilSignalInput): NurseNeilSignalScore {
  const weightedRR = calculateNurseNeilWeightedRR(input);
  const riskAbs = input.direction === 'long' ? input.entry - input.stopLoss : input.stopLoss - input.entry;
  const stopDistancePct = input.entry > 0 ? (riskAbs / input.entry) * 100 : 0;

  const components = {
    structure: scoreNurseNeilStructure(input),
    rr: scoreNurseNeilRR(weightedRR),
    stop: scoreNurseNeilStop(input.stopType),
    liquidity: scoreNurseNeilLiquidity(input.liquidityTier),
    slippage: scoreNurseNeilSlippage(input),
    volatility: scoreNurseNeilVolatility(input),
  };

  const hardRejects: string[] = [];
  const warnings: string[] = [];

  if (input.hasClearSl === false || !Number.isFinite(input.stopLoss) || riskAbs <= 0) hardRejects.push('沒有有效或方向正確的止損');
  if (input.hasClearTp === false || input.takeProfits.length === 0) hardRejects.push('沒有明確止盈');
  if (weightedRR < 2) warnings.push(`加權 R:R ${weightedRR.toFixed(2)} 低於 2.0，安全邊際不足`);
  if ((input.signalMovePct ?? 0) > 5) hardRejects.push('訊號後已升/跌超過 5%，追價滑點風險過高');
  else if ((input.signalMovePct ?? 0) > 3) warnings.push('訊號後已移動超過 3%，需等回踩或放棄');
  if (stopDistancePct > 6) hardRejects.push(`止損距離 ${stopDistancePct.toFixed(2)}% 超過 6%`);
  if (String(input.timeframe).toUpperCase() === '1H') warnings.push('1H scalp 訊號容易被滑點與插針影響，需降倉');
  if (input.btc4hRisk === 'bearish_breakdown') hardRejects.push('BTC 4H 明顯破位向下，不跟山寨多單');
  if ((input.concurrentAltLongs ?? 0) >= 5) hardRejects.push('同時山寨多單過多，組合相關性風險超標');

  const rawTotal = Object.values(components).reduce((s, v) => s + v, 0);
  const totalScore = hardRejects.length > 0 ? Math.min(rawTotal, 59) : clamp(rawTotal, 0, 100);
  const grade = classifyNurseNeilGrade(totalScore);
  const { decision, suggestedAccountRiskPct } = decideNurseNeilPosition(totalScore, hardRejects);

  const reasoning = [
    `結構 ${components.structure}/25`,
    `R:R ${components.rr}/25（weighted ${weightedRR.toFixed(2)}）`,
    `止損 ${components.stop}/15（距離 ${stopDistancePct.toFixed(2)}%）`,
    `流動性 ${components.liquidity}/10`,
    `滑點 ${components.slippage}/10`,
    `波動/大盤 ${components.volatility}/15`,
    hardRejects.length ? `強制不跟：${hardRejects.join('；')}` : '無強制不跟條件',
  ].join(' | ');

  return {
    symbol: input.symbol,
    totalScore,
    grade,
    decision,
    suggestedAccountRiskPct,
    weightedRR,
    stopDistancePct,
    components,
    hardRejects,
    warnings,
    reasoning,
  };
}
