import { runManusScalper } from "./manus_scalper_strategy";
import axios from "axios";

async function fetchHistoricalData(symbol: string, interval: string, days: number) {
  const limit = 1000;
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;
  let currentStartTime = startTime;
  let allCandles: any[] = [];
  while (currentStartTime < endTime) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;
    try {
      const response = await axios.get(url);
      const data = response.data;
      if (data.length === 0) break;
      const candles = data.map((d: any) => ({
        time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
      }));
      allCandles = allCandles.concat(candles);
      currentStartTime = data[data.length - 1][0] + 1;
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return allCandles;
}

function aggregate(candles: any[], factor: number): any[] {
  const result: any[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const slice = candles.slice(i, i + factor);
    if (slice.length < factor) break;
    result.push({
      time: slice[0].time, open: slice[0].open, high: Math.max(...slice.map(c => c.high)), low: Math.min(...slice.map(c => c.low)), close: slice[slice.length - 1].close, volume: slice.reduce((a, b) => a + b.volume, 0)
    });
  }
  return result;
}

async function runDeepBacktest() {
  const candles5m = await fetchHistoricalData("BTCUSDT", "5m", 180);
  console.log(`✅ 數據抓取完成。開始 50x 極限回測...`);

  let balance = 10000;
  let trades = 0;
  let wins = 0;
  let maxDrawdown = 0;
  let peakBalance = 10000;
  const leverage = 50;
  const feeRate = 0.0004;

  for (let i = 200; i < candles5m.length - 100; i++) {
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
      for (let j = i + 1; j < i + 288 && j < candles5m.length; j++) {
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
      } else if (result === "loss") {
        const loss = (Math.abs(slPrice - entryPrice) / entryPrice) * leverage + (feeRate * leverage);
        balance *= (1 - loss);
      }

      if (balance > peakBalance) peakBalance = balance;
      const dd = (peakBalance - balance) / peakBalance;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (balance <= 0) {
        console.log("⚠️ 帳戶已爆倉！");
        break;
      }
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`50x 極限回測報告 (BTCUSDT 180 天):`);
  console.log(`總交易次數: ${trades}`);
  if (trades > 0) {
    console.log(`勝率: ${((wins / trades) * 100).toFixed(2)}%`);
    console.log(`最終餘額: $${balance.toFixed(2)}`);
    console.log(`總收益率: ${(((balance - 10000) / 10000) * 100).toFixed(2)}%`);
    console.log(`最大回撤: ${(maxDrawdown * 100).toFixed(2)}%`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

runDeepBacktest();
