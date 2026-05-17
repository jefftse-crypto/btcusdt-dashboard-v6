import { runManusScalper } from "./manus_scalper_strategy";
import axios from "axios";

async function fetchRealData(symbol: string, interval: string, limit: number) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await axios.get(url);
  return response.data.map((d: any) => ({
    time: d[0],
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5])
  }));
}

function aggregate(candles: any[], factor: number): any[] {
  const result: any[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const slice = candles.slice(i, i + factor);
    if (slice.length < factor) break;
    result.push({
      time: slice[0].time,
      open: slice[0].open,
      high: Math.max(...slice.map(c => c.high)),
      low: Math.min(...slice.map(c => c.low)),
      close: slice[slice.length - 1].close,
      volume: slice.reduce((a, b) => a + b.volume, 0)
    });
  }
  return result;
}

async function start() {
  console.log("📥 正在抓取真實數據 (5M, 15M)...");
  const candles5m = await fetchRealData("BTCUSDT", "5m", 1000);
  const candles15m = aggregate(candles5m, 3);
  
  console.log(`✅ 數據準備就緒。開始 v3.0 (20x) 專業版回測...`);

  let balance = 10000;
  let trades = 0;
  let wins = 0;
  const leverage = 20;
  const feeRate = 0.0004;

  for (let i = 50; i < candles5m.length - 50; i++) {
    const slice5m = candles5m.slice(0, i);
    const slice1h = aggregate(slice5m, 12);
    const slice4h = aggregate(slice5m, 48);
    
    const signal = runManusScalper(slice5m, slice1h, slice4h, slice1h, "BTCUSDT", candles5m[i].time);
    
    if (signal && typeof signal.price === "number" && typeof signal.tp === "number" && typeof signal.sl === "number") {
      trades++;
      const entryPrice = signal.price;
      const tpPrice = signal.tp;
      const slPrice = signal.sl;
      
      let result = "none";
      for (let j = i + 1; j < i + 300 && j < candles5m.length; j++) {
        const high = candles5m[j].high;
        const low = candles5m[j].low;
        
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
        console.log(`✅ Trade ${trades}: WIN | Profit: +${(profit * 100).toFixed(2)}% | Balance: $${balance.toFixed(2)}`);
      } else if (result === "loss") {
        const loss = (Math.abs(slPrice - entryPrice) / entryPrice) * leverage + (feeRate * leverage);
        balance *= (1 - loss);
        console.log(`❌ Trade ${trades}: LOSS | Loss: -${(loss * 100).toFixed(2)}% | Balance: $${balance.toFixed(2)}`);
      }
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Manus-Scalper v3.0 (20x Professional) 回測結果:`);
  console.log(`總交易次數: ${trades}`);
  if (trades > 0) {
    console.log(`勝率: ${((wins / trades) * 100).toFixed(2)}%`);
    console.log(`最終餘額: $${balance.toFixed(2)}`);
    console.log(`總收益率: ${(((balance - 10000) / 10000) * 100).toFixed(2)}%`);
  } else {
    console.log("⚠️ 當前行情未觸發 v3.0 進場條件。");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

start();
