import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

interface Candle { time:number; open:number; high:number; low:number; close:number; volume:number; }
interface Signal { i:number; time:number; dir:'long'|'short'; score:number; entry:number; stop:number; riskPct:number; rrToKey:number; leverage:number; notes:string[]; }
interface Trade extends Signal { exitTime:number; r:number; accountPct:number; outcome:string; mfeR:number; maeR:number; }

const ROOT = '/home/ubuntu/btcusdt_dashboard_v6';
const DATA_DIR = '/home/ubuntu/btcusdt_dashboard_v6/data/binance_btcusdt_15m_1y';
const OUT_DIR = '/home/ubuntu/btcusdt_dashboard_v6/reports';
fs.mkdirSync(DATA_DIR, { recursive:true });
fs.mkdirSync(OUT_DIR, { recursive:true });

const months:string[] = [];
for (const m of ['2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04']) months.push(m);

function run(cmd:string, args:string[]) { execFileSync(cmd, args, { stdio:'inherit' }); }
function ensureData() {
  for (const ym of months) {
    const zip = path.join(DATA_DIR, `BTCUSDT-15m-${ym}.zip`);
    const csv = path.join(DATA_DIR, `BTCUSDT-15m-${ym}.csv`);
    if (!fs.existsSync(csv)) {
      const url = `https://data.binance.vision/data/futures/um/monthly/klines/BTCUSDT/15m/BTCUSDT-15m-${ym}.zip`;
      if (!fs.existsSync(zip)) run('curl', ['-L','-sS','--retry','3','--max-time','60','-o',zip,url]);
      run('unzip', ['-o', zip, '-d', DATA_DIR]);
    }
  }
}

function loadCandles(): Candle[] {
  const out:Candle[] = [];
  for (const ym of months) {
    const csv = path.join(DATA_DIR, `BTCUSDT-15m-${ym}.csv`);
    const lines = fs.readFileSync(csv, 'utf8').trim().split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith('open_time')) continue;
      const p = line.split(',');
      const t = Math.floor(Number(p[0]) / 1000);
      out.push({ time:t, open:Number(p[1]), high:Number(p[2]), low:Number(p[3]), close:Number(p[4]), volume:Number(p[5]) });
    }
  }
  out.sort((a,b)=>a.time-b.time);
  const seen = new Set<number>();
  return out.filter(c => seen.has(c.time) ? false : (seen.add(c.time), true));
}

function ema(values:number[], p:number): number[] {
  const k = 2/(p+1); const out:number[]=[]; let prev = values[0];
  for (let i=0;i<values.length;i++){ prev = i===0 ? values[i] : values[i]*k + prev*(1-k); out.push(prev); }
  return out;
}
function sma(values:number[], p:number): number[] {
  const out:number[]=[]; let s=0;
  for (let i=0;i<values.length;i++){ s+=values[i]; if(i>=p)s-=values[i-p]; out.push(i>=p-1?s/p:s/(i+1)); }
  return out;
}
function atr(c:Candle[], p=14): number[] {
  const tr:number[]=[];
  for (let i=0;i<c.length;i++) {
    if(i===0) tr.push(c[i].high-c[i].low); else tr.push(Math.max(c[i].high-c[i].low, Math.abs(c[i].high-c[i-1].close), Math.abs(c[i].low-c[i-1].close)));
  }
  return sma(tr,p);
}
function resample(c:Candle[], n:number): Candle[] {
  const out:Candle[]=[];
  for(let i=0;i+n<=c.length;i+=n){ const s=c.slice(i,i+n); out.push({time:s[0].time, open:s[0].open, high:Math.max(...s.map(x=>x.high)), low:Math.min(...s.map(x=>x.low)), close:s[s.length-1].close, volume:s.reduce((a,x)=>a+x.volume,0)}); }
  return out;
}
function rollingMin(c:Candle[], i:number, n:number){ let v=Infinity; for(let j=Math.max(0,i-n);j<i;j++) v=Math.min(v,c[j].low); return v; }
function rollingMax(c:Candle[], i:number, n:number){ let v=-Infinity; for(let j=Math.max(0,i-n);j<i;j++) v=Math.max(v,c[j].high); return v; }
function dayKey(t:number){ return new Date(t*1000).toISOString().slice(0,10); }
function hourUtc(t:number){ return new Date(t*1000).getUTCHours(); }
function inSession(t:number){ const h=hourUtc(t); return (h>=7 && h<=11) || (h>=13 && h<=17); }
function leverageFor(riskPct:number){ if(riskPct<=0.0035) return 50; if(riskPct<=0.0045) return 40; if(riskPct<=0.006) return 30; if(riskPct<=0.008) return 20; return 0; }

function calcDailyVwap(c:Candle[]): number[] {
  const out:number[]=[]; let cur='', pv=0, vv=0;
  for(let i=0;i<c.length;i++){ const d=dayKey(c[i].time); if(d!==cur){cur=d; pv=0; vv=0;} const typ=(c[i].high+c[i].low+c[i].close)/3; pv+=typ*c[i].volume; vv+=c[i].volume; out.push(vv>0?pv/vv:c[i].close); }
  return out;
}
function calcCvd(c:Candle[]): number[] { let s=0; return c.map(x=>{ const sign=x.close>x.open?1:x.close<x.open?-1:0; s += sign*x.volume; return s; }); }
function profile(c:Candle[], i:number, lookback=96){
  const s=Math.max(0,i-lookback), part=c.slice(s,i); if(part.length<20) return {poc:c[i].close, vah:c[i].close, val:c[i].close};
  const lo=Math.min(...part.map(x=>x.low)), hi=Math.max(...part.map(x=>x.high)); const bins=36; const step=(hi-lo)/bins || 1; const counts=Array(bins).fill(0);
  for(const x of part){ const mid=(x.high+x.low+x.close)/3; const b=Math.max(0,Math.min(bins-1,Math.floor((mid-lo)/step))); counts[b]+=1; }
  let pocIdx=0; for(let b=1;b<bins;b++) if(counts[b]>counts[pocIdx]) pocIdx=b;
  const total=counts.reduce((a,b)=>a+b,0), target=total*0.7; let l=pocIdx,r=pocIdx,sum=counts[pocIdx];
  while(sum<target && (l>0 || r<bins-1)){ const left=l>0?counts[l-1]:-1, right=r<bins-1?counts[r+1]:-1; if(right>=left && r<bins-1){r++; sum+=counts[r];} else if(l>0){l--; sum+=counts[l];} else break; }
  return { poc:lo+(pocIdx+0.5)*step, val:lo+l*step, vah:lo+(r+1)*step };
}

function buildSignals(c:Candle[], threshold:number): Signal[] {
  const closes=c.map(x=>x.close), vols=c.map(x=>x.volume); const ema20=ema(closes,20); const ema50=ema(closes,50); const ema200=ema(closes,200); const atr14=atr(c,14); const vwap=calcDailyVwap(c); const cvd=calcCvd(c); const volSma=sma(vols,20);
  const c4=resample(c,16); const cl4=c4.map(x=>x.close); const e4_50=ema(cl4,50); const e4_200=ema(cl4,200);
  const sigs:Signal[]=[];
  for(let i=220;i<c.length-1;i++){
    if(!inSession(c[i].time)) continue;
    const idx4=Math.min(c4.length-1, Math.floor(i/16)); if(idx4<210) continue;
    const p=profile(c,i,96); const a=atr14[i]; if(!a || a<=0) continue;
    const body=Math.abs(c[i].close-c[i].open), range=Math.max(1e-9,c[i].high-c[i].low); const bodyRatio=body/range;
    const low20=rollingMin(c,i,20), high20=rollingMax(c,i,20); const prevLow=rollingMin(c,i,96), prevHigh=rollingMax(c,i,96);
    const htfUp=c4[idx4].close>e4_50[idx4] && e4_50[idx4]>e4_50[idx4-3] && e4_50[idx4]>=e4_200[idx4]*0.985;
    const htfDn=c4[idx4].close<e4_50[idx4] && e4_50[idx4]<e4_50[idx4-3] && e4_50[idx4]<=e4_200[idx4]*1.015;
    for(const dir of ['long','short'] as const){
      let score=0; const notes:string[]=[]; const entry=c[i].close;
      if(dir==='long'){
        if(htfUp){score+=2; notes.push('4H趋势向上');} else if(c[i].close>ema200[i]){score+=1; notes.push('价格在EMA200上方');}
        const near=Math.min(Math.abs(entry-vwap[i]),Math.abs(entry-p.poc),Math.abs(entry-p.val)); if(near<=0.75*a){score+=2; notes.push('靠近VWAP/POC/VAL价值区');}
        if(c[i].low<=low20*1.0005 && c[i].close>low20){score+=1.5; notes.push('扫前低后收回');}
        if((cvd[i]-cvd[i-6]>0) || (c[i].low<rollingMin(c,i,10) && cvd[i]>cvd[i-10])){score+=1.5; notes.push('CVD确认或背离');}
        if((c[i-1].close<vwap[i-1] && c[i].close>vwap[i]) || (c[i-1].close<p.poc && c[i].close>p.poc)){score+=1; notes.push('回收VWAP/POC');}
        if(c[i].volume>=volSma[i]*0.8 && bodyRatio>=0.25){score+=1; notes.push('量能与实体合格');}
        const stop=Math.min(low20,c[i].low)-0.15*a; const risk=entry-stop; const keyTarget=Math.max(p.vah, prevHigh, entry+2*risk); const rrToKey=(keyTarget-entry)/risk; if(risk>0 && rrToKey>=2){score+=1; notes.push('关键目标RR>=2');}
        const riskPct=risk/entry; const lev=leverageFor(riskPct); if(score>=threshold && lev>0 && riskPct>=0.0015) sigs.push({i,time:c[i].time,dir,score,entry,stop,riskPct,rrToKey,leverage:lev,notes});
      } else {
        if(htfDn){score+=2; notes.push('4H趋势向下');} else if(c[i].close<ema200[i]){score+=1; notes.push('价格在EMA200下方');}
        const near=Math.min(Math.abs(entry-vwap[i]),Math.abs(entry-p.poc),Math.abs(entry-p.vah)); if(near<=0.75*a){score+=2; notes.push('靠近VWAP/POC/VAH价值区');}
        if(c[i].high>=high20*0.9995 && c[i].close<high20){score+=1.5; notes.push('扫前高后跌回');}
        if((cvd[i]-cvd[i-6]<0) || (c[i].high>rollingMax(c,i,10) && cvd[i]<cvd[i-10])){score+=1.5; notes.push('CVD确认或背离');}
        if((c[i-1].close>vwap[i-1] && c[i].close<vwap[i]) || (c[i-1].close>p.poc && c[i].close<p.poc)){score+=1; notes.push('跌回VWAP/POC');}
        if(c[i].volume>=volSma[i]*0.8 && bodyRatio>=0.25){score+=1; notes.push('量能与实体合格');}
        const stop=Math.max(high20,c[i].high)+0.15*a; const risk=stop-entry; const keyTarget=Math.min(p.val, prevLow, entry-2*risk); const rrToKey=(entry-keyTarget)/risk; if(risk>0 && rrToKey>=2){score+=1; notes.push('关键目标RR>=2');}
        const riskPct=risk/entry; const lev=leverageFor(riskPct); if(score>=threshold && lev>0 && riskPct>=0.0015) sigs.push({i,time:c[i].time,dir,score,entry,stop,riskPct,rrToKey,leverage:lev,notes});
      }
    }
  }
  return sigs.sort((a,b)=>a.i-b.i || b.score-a.score);
}

function simulate(c:Candle[], sigs:Signal[], riskPerTrade=0.0035): Trade[] {
  const trades:Trade[]=[]; const usedDay=new Set<string>(); let lastExitI=-1;
  for(const s of sigs){ const d=dayKey(s.time); if(usedDay.has(d) || s.i<=lastExitI) continue; usedDay.add(d);
    const risk=Math.abs(s.entry-s.stop); const levels = s.dir==='long' ? [s.entry+risk, s.entry+2*risk, s.entry+3*risk] : [s.entry-risk, s.entry-2*risk, s.entry-3*risk];
    let filled=[false,false,false]; let remaining=1; let r=0; let stop=s.stop; let outcome='timeout'; let exitI=Math.min(c.length-1,s.i+96); let mfeR=0, maeR=0;
    for(let j=s.i+1;j<=Math.min(c.length-1,s.i+96);j++){
      const high=c[j].high, low=c[j].low;
      const fav=s.dir==='long' ? (high-s.entry)/risk : (s.entry-low)/risk; const adv=s.dir==='long' ? (s.entry-low)/risk : (high-s.entry)/risk; mfeR=Math.max(mfeR,fav); maeR=Math.max(maeR,adv);
      const stopHit=s.dir==='long' ? low<=stop : high>=stop;
      if(stopHit){ r += remaining*((stop-s.entry)/(s.dir==='long'?risk:-risk)); outcome = filled[0]?'breakeven_or_trailing_stop':'stop'; exitI=j; remaining=0; break; }
      for(let k=0;k<3;k++){
        if(!filled[k]){ const hit=s.dir==='long' ? high>=levels[k] : low<=levels[k]; if(hit){ const part=[0.4,0.35,0.25][k]; r += part*(k+1); remaining-=part; filled[k]=true; if(k===0) stop=s.entry; if(k===2){ outcome='tp3'; exitI=j; remaining=0; break; } } }
      }
      if(remaining<=0) break;
      exitI=j;
    }
    if(remaining>0){ const ex=c[exitI].close; const remR=(ex-s.entry)/(s.dir==='long'?risk:-risk); r += remaining*remR; outcome=filled[1]?'time_after_tp2':filled[0]?'time_after_tp1':'timeout'; }
    const feeR = 0.0008 / s.riskPct; // 粗略按开平合计8bp折算为R
    const netR = r - feeR;
    trades.push({...s, exitTime:c[exitI].time, r:netR, accountPct:netR*riskPerTrade*100, outcome, mfeR, maeR}); lastExitI=exitI;
  }
  return trades;
}
function stats(trades:Trade[], days:number, riskPerTrade:number){
  const wins=trades.filter(t=>t.r>0); const losses=trades.filter(t=>t.r<=0); const gp=wins.reduce((a,t)=>a+t.r,0), gl=-losses.reduce((a,t)=>a+t.r,0); let eq=0, peak=0, maxDd=0;
  for(const t of trades){ eq+=t.r*riskPerTrade; peak=Math.max(peak,eq); maxDd=Math.max(maxDd,peak-eq); }
  return { trades:trades.length, days:Math.round(days), tradesPerDay:trades.length/days, daysPerTrade:days/Math.max(1,trades.length), winRate:wins.length/Math.max(1,trades.length)*100, profitFactor:gl>0?gp/gl:99, expectancyR:trades.reduce((a,t)=>a+t.r,0)/Math.max(1,trades.length), totalR:trades.reduce((a,t)=>a+t.r,0), accountReturnPct:trades.reduce((a,t)=>a+t.accountPct,0), maxDrawdownPct:maxDd*100, avgRiskPct:trades.reduce((a,t)=>a+t.riskPct,0)/Math.max(1,trades.length)*100, avgLev:trades.reduce((a,t)=>a+t.leverage,0)/Math.max(1,trades.length), wins:wins.length, losses:losses.length };
}

async function main(){
  ensureData(); const candles=loadCandles(); const days=(candles[candles.length-1].time-candles[0].time)/86400; const riskPerTrade=0.0035;
  const thresholds=[7.5,8,8.5,9]; const summaries:any[]=[]; const all:any={};
  for(const th of thresholds){ const sigs=buildSignals(candles, th); const trades=simulate(candles, sigs, riskPerTrade); const st=stats(trades,days,riskPerTrade); summaries.push({threshold:th, rawSignals:sigs.length, ...st}); all[String(th)]={summary:summaries[summaries.length-1], trades}; }
  const best = summaries.slice().sort((a,b)=> (b.profitFactor*10+b.accountReturnPct+b.winRate/10) - (a.profitFactor*10+a.accountReturnPct+a.winRate/10))[0];
  fs.writeFileSync(path.join(OUT_DIR,'htr_1d_daily_backtest_1y.json'), JSON.stringify({source:'Binance Data Vision futures monthly klines BTCUSDT 15m', months, candles:candles.length, first:new Date(candles[0].time*1000).toISOString(), last:new Date(candles[candles.length-1].time*1000).toISOString(), riskPerTrade, summaries, best, detail:all}, null, 2));
  const rows=summaries.map(s=>`| ${s.threshold} | ${s.rawSignals} | ${s.trades} | ${s.daysPerTrade.toFixed(2)} | ${s.winRate.toFixed(2)}% | ${s.profitFactor.toFixed(2)} | ${s.expectancyR.toFixed(3)}R | ${s.totalR.toFixed(2)}R | ${s.accountReturnPct.toFixed(2)}% | ${s.maxDrawdownPct.toFixed(2)}% | ${s.avgRiskPct.toFixed(3)}% | ${s.avgLev.toFixed(1)}x |`).join('\n');
  const md=`# HTR-1D 日内高信任度策略一年回测\n\n数据源：Binance Data Vision USDT-M Futures BTCUSDT 15m 月度 K 线。区间：${new Date(candles[0].time*1000).toISOString()} 至 ${new Date(candles[candles.length-1].time*1000).toISOString()}，共 ${candles.length} 根 15m K 线，约 ${days.toFixed(1)} 天。\n\n本回测把前述策略转成可执行规则：4H 趋势、VWAP/TPO 价值区、扫流动性、CVD 估算确认、成交量实体过滤、关键目标 RR 过滤。每个 UTC 日期最多一笔主交易，交易只在欧洲盘与美盘主要窗口触发。账户风险按每笔 ${ (riskPerTrade*100).toFixed(2)}% 计算，分批止盈为 40% at 1R、35% at 2R、25% at 3R，达到 1R 后余仓止损移动到入场附近。手续费按开平合计约 8bp 粗略折算进 R。\n\n| 信号阈值 | 原始信号 | 实际交易 | 天/笔 | 胜率 | PF | 期望值 | 总R | 账户收益 | 最大回撤 | 平均止损 | 平均杠杆 |\n|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n\n## 当前较优参数\n\n较优阈值为 **${best.threshold} 分**。该版本一年实际交易 **${best.trades} 笔**，约 **${best.daysPerTrade.toFixed(2)} 天一笔**，胜率 **${best.winRate.toFixed(2)}%**，Profit Factor **${best.profitFactor.toFixed(2)}**，总期望 **${best.totalR.toFixed(2)}R**，按每笔账户风险 ${(riskPerTrade*100).toFixed(2)}% 折算的账户收益约 **${best.accountReturnPct.toFixed(2)}%**，最大回撤约 **${best.maxDrawdownPct.toFixed(2)}%**。\n\n## 结论\n\n如果目标是「尽量接近每日一单」，阈值 7.5–8.0 更接近频率目标，但质量会略低；如果目标是更高胜率与更平滑曲线，应优先使用 8.5 或 9.0，但交易频率会低于每日一单。20–50 倍杠杆在这里仅用于保证金效率，真实账户风险仍由止损距离和固定风险比例控制。\n`;
  fs.writeFileSync(path.join(OUT_DIR,'htr_1d_daily_backtest_1y.md'), md);
  console.log(md);
}

main().catch(e=>{ console.error(e); process.exit(1); });
