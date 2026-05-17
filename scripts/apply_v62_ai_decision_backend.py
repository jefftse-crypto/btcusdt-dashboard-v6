from pathlib import Path

path = Path('/home/ubuntu/btcusdt_dashboard_v6/server/routers.ts')
text = path.read_text()

helper = r'''
// ─────────────────────────────────────────────────────────────────────────────
// v6.2 AI 綜合判讀 / 交易決策引擎（輕量版）
// 目的：整合 LSTM、技術指標、策略中心、SMC/PA 結構，產生可讀解盤與交易決策。
// 注意：此模組為輔助分析，不構成投資建議。
// ─────────────────────────────────────────────────────────────────────────────
type AiTradeAction = "long" | "short" | "wait";
type AiRiskLevel = "low" | "medium" | "high";

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function pct(n: number | undefined | null, digits = 1): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "--";
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtPrice(n: number | undefined | null): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "--";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function buildAiSynthesis(symbol: string, timeframe: string, snapshot: any, prediction: any) {
  const indicators = snapshot?.indicators ?? {};
  const strategy = snapshot?.strategy ?? {};
  const consensus = snapshot?.consensus ?? {};
  const smc = snapshot?.smc ?? {};
  const pa = snapshot?.pa ?? {};
  const forecast = snapshot?.forecast_4h ?? {};
  const currentPrice = Number(indicators?.close ?? strategy?.entry ?? prediction?.predictedClose ?? 0);

  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const conflicts: string[] = [];

  const lstmDirection = prediction?.direction ?? "neutral";
  const lstmConfidence = Number(prediction?.confidence ?? 0);
  if (lstmDirection === "bullish") {
    const add = 18 + Math.min(17, lstmConfidence * 0.22);
    score += add;
    reasons.push(`LSTM 預測偏多，信心 ${lstmConfidence || "--"}%（bull=${pct(prediction?.bullProb, 0)}）。`);
  } else if (lstmDirection === "bearish") {
    const sub = 18 + Math.min(17, lstmConfidence * 0.22);
    score -= sub;
    reasons.push(`LSTM 預測偏空，信心 ${lstmConfidence || "--"}%（bear=${pct(prediction?.bearProb, 0)}）。`);
  } else {
    reasons.push(`LSTM 預測偏震盪，neutral=${pct(prediction?.neutralProb, 0)}，方向優勢尚不明顯。`);
  }

  const consensusScore = Number(consensus?.score ?? 50);
  score += clampNumber((consensusScore - 50) * 0.55, -22, 22);
  if (consensusScore >= 65) reasons.push(`市場共識分數 ${Math.round(consensusScore)}，整體偏多。`);
  else if (consensusScore <= 35) reasons.push(`市場共識分數 ${Math.round(consensusScore)}，整體偏空。`);
  else reasons.push(`市場共識分數 ${Math.round(consensusScore)}，屬中性區間。`);

  const trend = indicators?.trend;
  const momentum = indicators?.momentum;
  if (trend === "bullish") { score += 10; reasons.push("技術趨勢為 bullish，價格結構偏向多方。"); }
  if (trend === "bearish") { score -= 10; reasons.push("技術趨勢為 bearish，價格結構偏向空方。"); }
  if (momentum === "strong_bullish") score += 8;
  else if (momentum === "bullish") score += 4;
  else if (momentum === "strong_bearish") score -= 8;
  else if (momentum === "bearish") score -= 4;

  const rsi = Number(indicators?.rsi ?? NaN);
  if (Number.isFinite(rsi)) {
    if (rsi >= 72) { score -= 6; warnings.push(`RSI ${rsi.toFixed(1)} 已偏過熱，追多需降低槓桿或等待回踩。`); }
    else if (rsi <= 28) { score += 6; warnings.push(`RSI ${rsi.toFixed(1)} 已偏超賣，追空需注意反彈。`); }
    else reasons.push(`RSI ${rsi.toFixed(1)} 未進入極端區。`);
  }

  const macdHist = Number(indicators?.macd?.histogram ?? NaN);
  if (Number.isFinite(macdHist)) {
    if (macdHist > 0) score += 5;
    if (macdHist < 0) score -= 5;
  }

  const ema20 = Number(indicators?.ema?.ema20 ?? NaN);
  const ema50 = Number(indicators?.ema?.ema50 ?? NaN);
  const ema200 = Number(indicators?.ema?.ema200 ?? NaN);
  if (Number.isFinite(currentPrice) && Number.isFinite(ema20) && Number.isFinite(ema50)) {
    if (currentPrice > ema20 && ema20 > ema50) { score += 8; reasons.push("價格位於 EMA20/EMA50 上方，短中期均線排列偏多。"); }
    else if (currentPrice < ema20 && ema20 < ema50) { score -= 8; reasons.push("價格位於 EMA20/EMA50 下方，短中期均線排列偏空。"); }
  }
  if (Number.isFinite(currentPrice) && Number.isFinite(ema200)) {
    if (currentPrice > ema200) score += 4;
    else score -= 4;
  }

  const strategyDir = strategy?.direction;
  if (strategyDir === "long") { score += 16; reasons.push(`策略中心建議偏多，RR 約 ${strategy?.rr_ratio?.toFixed?.(2) ?? "--"}。`); }
  else if (strategyDir === "short") { score -= 16; reasons.push(`策略中心建議偏空，RR 約 ${strategy?.rr_ratio?.toFixed?.(2) ?? "--"}。`); }
  else { reasons.push("策略中心目前偏觀望，尚未形成明確進場條件。"); }

  const smcStructure = smc?.structure;
  if (smcStructure === "bullish") { score += 8; reasons.push("SMC 結構偏多，需觀察是否回踩需求區或 FVG。 "); }
  else if (smcStructure === "bearish") { score -= 8; reasons.push("SMC 結構偏空，需觀察是否反彈至供給區或 OB。 "); }
  else if (smcStructure) reasons.push("SMC 結構偏震盪，較適合等待突破或流動性掃蕩後確認。");

  const paConsensus = pa?.consensus;
  if (paConsensus === "strong_bullish" || paConsensus === "bullish") score += paConsensus === "strong_bullish" ? 8 : 4;
  if (paConsensus === "strong_bearish" || paConsensus === "bearish") score -= paConsensus === "strong_bearish" ? 8 : 4;

  const rawScore = clampNumber(score, -100, 100);
  const absScore = Math.abs(rawScore);
  let action: AiTradeAction = "wait";
  if (rawScore >= 28 && lstmConfidence >= 50) action = "long";
  else if (rawScore <= -28 && lstmConfidence >= 50) action = "short";

  const alignmentLong = [lstmDirection === "bullish", strategyDir === "long", consensusScore >= 60, trend === "bullish"].filter(Boolean).length;
  const alignmentShort = [lstmDirection === "bearish", strategyDir === "short", consensusScore <= 40, trend === "bearish"].filter(Boolean).length;
  if (alignmentLong > 0 && alignmentShort > 0) conflicts.push("LSTM、策略中心或共識分數之間存在多空混合訊號，建議降低倉位或等待確認。 ");
  if (action === "long" && alignmentLong < 3) warnings.push("做多條件未達高度共振，建議等待回踩或突破確認。 ");
  if (action === "short" && alignmentShort < 3) warnings.push("做空條件未達高度共振，建議等待反彈受阻或跌破確認。 ");
  if (action === "wait") warnings.push("目前優勢不足，不宜為了進場而進場；可等待 LSTM、共識與策略中心同向。 ");

  const confidence = Math.round(clampNumber(absScore * 0.62 + Math.max(0, lstmConfidence) * 0.28 + Math.max(alignmentLong, alignmentShort) * 5, 20, 95));
  const atr = Number(indicators?.atr ?? 0);
  const entry = Number(strategy?.entry ?? currentPrice);
  const sl = Number(strategy?.sl ?? (action === "long" ? entry - atr * 1.2 : action === "short" ? entry + atr * 1.2 : NaN));
  const tp1 = Number(strategy?.tp1 ?? (action === "long" ? entry + atr * 1.8 : action === "short" ? entry - atr * 1.8 : NaN));
  const tp2 = Number(strategy?.tp2 ?? (action === "long" ? entry + atr * 2.8 : action === "short" ? entry - atr * 2.8 : NaN));
  const rr = Number(strategy?.rr_ratio ?? (Number.isFinite(entry) && Number.isFinite(sl) && Number.isFinite(tp1) && Math.abs(entry - sl) > 0 ? Math.abs(tp1 - entry) / Math.abs(entry - sl) : 0));
  const riskLevel: AiRiskLevel = confidence >= 70 && rr >= 1.5 ? "low" : confidence >= 50 && rr >= 1.0 ? "medium" : "high";

  const decisionText = action === "long"
    ? "偏多，但只適合在回踩支撐、突破確認或策略中心條件成立時分批執行。"
    : action === "short"
      ? "偏空，但只適合在反彈受阻、跌破關鍵支撐或策略中心條件成立時分批執行。"
      : "觀望為主，等待多空訊號更一致後再進場。";

  const playbook = action === "wait"
    ? ["等待價格接近支撐/阻力或流動性區域後再確認。", "若 LSTM 信心低於 55% 或共識分數介於 45–55，避免追單。", "優先觀察下一根 K 線是否放量突破或跌破。"]
    : [
        `參考進場：${fmtPrice(entry)}，不建議離該價格過遠追價。`,
        `風控位置：SL ${fmtPrice(sl)}；第一目標 TP1 ${fmtPrice(tp1)}；延伸目標 TP2 ${fmtPrice(tp2)}。`,
        "若進場後 1–2 根 K 線無法延續，應降低部位或移動止損。",
      ];

  return {
    symbol,
    timeframe,
    generatedAt: Date.now(),
    action,
    actionLabel: action === "long" ? "做多 / 偏多" : action === "short" ? "做空 / 偏空" : "觀望 / 等待",
    confidence,
    score: Math.round(rawScore),
    riskLevel,
    summary: `${symbol} ${timeframe.toUpperCase()} 綜合判讀：${decisionText}`,
    marketRegime: {
      trend: trend ?? "unknown",
      momentum: momentum ?? "unknown",
      consensusScore: Math.round(consensusScore),
      smcStructure: smcStructure ?? "unknown",
      paConsensus: paConsensus ?? "unknown",
      forecast: forecast?.main_scenario ?? null,
    },
    lstm: prediction ? {
      direction: lstmDirection,
      confidence: lstmConfidence,
      bullProb: prediction?.bullProb,
      bearProb: prediction?.bearProb,
      neutralProb: prediction?.neutralProb,
      accuracy: prediction?.accuracy,
    } : null,
    tradePlan: {
      entry: Number.isFinite(entry) ? entry : null,
      sl: Number.isFinite(sl) ? sl : null,
      tp1: Number.isFinite(tp1) ? tp1 : null,
      tp2: Number.isFinite(tp2) ? tp2 : null,
      rrRatio: Number.isFinite(rr) ? Number(rr.toFixed(2)) : null,
      invalidation: action === "long" ? "跌破 SL 或多方結構失效" : action === "short" ? "突破 SL 或空方結構失效" : "等待突破/跌破後重新評估",
    },
    reasons: reasons.slice(0, 7),
    conflicts,
    warnings: [...warnings, "此為量化與 AI 輔助判讀，不等於保證獲利；實際交易需自行控管槓桿、倉位與滑價。"].slice(0, 6),
    playbook,
    sources: ["LSTM", "技術指標", "共識分數", "策略中心", "SMC/PA 結構"],
  };
}
'''

if 'function buildAiSynthesis(' not in text:
    text = text.replace('\nexport const appRouter = router({', helper + '\nexport const appRouter = router({')

old = '''    status: publicProcedure
      .input(z.object({
        symbol:    z.string().default("BTCUSDT"),
        timeframe: z.enum(["1h", "4h", "15m", "5m"]).default("1h"),
      }))
      .query(({ input }) => {
        const symbol = normalizeSymbol(input.symbol);
        return getModelStatus(symbol, input.timeframe);
      }),
  }),'''
new = '''    status: publicProcedure
      .input(z.object({
        symbol:    z.string().default("BTCUSDT"),
        timeframe: z.enum(["1h", "4h", "15m", "5m"]).default("1h"),
      }))
      .query(({ input }) => {
        const symbol = normalizeSymbol(input.symbol);
        return getModelStatus(symbol, input.timeframe);
      }),

    decision: publicProcedure
      .input(z.object({
        symbol:    z.string().default("BTCUSDT"),
        timeframe: z.enum(["1h", "4h", "15m", "5m"]).default("1h"),
        limit:     z.number().int().min(200).max(2000).default(800),
      }))
      .query(async ({ input }) => {
        const symbol = normalizeSymbol(input.symbol);
        const barMap: Record<string, string> = { "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H" };
        const bar = barMap[input.timeframe] ?? "1H";
        const [snapshot, candles] = await Promise.all([
          runAnalysis(symbol, input.timeframe),
          fetchCandles(symbol, bar, input.limit),
        ]);
        let prediction: any = null;
        try {
          if (candles.length >= 200) prediction = await predictLstm(symbol, input.timeframe, candles);
        } catch (e) {
          console.warn("[AI Decision] LSTM prediction unavailable", e);
        }
        return buildAiSynthesis(symbol, input.timeframe, snapshot, prediction);
      }),
  }),'''
if old in text and 'decision: publicProcedure' not in text:
    text = text.replace(old, new)
elif 'decision: publicProcedure' not in text:
    raise SystemExit('找不到 ai.status 區塊，未能插入 decision API')

path.write_text(text)
print('backend ai decision upgrade applied')
