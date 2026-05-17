import { Candle, StrategySignal } from "@shared/cryptoTypes";

/**
 * Manus-Scalper v5.1 (Multi-Asset ATR Adaptive)
 * 核心：ATR 自適應止損，適合全天候多幣種掃描
 */

export function runManusScalper(
  candles5m: Candle[],
  candles15m: Candle[],
  candles1h: Candle[],
  candles4h: Candle[],
  symbol: string
): StrategySignal | null {
  if (candles5m.length < 50 || candles1h.length < 50 || candles4h.length < 50) return null;

  const currentPrice = candles5m[candles5m.length - 1].close;
  const last5m = candles5m[candles5m.length - 1];

  // 1. 多週期趨勢共振
  const ema200_4h = calcEMA(candles4h.map(c => c.close), 200);
  const ema200_1h = calcEMA(candles1h.map(c => c.close), 200);
  const isBullTrend = currentPrice > ema200_4h && currentPrice > ema200_1h;
  const isBearTrend = currentPrice < ema200_4h && currentPrice < ema200_1h;

  if (!isBullTrend && !isBearTrend) return null;

  // 2. ATR 自適應波動率計算
  const atr = calcATR(candles5m.slice(-14));
  
  // 3. 成交量爆發過濾
  const avgVol = candles5m.slice(-20).reduce((a, b) => a + b.volume, 0) / 20;
  const isVolSpike = last5m.volume > avgVol * 3.0;

  if (!isVolSpike) return null;

  // 4. 結構突破
  const recentHigh5m = Math.max(...candles5m.slice(-10, -1).map(c => c.high));
  const recentLow5m = Math.min(...candles5m.slice(-10, -1).map(c => c.low));

  // 5. 動態 TP/SL 設定 (基於 ATR)
  const slDistance = Math.max(currentPrice * 0.005, atr * 1.5); 
  const tpDistance = slDistance * 2.2; 

  if (isBullTrend && last5m.close > recentHigh5m) {
    return {
      key: "manus_scalper_v5_1",
      symbol,
      direction: "long",
      price: currentPrice,
      tp: currentPrice + tpDistance,
      sl: currentPrice - slDistance,
      reason: `v5.1 ATR Adaptive: ${symbol} 趨勢共振 + 波動率自適應`,
      score: 95
    };
  }

  if (isBearTrend && last5m.close < recentLow5m) {
    return {
      key: "manus_scalper_v5_1",
      symbol,
      direction: "short",
      price: currentPrice,
      tp: currentPrice - tpDistance,
      sl: currentPrice + slDistance,
      reason: `v5.1 ATR Adaptive: ${symbol} 趨勢共振 + 波動率自適應`,
      score: 95
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

function calcATR(candles: any[]): number {
  let trSum = 0;
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trSum += tr;
  }
  return trSum / (candles.length - 1);
}
