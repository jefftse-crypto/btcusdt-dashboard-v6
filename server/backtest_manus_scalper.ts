import { runManusScalper } from "./manus_scalper_strategy.js";
import { Candle } from "@shared/cryptoTypes";
import * as fs from "fs";

// 模擬回測環境
async function runBacktest() {
  console.log("🚀 開始 Manus-Scalper v1.0 深度回測...");
  
  // 讀取歷史數據 (假設已有 1m 數據文件，若無則模擬部分數據進行邏輯驗證)
  // 這裡我們使用模擬數據生成器來驗證策略在特定形態下的表現
  const mockCandles1m: Candle[] = generateMockData(2000); 
  const mockCandles5m: Candle[] = aggregateTo5m(mockCandles1m);
  const mockCandles1h: Candle[] = aggregateToHigherTimeframe(mockCandles5m, 12);
  const mockCandles4h: Candle[] = aggregateToHigherTimeframe(mockCandles1h, 4);

  let balance = 10000;
  let trades = 0;
  let wins = 0;
  const leverage = 50;
  const feeRate = 0.0004; // 0.04% 手續費

  for (let i = 100; i < mockCandles1m.length - 10; i++) {
    const slice1m = mockCandles1m.slice(0, i);
    const slice5m = aggregateTo5m(slice1m);
    const slice1h = mockCandles1h.filter(c => c.time <= slice1m[slice1m.length - 1].time);
    const slice4h = mockCandles4h.filter(c => c.time <= slice1m[slice1m.length - 1].time);
    
    const signal = runManusScalper(slice5m, slice1h, slice4h, slice1h, "BTCUSDT", slice1m[slice1m.length - 1].time);
    
    if (signal && typeof signal.price === "number" && typeof signal.tp === "number" && typeof signal.sl === "number") {
      trades++;
      const entryPrice = signal.price;
      const tpPrice = signal.tp;
      const slPrice = signal.sl;
      
      // 模擬後續價格走勢
      let result = "none";
      for (let j = i + 1; j < i + 100 && j < mockCandles1m.length; j++) {
        const high = mockCandles1m[j].high;
        const low = mockCandles1m[j].low;
        
        if (signal.direction === "long") {
          if (low <= slPrice) { result = "loss"; break; }
          if (high >= tpPrice) { result = "win"; break; }
        } else {
          if (high >= slPrice) { result = "loss"; break; }
          if (low <= tpPrice) { result = "win"; break; }
        }
      }
      
      if (result === "win") {
        wins++;
        const profit = (Math.abs(tpPrice - entryPrice) / entryPrice) * leverage - (feeRate * leverage);
        balance *= (1 + profit);
      } else if (result === "loss") {
        const loss = (Math.abs(slPrice - entryPrice) / entryPrice) * leverage + (feeRate * leverage);
        balance *= (1 - loss);
      }
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`回測結果:`);
  console.log(`總交易次數: ${trades}`);
  console.log(`勝率: ${((wins / trades) * 100).toFixed(2)}%`);
  console.log(`最終餘額: $${balance.toFixed(2)}`);
  console.log(`總收益率: ${(((balance - 10000) / 10000) * 100).toFixed(2)}%`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// 數據輔助函數
function generateMockData(count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 60000;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 20;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 10;
    const low = Math.min(open, close) - Math.random() * 10;
    candles.push({ time: i, open, high, low, close, volume: Math.random() * 100 });
    price = close;
  }
  return candles;
}

function aggregateTo5m(candles1m: Candle[]): Candle[] {
  const candles5m: Candle[] = [];
  for (let i = 0; i < candles1m.length; i += 5) {
    const slice = candles1m.slice(i, i + 5);
    if (slice.length < 5) break;
    candles5m.push({
      time: slice[0].time,
      open: slice[0].open,
      high: Math.max(...slice.map(c => c.high)),
      low: Math.min(...slice.map(c => c.low)),
      close: slice[4].close,
      volume: slice.reduce((a, b) => a + b.volume, 0)
    });
  }
  return candles5m;
}

function aggregateToHigherTimeframe(candles: Candle[], groupSize: number): Candle[] {
  const result: Candle[] = [];
  for (let i = 0; i < candles.length; i += groupSize) {
    const chunk = candles.slice(i, i + groupSize);
    if (chunk.length === 0) continue;
    result.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    });
  }
  return result;
}

runBacktest();
