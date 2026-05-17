import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

interface Candle { time:number; open:number; high:number; low:number; close:number; volume:number; }
type Dir = 'long'|'short';
interface Signal { symbol:string; i:number; time:number; dir:Dir; score:number; entry:number; stop:number; riskPct:number; leverage:number; notes:string[]; targets:number[]; parts:number[]; regime:string; }
interface Trade extends Signal { exitTime:number; r:number; accountPct:number; outcome:string; mfeR:number; maeR:number; }
interface Cfg { name:string; symbols:string[]; score:number; minRr:number; minRiskPct:number; maxRiskPct:number; session:'asia_eu_us'|'eu_us'|'all'; cooldownHours:number; }

const ROOT = '/home/ubuntu/btcusdt_dashboard_v6';
const DATA_ROOT = path.join(ROOT, 'data/binance_um_15m_1y_multi');
const OUT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(DATA_ROOT, { recursive:true });
fs.mkdirSync(OUT_DIR, { recursive:true });
const months = ['2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];
const core4 = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT'];
const pool8 = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','LINKUSDT','AVAXUSDT'];

function run(cmd:string, args:string[]) { execFileSync(cmd, args, { stdio:'inherit' }); }
function ensureSymbolData(symbol:string) {
  const dir = path.join(DATA_ROOT, symbol); fs.mkdirSync(dir, { recursive:true });
  for (const ym of months) {
    const zip = path.join(dir, `${symbol}-15m-${ym}.zip`);
    const csv = path.join(dir, `${symbol}-15m-${ym}.csv`);
    if (!fs.existsSync(csv)) {
      const url = `https://data.binance.vision/data/futures/um/monthly/klines/${symbol}/15m/${symbol}-15m-${ym}.zip`;
      if (!fs.existsSync(zip)) run('curl', ['-L','-sS','--retry','3','--max-time','80','-o',zip,url]);
      run('unzip', ['-o', zip, '-d', dir]);
    }
  }
}
function loadSymbol(symbol:string): Candle[] {
  ensureSymbolData(symbol);
  const dir = path.join(DATA_ROOT, symbol); const out:Candle[]=[];
  for (const ym of months) {
    const csv = path.join(dir, `${symbol}-15m-${ym}.csv`);
    if (!fs.existsSync(csv)) continue;
    const lines = fs.readFileSync(csv, 'utf8').trim().split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith('open_time')) continue;
      const p=line.split(',');
      out.push({time:Math.floor(Number(p[0])/1000), open:Number(p[1]), high:Number(p[2]), low:Number(p[3]), close:Number(p[4]), volume:Number(p[5])});
    }
  }
  out.sort((a,b)=>a.time-b.time); const seen=new Set<number>(); return out.filter(c=>seen.has(c.time)?false:(seen.add(c.time),true));
}
function ema(values:number[], p:number): number[] { const k=2/(p+1); const out:number[]=[]; let prev=values[0]; for(let i=0;i<values.length;i++){ prev=i===0?values[i]:values[i]*k+prev*(1-k); out.push(prev); } return out; }
function sma(values:number[], p:number): number[] { const out:number[]=[]; let s=0; for(let i=0;i<values.length;i++){ s+=values[i]; if(i>=p)s-=values[i-p]; out.push(i>=p-1?s/p:s/(i+1)); } return out; }
function atr(c:Candle[], p=14): number[] { const tr:number[]=[]; for(let i=0;i<c.length;i++){ tr.push(i===0?c[i].high-c[i].low:Math.max(c[i].high-c[i].low, Math.abs(c[i].high-c[i-1].close), Math.abs(c[i].low-c[i-1].close))); } return sma(tr,p); }
function resample(c:Candle[], n:number): Candle[] { const out:Candle[]=[]; for(let i=0;i+n<=c.length;i+=n){ const s=c.slice(i,i+n); out.push({time:s[0].time, open:s[0].open, high:Math.max(...s.map(x=>x.high)), low:Math.min(...s.map(x=>x.low)), close:s[s.length-1].close, volume:s.reduce((a,x)=>a+x.volume,0)}); } return out; }
function rollingMin(c:Candle[], i:number, n:number){ let v=Infinity; for(let j=Math.max(0,i-n);j<i;j++) v=Math.min(v,c[j].low); return v; }
function rollingMax(c:Candle[], i:number, n:number){ let v=-Infinity; for(let j=Math.max(0,i-n);j<i;j++) v=Math.max(v,c[j].high); return v; }
function dayKey(t:number){ return new Date(t*1000).toISOString().slice(0,10); }
function hourUtc(t:number){ return new Date(t*1000).getUTCHours(); }
function inSession(t:number, session:Cfg['session']){ if(session==='all') return true; const h=hourUtc(t); if(session==='eu_us') return (h>=7 && h<=18); return (h>=2 && h<=5) || (h>=7 && h<=11) || (h>=13 && h<=19); }
function leverageFor(riskPct:number){ if(riskPct<=0.0035) return 50; if(riskPct<=0.0048) return 40; if(riskPct<=0.0065) return 30; if(riskPct<=0.009) return 20; return 0; }
function calcDailyVwap(c:Candle[]): number[] { const out:number[]=[]; let cur='', pv=0, vv=0; for(let i=0;i<c.length;i++){ const d=dayKey(c[i].time); if(d!==cur){cur=d; pv=0; vv=0;} const typ=(c[i].high+c[i].low+c[i].close)/3; pv+=typ*c[i].volume; vv+=c[i].volume; out.push(vv>0?pv/vv:c[i].close); } return out; }
function calcCvd(c:Candle[]): number[] { let s=0; return c.map(x=>{ const denom=Math.max(1e-9, x.high-x.low); const pos=((x.close-x.low)-(x.high-x.close))/denom; s += Math.max(-1,Math.min(1,pos))*x.volume; return s; }); }
function prevDayLevels(c:Candle[], i:number){ const d=dayKey(c[i].time); let hi=-Infinity, lo=Infinity; for(let j=i-1;j>=0;j--){ const dj=dayKey(c[j].time); if(dj===d) continue; const first=dj; for(let k=j;k>=0 && dayKey(c[k].time)===first;k--){ hi=Math.max(hi,c[k].high); lo=Math.min(lo,c[k].low); } break; } return {pdh:hi, pdl:lo}; }
function indexAtOrBefore(c:Candle[], t:number){ let lo=0, hi=c.length-1, ans=-1; while(lo<=hi){ const m=(lo+hi)>>1; if(c[m].time<=t){ans=m;lo=m+1;} else hi=m-1; } return ans; }

function buildSignalsForSymbol(symbol:string, c:Candle[], cfg:Cfg): Signal[] {
  const closes=c.map(x=>x.close), vols=c.map(x=>x.volume); const ema20=ema(closes,20), ema50=ema(closes,50), atr14=atr(c,14), vwap=calcDailyVwap(c), cvd=calcCvd(c), volSma=sma(vols,20);
  const c1=resample(c,4), cl1=c1.map(x=>x.close), e1_20=ema(cl1,20), e1_50=ema(cl1,50), atr1=atr(c1,14), atr1s=sma(atr1,50);
  const c4=resample(c,16), cl4=c4.map(x=>x.close), e4_50=ema(cl4,50), e4_200=ema(cl4,200), atr4=atr(c4,14), atr4s=sma(atr4,30);
  const sigs:Signal[]=[];
  for(let i=240;i<c.length-2;i++){
    if(!inSession(c[i].time,cfg.session)) continue;
    const idx1=Math.min(c1.length-1, Math.floor(i/4)); const idx4=Math.min(c4.length-1, Math.floor(i/16));
    if(idx1<80 || idx4<210) continue;
    const a=atr14[i]; if(!a || a<=0) continue;
    const pd=prevDayLevels(c,i); if(!isFinite(pd.pdh) || !isFinite(pd.pdl)) continue;
    const entry=c[i].close, body=Math.abs(c[i].close-c[i].open), range=Math.max(1e-9,c[i].high-c[i].low), bodyRatio=body/range;
    const low12=rollingMin(c,i,12), high12=rollingMax(c,i,12), low24=rollingMin(c,i,24), high24=rollingMax(c,i,24), low96=rollingMin(c,i,96), high96=rollingMax(c,i,96);
    const cvd6=cvd[i]-cvd[i-6], cvd16=cvd[i]-cvd[i-16], cvd32=cvd[i]-cvd[i-32];
    const trend4Up = c4[idx4].close>e4_50[idx4] && e4_50[idx4]>e4_200[idx4]*0.997 && e4_50[idx4]>e4_50[idx4-4] && atr4[idx4]>=atr4s[idx4]*0.86;
    const trend4Dn = c4[idx4].close<e4_50[idx4] && e4_50[idx4]<e4_200[idx4]*1.003 && e4_50[idx4]<e4_50[idx4-4] && atr4[idx4]>=atr4s[idx4]*0.86;
    const state1Up = c1[idx1].close>e1_20[idx1] && e1_20[idx1]>=e1_50[idx1]*0.998 && e1_20[idx1]>e1_20[Math.max(0,idx1-3)] && atr1[idx1]>=atr1s[idx1]*0.82;
    const state1Dn = c1[idx1].close<e1_20[idx1] && e1_20[idx1]<=e1_50[idx1]*1.002 && e1_20[idx1]<e1_20[Math.max(0,idx1-3)] && atr1[idx1]>=atr1s[idx1]*0.82;

    if(trend4Up && state1Up){
      let score=3.2; const notes=[`${symbol}:4H多头`,`1H趋势状态确认`];
      if(entry>vwap[i] && vwap[i]>vwap[i-8]){score+=1.0; notes.push('15m在日内VWAP上方且VWAP上行');}
      if(c[i-1].low<=Math.max(ema20[i-1],vwap[i-1])*1.0025 && entry>Math.max(ema20[i],vwap[i])){score+=1.55; notes.push('15m回踩EMA20/VWAP后收回');}
      if(entry>high12 && c[i-1].close<=high12){score+=1.05; notes.push('突破短结构高点');}
      if(entry>pd.pdh && c[i-1].close<=pd.pdh){score+=0.75; notes.push('突破前日高点');}
      if(cvd6>0 && cvd16>0 && cvd32>=0){score+=1.2; notes.push('CVD多周期顺势');}
      if(c[i].volume>=volSma[i]*0.95 && bodyRatio>=0.28){score+=0.9; notes.push('量能实体合格');}
      const stop=Math.min(low12, ema50[i], vwap[i])-0.18*a; const risk=entry-stop; const rrTo=Math.max(high96,pd.pdh,entry+cfg.minRr*risk); const rr=(rrTo-entry)/risk; const riskPct=risk/entry; const lev=leverageFor(riskPct);
      if(risk>0 && rr>=cfg.minRr){score+=1.0; notes.push(`目标RR>=${cfg.minRr}`);} if(score>=cfg.score && lev>0 && riskPct>=cfg.minRiskPct && riskPct<=cfg.maxRiskPct) sigs.push({symbol,i,time:c[i].time,dir:'long',score,entry,stop,riskPct,leverage:lev,notes,targets:[1.1,2.1,3.0],parts:[0.45,0.35,0.20],regime:'trend_up'});
    }
    if(trend4Dn && state1Dn){
      let score=3.2; const notes=[`${symbol}:4H空头`,`1H趋势状态确认`];
      if(entry<vwap[i] && vwap[i]<vwap[i-8]){score+=1.0; notes.push('15m在日内VWAP下方且VWAP下行');}
      if(c[i-1].high>=Math.min(ema20[i-1],vwap[i-1])*0.9975 && entry<Math.min(ema20[i],vwap[i])){score+=1.55; notes.push('15m反抽EMA20/VWAP后跌回');}
      if(entry<low12 && c[i-1].close>=low12){score+=1.05; notes.push('跌破短结构低点');}
      if(entry<pd.pdl && c[i-1].close>=pd.pdl){score+=0.75; notes.push('跌破前日低点');}
      if(cvd6<0 && cvd16<0 && cvd32<=0){score+=1.2; notes.push('CVD多周期顺势');}
      if(c[i].volume>=volSma[i]*0.95 && bodyRatio>=0.28){score+=0.9; notes.push('量能实体合格');}
      const stop=Math.max(high12, ema50[i], vwap[i])+0.18*a; const risk=stop-entry; const rrTo=Math.min(low96,pd.pdl,entry-cfg.minRr*risk); const rr=(entry-rrTo)/risk; const riskPct=risk/entry; const lev=leverageFor(riskPct);
      if(risk>0 && rr>=cfg.minRr){score+=1.0; notes.push(`目标RR>=${cfg.minRr}`);} if(score>=cfg.score && lev>0 && riskPct>=cfg.minRiskPct && riskPct<=cfg.maxRiskPct) sigs.push({symbol,i,time:c[i].time,dir:'short',score,entry,stop,riskPct,leverage:lev,notes,targets:[1.1,2.1,3.0],parts:[0.45,0.35,0.20],regime:'trend_down'});
    }
  }
  return sigs;
}

function simulateOne(c:Candle[], s:Signal, riskPerTrade=0.0035): Trade {
  const risk=Math.abs(s.entry-s.stop); const levels=s.targets.map(rm=>s.dir==='long'?s.entry+risk*rm:s.entry-risk*rm);
  const filled=levels.map(()=>false); let remaining=1, r=0, stop=s.stop, outcome='timeout', exitI=Math.min(c.length-1,s.i+96), mfeR=0, maeR=0;
  for(let j=s.i+1;j<=Math.min(c.length-1,s.i+96);j++){
    const high=c[j].high, low=c[j].low; const fav=s.dir==='long'?(high-s.entry)/risk:(s.entry-low)/risk; const adv=s.dir==='long'?(s.entry-low)/risk:(high-s.entry)/risk; mfeR=Math.max(mfeR,fav); maeR=Math.max(maeR,adv);
    const stopHit=s.dir==='long'?low<=stop:high>=stop;
    if(stopHit){ r += remaining*((stop-s.entry)/(s.dir==='long'?risk:-risk)); outcome=filled[0]?'breakeven_or_trailing_stop':'stop'; exitI=j; remaining=0; break; }
    for(let k=0;k<levels.length;k++) if(!filled[k]){ const hit=s.dir==='long'?high>=levels[k]:low<=levels[k]; if(hit){ const part=s.parts[k]; r += part*s.targets[k]; remaining-=part; filled[k]=true; if(k===0) stop=s.entry + (s.dir==='long'?0.05*risk:-0.05*risk); if(k===levels.length-1){outcome='tp_final'; exitI=j; remaining=0; break;} } }
    if(remaining<=0) break; exitI=j;
  }
  if(remaining>0){ const ex=c[exitI].close; const remR=(ex-s.entry)/(s.dir==='long'?risk:-risk); r += remaining*remR; outcome=filled[1]?'time_after_tp2':filled[0]?'time_after_tp1':'timeout'; }
  const feeR=0.0008/s.riskPct; const netR=r-feeR;
  return {...s, exitTime:c[exitI].time, r:netR, accountPct:netR*riskPerTrade*100, outcome, mfeR, maeR};
}
function simulatePortfolio(data:Record<string,Candle[]>, sigs:Signal[], cfg:Cfg, riskPerTrade=0.0035): Trade[] {
  const trades:Trade[]=[]; const usedDay=new Set<string>(); let lastExitTime=0;
  const ordered=sigs.sort((a,b)=>a.time-b.time || b.score-a.score || a.symbol.localeCompare(b.symbol));
  let ptr=0;
  while(ptr<ordered.length){
    const t=ordered[ptr].time; const same:Signal[]=[];
    while(ptr<ordered.length && ordered[ptr].time===t){ same.push(ordered[ptr++]); }
    if(t<=lastExitTime + cfg.cooldownHours*3600) continue;
    const d=dayKey(t); if(usedDay.has(d)) continue;
    const cand=same.filter(s=>!usedDay.has(dayKey(s.time))).sort((a,b)=>b.score-a.score || a.riskPct-b.riskPct)[0];
    if(!cand) continue;
    const tr=simulateOne(data[cand.symbol], cand, riskPerTrade);
    trades.push(tr); usedDay.add(d); lastExitTime=tr.exitTime;
  }
  return trades;
}
function stats(trades:Trade[], days:number, riskPerTrade:number){ const wins=trades.filter(t=>t.r>0), losses=trades.filter(t=>t.r<=0); const gp=wins.reduce((a,t)=>a+t.r,0), gl=-losses.reduce((a,t)=>a+t.r,0); let eq=0, peak=0, maxDd=0; for(const t of trades){ eq+=t.r*riskPerTrade; peak=Math.max(peak,eq); maxDd=Math.max(maxDd,peak-eq); } const bySymbol:any={}; for(const sym of Array.from(new Set(trades.map(t=>t.symbol))).sort()){ const ts=trades.filter(t=>t.symbol===sym), ws=ts.filter(t=>t.r>0), gp2=ws.reduce((a,t)=>a+t.r,0), gl2=-ts.filter(t=>t.r<=0).reduce((a,t)=>a+t.r,0); bySymbol[sym]={trades:ts.length, winRate:ws.length/Math.max(1,ts.length)*100, pf:gl2>0?gp2/gl2:99, totalR:ts.reduce((a,t)=>a+t.r,0)}; } return { trades:trades.length, days:Math.round(days), tradesPerDay:trades.length/days, daysPerTrade:days/Math.max(1,trades.length), winRate:wins.length/Math.max(1,trades.length)*100, profitFactor:gl>0?gp/gl:99, expectancyR:trades.reduce((a,t)=>a+t.r,0)/Math.max(1,trades.length), totalR:trades.reduce((a,t)=>a+t.r,0), accountReturnPct:trades.reduce((a,t)=>a+t.accountPct,0), maxDrawdownPct:maxDd*100, avgRiskPct:trades.reduce((a,t)=>a+t.riskPct,0)/Math.max(1,trades.length)*100, avgLev:trades.reduce((a,t)=>a+t.leverage,0)/Math.max(1,trades.length), wins:wins.length, losses:losses.length, bySymbol}; }

async function main(){
  const allSymbols=Array.from(new Set(pool8)); const data:Record<string,Candle[]>={};
  for(const sym of allSymbols){ console.log('loading', sym); data[sym]=loadSymbol(sym); console.log(sym, data[sym].length, new Date(data[sym][0].time*1000).toISOString(), new Date(data[sym][data[sym].length-1].time*1000).toISOString()); }
  const days=(data['BTCUSDT'][data['BTCUSDT'].length-1].time-data['BTCUSDT'][0].time)/86400; const riskPerTrade=0.0035;
  const v5Top4=['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT'];
  const configs:Cfg[]=[
    // V5 real-data model: derived from walk-forward/meta-filter study.
    // It keeps the original HTR signal engine but tightens symbol pool, score, risk and session.
    {name:'v5_real_top4_euus_score75', symbols:v5Top4, score:7.5, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'eu_us', cooldownHours:0},
    {name:'v5_real_top4_euus_score78', symbols:v5Top4, score:7.8, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'eu_us', cooldownHours:0},
    {name:'v5_real_top4_euus_score75_cd4', symbols:v5Top4, score:7.5, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'eu_us', cooldownHours:4},
  ];
  const summaries:any[]=[]; const detail:any={};
  for(const cfg of configs){
    const sigs:Signal[]=[];
    for(const sym of cfg.symbols){ const ss=buildSignalsForSymbol(sym, data[sym], cfg); console.log(cfg.name, sym, ss.length); sigs.push(...ss); }
    const trades=simulatePortfolio(data, sigs, cfg, riskPerTrade); const st=stats(trades,days,riskPerTrade); const summary={config:cfg.name, symbols:cfg.symbols, rawSignals:sigs.length, ...st}; summaries.push(summary); detail[cfg.name]={config:cfg, summary, trades};
  }
  const best=summaries.slice().sort((a,b)=>(b.profitFactor*10+b.accountReturnPct+b.winRate/10+b.tradesPerDay*8-b.maxDrawdownPct/2)-(a.profitFactor*10+a.accountReturnPct+a.winRate/10+a.tradesPerDay*8-a.maxDrawdownPct/2))[0];
  const output={source:'Binance Data Vision USDT-M Futures monthly klines 15m', months, symbols:pool8, first:new Date(data['BTCUSDT'][0].time*1000).toISOString(), last:new Date(data['BTCUSDT'][data['BTCUSDT'].length-1].time*1000).toISOString(), riskPerTrade, summaries, best, detail};
  fs.writeFileSync(path.join(OUT_DIR,'htr_v5_realdata_model_backtest_1y.json'), JSON.stringify(output,null,2));
  const rows=summaries.map(s=>`| ${s.config} | ${s.symbols.length} | ${s.rawSignals} | ${s.trades} | ${s.daysPerTrade.toFixed(2)} | ${s.winRate.toFixed(2)}% | ${s.profitFactor.toFixed(2)} | ${s.expectancyR.toFixed(3)}R | ${s.accountReturnPct.toFixed(2)}% | ${s.maxDrawdownPct.toFixed(2)}% |`).join('\n');
  const md=`# HTR V5 真实数据升级模型一年回测\n\n数据源：Binance Data Vision USDT-M Futures 15m 月度 K 线。区间：${output.first} 至 ${output.last}。V5 复用 HTR 信号引擎，并基于真实数据走样本外研究，将交易池收敛到 BTC/ETH/BNB/XRP、EU-US 活跃时段、最低评分 7.5/7.8；原始引擎仍使用 4H 定方向、1H 确认交易状态、15m 入场触发，并在多币种同一时间出现信号时选择最高分；每个 UTC 日期最多一笔，账户风险固定 ${(riskPerTrade*100).toFixed(2)}%。\n\n| 配置 | 币种数 | 原始信号 | 实际交易 | 天/笔 | 胜率 | PF | 期望值 | 账户收益 | 最大回撤 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n\n## 当前最佳\n\n综合频率、PF、收益、胜率与回撤后，当前 V5 最佳为 **${best.config}**：一年实际交易 **${best.trades} 笔**，约 **${best.daysPerTrade.toFixed(2)} 天一笔**，胜率 **${best.winRate.toFixed(2)}%**，PF **${best.profitFactor.toFixed(2)}**，账户结果 **${best.accountReturnPct.toFixed(2)}%**，最大回撤 **${best.maxDrawdownPct.toFixed(2)}%**。\n`;
  fs.writeFileSync(path.join(OUT_DIR,'htr_v5_realdata_model_backtest_1y.md'), md);
  console.log(md);
}
main().catch(e=>{ console.error(e); process.exit(1); });
