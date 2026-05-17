import { Candle, StrategySignal } from "@shared/cryptoTypes";

/**
 * Manus-Scalper v6.0 (Institutional Grade)
 * 核心：時段過濾 + BTC 相關性 + 流動性獵取
 */

export function runManusScalper(
  candles5m: Candle[],
  candles1h: Candle[],
  candles4h: Candle[],
  btc1hCandles: Candle[], // 傳入 BTC 的 1H 數據
  symbol: string,
  currentTime: number // 傳入當前時間戳
): StrategySignal | null {
  if (candles5m.length < 50 || candles1h.length < 50 || btc1hCandles.length < 50) return null;

  const currentPrice = candles5m[candles5m.length - 1].close;
  const last5m = candles5m[candles5m.length - 1];

  // 1. 交易時段過濾 (只在 12:00 - 18:00 UTC 交易)
  const date = new Date(currentTime);
  const hour = date.getUTCHours();
  const isGoldenSession = hour >= 12 && hour <= 18;
  if (!isGoldenSession) return null;

  // 2. BTC 相關性過濾
  const btcPrice = btc1hCandles[btc1hCandles.length - 1].close;
  const btcEma200 = calcEMA(btc1hCandles.map(c => c.close), 200);
  const btcTrend = btcPrice > btcEma200 ? "long" : "short";

  // 3. 多週期趨勢共振 (4H + 1H)
  const ema200_4h = calcEMA(candles4h.map(c => c.close), 200);
  const ema200_1h = calcEMA(candles1h.map(c => c.close), 200);
  const isBullTrend = currentPrice > ema200_4h && currentPrice > ema200_1h && btcTrend === "long";
  const isBearTrend = currentPrice < ema200_4h && currentPrice < ema200_1h && btcTrend === "short";

  if (!isBullTrend && !isBearTrend) return null;

  // 4. 流動性獵取確認 (Liquidity Sweep)
  const prevHourHigh = Math.max(...candles1h.slice(-2, -1).map(c => c.high));
  const prevHourLow = Math.min(...candles1h.slice(-2, -1).map(c => c.low));
  
  const hasSweptLow = Math.min(...candles5m.slice(-12).map(c => c.low)) < prevHourLow;
  const hasSweptHigh = Math.max(...candles5m.slice(-12).map(c => c.high)) > prevHourHigh;

  // 5. 成交量爆發
  const avgVol = candles5m.slice(-20).reduce((a, b) => a + b.volume, 0) / 20;
  const isVolSpike = last5m.volume > avgVol * 3.0;

  // 策略決策
  if (isBullTrend && hasSweptLow && isVolSpike) {
    return {
      key: "manus_scalper_v6",
      symbol,
      direction: "long",
      price: currentPrice,
      tp: currentPrice * 1.011, // 1.1% TP
      sl: currentPrice * 0.995, // 0.5% SL
      reason: "v6.0 Institutional: 黃金時段 + BTC 共振 + 流動性獵取",
      score: 99
    };
  }

  if (isBearTrend && hasSweptHigh && isVolSpike) {
    return {
      key: "manus_scalper_v6",
      symbol,
      direction: "short",
      price: currentPrice,
      tp: currentPrice * 0.989, // 1.1% TP
      sl: currentPrice * 1.005, // 0.5% SL
      reason: "v6.0 Institutional: 黃金時段 + BTC 共振 + 流動性獵取",
      score: 99
    };
  }

  return null;
}

function calcEMA(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}
