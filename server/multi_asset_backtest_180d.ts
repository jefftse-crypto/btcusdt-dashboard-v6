import { runManusScalper } from "./manus_scalper_strategy";
import axios from "axios";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

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

async function runMultiAssetBacktest() {
  console.log(`🚀 開始 v6.0 機構級 (BTC, ETH, SOL, BNB) 180 天深度回測...`);
  
  const btcCandles5m = await fetchHistoricalData("BTCUSDT", "5m", 180);
  const btcCandles1h = aggregate(btcCandles5m, 12);

  let totalBalance = 10000;
  let totalTrades = 0;
  let totalWins = 0;
  const leverage = 50;
  const feeRate = 0.0004;

  for (const symbol of SYMBOLS) {
    console.log(`📥 正在處理 ${symbol}...`);
    const candles5m = symbol === "BTCUSDT" ? btcCandles5m : await fetchHistoricalData(symbol, "5m", 180);
    let symbolBalance = 2500; 
    let symbolTrades = 0;
    let symbolWins = 0;

    for (let i = 200; i < candles5m.length - 100; i++) {
      const slice5m = candles5m.slice(0, i);
      const slice1h = aggregate(slice5m, 12);
      const slice4h = aggregate(slice5m, 48);
      const btcSlice1h = btcCandles1h.filter(c => c.time <= candles5m[i].time).slice(-100);
      
      const signal = runManusScalper(slice5m, slice1h, slice4h, btcSlice1h, symbol, candles5m[i].time);
      
      if (signal && typeof signal.price === "number" && typeof signal.tp === "number" && typeof signal.sl === "number") {
        symbolTrades++;
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
          symbolWins++;
          const profit = (Math.abs(tpPrice - entryPrice) / entryPrice) * leverage - (feeRate * leverage);
          symbolBalance *= (1 + profit);
        } else if (result === "loss") {
          const loss = (Math.abs(slPrice - entryPrice) / entryPrice) * leverage + (feeRate * leverage);
          symbolBalance *= (1 - loss);
        }
        if (symbolBalance <= 0) break;
      }
    }
    
    console.log(`✅ ${symbol} 完成: 交易 ${symbolTrades} 次, 勝率 ${symbolTrades > 0 ? ((symbolWins/symbolTrades)*100).toFixed(2) : 0}%, 最終餘額 $${symbolBalance.toFixed(2)}`);
    totalBalance += (symbolBalance - 2500);
    totalTrades += symbolTrades;
    totalWins += symbolWins;
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`v6.0 機構級綜合回測報告 (180 天, 50x):`);
  console.log(`總交易次數: ${totalTrades}`);
  if (totalTrades > 0) {
    console.log(`綜合勝率: ${((totalWins / totalTrades) * 100).toFixed(2)}%`);
    console.log(`最終總餘額: $${totalBalance.toFixed(2)}`);
    console.log(`總收益率: ${(((totalBalance - 10000) / 10000) * 100).toFixed(2)}%`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

runMultiAssetBacktest();
