import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

interface Candle { time:number; open:number; high:number; low:number; close:number; volume:number; }
type Dir = 'long'|'short';
type Strategy = 'trend'|'range';
type Regime = 'trend_up'|'trend_down'|'range'|'noise';
interface Signal { i:number; time:number; dir:Dir; strategy:Strategy; regime:Regime; score:number; entry:number; stop:number; riskPct:number; leverage:number; notes:string[]; targets:number[]; parts:number[]; }
interface Trade extends Signal { exitTime:number; r:number; accountPct:number; outcome:string; mfeR:number; maeR:number; }

const ROOT = '/home/ubuntu/btcusdt_dashboard_v6';
const DATA_DIR = path.join(ROOT, 'data/binance_btcusdt_15m_1y');
const OUT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(DATA_DIR, { recursive:true });
fs.mkdirSync(OUT_DIR, { recursive:true });
const months = ['2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];

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
function ema(values:number[], p:number): number[] { const k=2/(p+1); const out:number[]=[]; let prev=values[0]; for(let i=0;i<values.length;i++){ prev=i===0?values[i]:values[i]*k+prev*(1-k); out.push(prev); } return out; }
function sma(values:number[], p:number): number[] { const out:number[]=[]; let s=0; for(let i=0;i<values.length;i++){ s+=values[i]; if(i>=p)s-=values[i-p]; out.push(i>=p-1?s/p:s/(i+1)); } return out; }
function atr(c:Candle[], p=14): number[] { const tr:number[]=[]; for(let i=0;i<c.length;i++){ tr.push(i===0?c[i].high-c[i].low:Math.max(c[i].high-c[i].low, Math.abs(c[i].high-c[i-1].close), Math.abs(c[i].low-c[i-1].close))); } return sma(tr,p); }
function resample(c:Candle[], n:number): Candle[] { const out:Candle[]=[]; for(let i=0;i+n<=c.length;i+=n){ const s=c.slice(i,i+n); out.push({time:s[0].time, open:s[0].open, high:Math.max(...s.map(x=>x.high)), low:Math.min(...s.map(x=>x.low)), close:s[s.length-1].close, volume:s.reduce((a,x)=>a+x.volume,0)}); } return out; }
function rollingMin(c:Candle[], i:number, n:number){ let v=Infinity; for(let j=Math.max(0,i-n);j<i;j++) v=Math.min(v,c[j].low); return v; }
function rollingMax(c:Candle[], i:number, n:number){ let v=-Infinity; for(let j=Math.max(0,i-n);j<i;j++) v=Math.max(v,c[j].high); return v; }
function rollingAvg(values:number[], i:number, n:number){ let s=0, k=0; for(let j=Math.max(0,i-n+1);j<=i;j++){ s+=values[j]||0; k++; } return k?s/k:0; }
function dayKey(t:number){ return new Date(t*1000).toISOString().slice(0,10); }
function hourUtc(t:number){ return new Date(t*1000).getUTCHours(); }
function inSession(t:number){ const h=hourUtc(t); return (h>=7 && h<=11) || (h>=13 && h<=18); }
function leverageFor(riskPct:number){ if(riskPct<=0.0035) return 50; if(riskPct<=0.0048) return 40; if(riskPct<=0.0065) return 30; if(riskPct<=0.009) return 20; return 0; }
function calcDailyVwap(c:Candle[]): number[] { const out:number[]=[]; let cur='', pv=0, vv=0; for(let i=0;i<c.length;i++){ const d=dayKey(c[i].time); if(d!==cur){cur=d; pv=0; vv=0;} const typ=(c[i].high+c[i].low+c[i].close)/3; pv+=typ*c[i].volume; vv+=c[i].volume; out.push(vv>0?pv/vv:c[i].close); } return out; }
function calcCvd(c:Candle[]): number[] { let s=0; return c.map(x=>{ const denom=Math.max(1e-9, x.high-x.low); const pos=((x.close-x.low)-(x.high-x.close))/denom; s += Math.max(-1,Math.min(1,pos))*x.volume; return s; }); }
function profile(c:Candle[], i:number, lookback=96){ const s=Math.max(0,i-lookback), part=c.slice(s,i); if(part.length<20) return {poc:c[i].close, vah:c[i].close, val:c[i].close, widthPct:0}; const lo=Math.min(...part.map(x=>x.low)), hi=Math.max(...part.map(x=>x.high)); const bins=40; const step=(hi-lo)/bins || 1; const counts=Array(bins).fill(0); for(const x of part){ const mid=(x.high+x.low+x.close)/3; const b=Math.max(0,Math.min(bins-1,Math.floor((mid-lo)/step))); counts[b]+=1; } let pocIdx=0; for(let b=1;b<bins;b++) if(counts[b]>counts[pocIdx]) pocIdx=b; const total=counts.reduce((a,b)=>a+b,0), target=total*0.7; let l=pocIdx,r=pocIdx,sum=counts[pocIdx]; while(sum<target && (l>0 || r<bins-1)){ const left=l>0?counts[l-1]:-1, right=r<bins-1?counts[r+1]:-1; if(right>=left && r<bins-1){r++; sum+=counts[r];} else if(l>0){l--; sum+=counts[l];} else break; } const val=lo+l*step, vah=lo+(r+1)*step, poc=lo+(pocIdx+0.5)*step; return { poc, val, vah, widthPct:(vah-val)/Math.max(1e-9,poc) }; }
function prevDayLevels(c:Candle[], i:number){ const d=dayKey(c[i].time); let hi=-Infinity, lo=Infinity; for(let j=i-1;j>=0;j--){ const dj=dayKey(c[j].time); if(dj===d) continue; const first=dj; for(let k=j;k>=0 && dayKey(c[k].time)===first;k--){ hi=Math.max(hi,c[k].high); lo=Math.min(lo,c[k].low); } break; } return {pdh:hi, pdl:lo}; }
function crossCount(valuesA:number[], valuesB:number[], i:number, n:number){ let cnt=0; for(let j=Math.max(1,i-n+1);j<=i;j++){ if((valuesA[j-1]-valuesB[j-1])*(valuesA[j]-valuesB[j])<0) cnt++; } return cnt; }

function buildSignals(c:Candle[], cfg:{trendScore:number; rangeScore:number; allowRange:boolean; allowTrend:boolean; minRrTrend:number; minRrRange:number; name:string;}): Signal[] {
  const closes=c.map(x=>x.close), vols=c.map(x=>x.volume); const ema20=ema(closes,20), ema50=ema(closes,50), ema200=ema(closes,200); const atr14=atr(c,14); const atr96=sma(atr14,96); const vwap=calcDailyVwap(c); const cvd=calcCvd(c); const volSma=sma(vols,20);
  const c4=resample(c,16); const cl4=c4.map(x=>x.close); const e4_50=ema(cl4,50); const e4_200=ema(cl4,200); const atr4=atr(c4,14); const atr4S=sma(atr4,30);
  const sigs:Signal[]=[];
  for(let i=240;i<c.length-2;i++){
    if(!inSession(c[i].time)) continue;
    const idx4=Math.min(c4.length-1, Math.floor(i/16)); if(idx4<210) continue;
    const a=atr14[i]; if(!a || a<=0) continue;
    const p=profile(c,i,96), pd=prevDayLevels(c,i); if(!isFinite(pd.pdh) || !isFinite(pd.pdl)) continue;
    const body=Math.abs(c[i].close-c[i].open), range=Math.max(1e-9,c[i].high-c[i].low), bodyRatio=body/range;
    const trendUp = c4[idx4].close>e4_50[idx4] && e4_50[idx4]>e4_200[idx4]*0.997 && e4_50[idx4]>e4_50[idx4-4] && atr4[idx4]>=atr4S[idx4]*0.88;
    const trendDn = c4[idx4].close<e4_50[idx4] && e4_50[idx4]<e4_200[idx4]*1.003 && e4_50[idx4]<e4_50[idx4-4] && atr4[idx4]>=atr4S[idx4]*0.88;
    const insidePrev = c[i].close < pd.pdh && c[i].close > pd.pdl;
    const vwCross = crossCount(closes, vwap, i, 48);
    const vaWidthOk = p.widthPct < 0.028;
    const rangeRegime = insidePrev && vwCross>=2 && vaWidthOk && Math.abs(c[i].close-vwap[i]) <= Math.max(2.3*a, c[i].close*0.012);
    const regime:Regime = trendUp ? 'trend_up' : trendDn ? 'trend_down' : rangeRegime ? 'range' : 'noise';
    const low12=rollingMin(c,i,12), high12=rollingMax(c,i,12), low32=rollingMin(c,i,32), high32=rollingMax(c,i,32), low96=rollingMin(c,i,96), high96=rollingMax(c,i,96);
    const cvd6=cvd[i]-cvd[i-6], cvd16=cvd[i]-cvd[i-16];

    if(cfg.allowTrend && regime==='trend_up'){
      let score=0; const notes:string[]=[]; const entry=c[i].close;
      score+=2; notes.push('V2趋势状态：4H多头');
      if(entry>vwap[i] && vwap[i]>vwap[i-8]){score+=1.2; notes.push('日内VWAP向上且价格在上方');}
      if(c[i-1].low<=Math.max(ema20[i-1], vwap[i-1])*1.002 && entry>Math.max(ema20[i], vwap[i])){score+=1.6; notes.push('回踩EMA20/VWAP后收回');}
      if(entry>high12 && c[i-1].close<=high12){score+=1.1; notes.push('突破短结构高点');}
      if(cvd6>0 && cvd16>0){score+=1.2; notes.push('CVD顺势确认');}
      if(c[i].volume>=volSma[i]*0.95 && bodyRatio>=0.28){score+=1; notes.push('量能实体合格');}
      const stop=Math.min(low12, ema50[i], vwap[i])-0.18*a; const risk=entry-stop; const rrTo=Math.max(high96, pd.pdh, entry+cfg.minRrTrend*risk); const rr=(rrTo-entry)/risk;
      if(risk>0 && rr>=cfg.minRrTrend){score+=1; notes.push(`趋势目标RR>=${cfg.minRrTrend}`);} const riskPct=risk/entry, lev=leverageFor(riskPct);
      if(score>=cfg.trendScore && lev>0 && riskPct>=0.0016 && riskPct<=0.009) sigs.push({i,time:c[i].time,dir:'long',strategy:'trend',regime,score,entry,stop,riskPct,leverage:lev,notes,targets:[1.1,2.1,3.0],parts:[0.45,0.35,0.20]});
    }
    if(cfg.allowTrend && regime==='trend_down'){
      let score=0; const notes:string[]=[]; const entry=c[i].close;
      score+=2; notes.push('V2趋势状态：4H空头');
      if(entry<vwap[i] && vwap[i]<vwap[i-8]){score+=1.2; notes.push('日内VWAP向下且价格在下方');}
      if(c[i-1].high>=Math.min(ema20[i-1], vwap[i-1])*0.998 && entry<Math.min(ema20[i], vwap[i])){score+=1.6; notes.push('反抽EMA20/VWAP后跌回');}
      if(entry<low12 && c[i-1].close>=low12){score+=1.1; notes.push('跌破短结构低点');}
      if(cvd6<0 && cvd16<0){score+=1.2; notes.push('CVD顺势确认');}
      if(c[i].volume>=volSma[i]*0.95 && bodyRatio>=0.28){score+=1; notes.push('量能实体合格');}
      const stop=Math.max(high12, ema50[i], vwap[i])+0.18*a; const risk=stop-entry; const rrTo=Math.min(low96, pd.pdl, entry-cfg.minRrTrend*risk); const rr=(entry-rrTo)/risk;
      if(risk>0 && rr>=cfg.minRrTrend){score+=1; notes.push(`趋势目标RR>=${cfg.minRrTrend}`);} const riskPct=risk/entry, lev=leverageFor(riskPct);
      if(score>=cfg.trendScore && lev>0 && riskPct>=0.0016 && riskPct<=0.009) sigs.push({i,time:c[i].time,dir:'short',strategy:'trend',regime,score,entry,stop,riskPct,leverage:lev,notes,targets:[1.1,2.1,3.0],parts:[0.45,0.35,0.20]});
    }
    if(cfg.allowRange && regime==='range'){
      const dev=(c[i].close-vwap[i])/a;
      // Range long：扫 VAL / 前低 / 短低后收回，目标 VWAP/POC。
      if(c[i].low<=Math.min(p.val, low32)*1.0008 && c[i].close>Math.min(p.val, low32) && dev<0.35){
        let score=2.0; const notes=['V2震荡状态：价值区收敛','下沿扫低后收回']; const entry=c[i].close;
        if(cvd6>0 || (c[i].low<rollingMin(c,i,10) && cvd[i]>cvd[i-10])){score+=1.3; notes.push('CVD背离/回流');}
        if(bodyRatio>=0.22){score+=0.8; notes.push('拒绝K实体合格');}
        if(Math.abs(entry-p.val)<=1.1*a || Math.abs(entry-p.poc)<=1.4*a){score+=0.8; notes.push('靠近VAL/POC');}
        if(c[i].volume>=volSma[i]*0.75){score+=0.6; notes.push('量能不过低');}
        const stop=Math.min(c[i].low, low32)-0.25*a; const risk=entry-stop; const target=Math.max(vwap[i], p.poc); const rr=(target-entry)/risk;
        if(risk>0 && rr>=cfg.minRrRange){score+=1; notes.push(`回归目标RR>=${cfg.minRrRange}`);} const riskPct=risk/entry, lev=leverageFor(riskPct);
        if(score>=cfg.rangeScore && lev>0 && riskPct>=0.0014 && riskPct<=0.009) sigs.push({i,time:c[i].time,dir:'long',strategy:'range',regime,score,entry,stop,riskPct,leverage:lev,notes,targets:[0.85,1.25,1.8],parts:[0.55,0.30,0.15]});
      }
      // Range short：扫 VAH / 前高 / 短高后跌回，目标 VWAP/POC。
      if(c[i].high>=Math.max(p.vah, high32)*0.9992 && c[i].close<Math.max(p.vah, high32) && dev>-0.35){
        let score=2.0; const notes=['V2震荡状态：价值区收敛','上沿扫高后跌回']; const entry=c[i].close;
        if(cvd6<0 || (c[i].high>rollingMax(c,i,10) && cvd[i]<cvd[i-10])){score+=1.3; notes.push('CVD背离/流出');}
        if(bodyRatio>=0.22){score+=0.8; notes.push('拒绝K实体合格');}
        if(Math.abs(entry-p.vah)<=1.1*a || Math.abs(entry-p.poc)<=1.4*a){score+=0.8; notes.push('靠近VAH/POC');}
        if(c[i].volume>=volSma[i]*0.75){score+=0.6; notes.push('量能不过低');}
        const stop=Math.max(c[i].high, high32)+0.25*a; const risk=stop-entry; const target=Math.min(vwap[i], p.poc); const rr=(entry-target)/risk;
        if(risk>0 && rr>=cfg.minRrRange){score+=1; notes.push(`回归目标RR>=${cfg.minRrRange}`);} const riskPct=risk/entry, lev=leverageFor(riskPct);
        if(score>=cfg.rangeScore && lev>0 && riskPct>=0.0014 && riskPct<=0.009) sigs.push({i,time:c[i].time,dir:'short',strategy:'range',regime,score,entry,stop,riskPct,leverage:lev,notes,targets:[0.85,1.25,1.8],parts:[0.55,0.30,0.15]});
      }
    }
  }
  return sigs.sort((a,b)=>a.i-b.i || b.score-a.score);
}

function simulate(c:Candle[], sigs:Signal[], riskPerTrade=0.0035): Trade[] {
  const trades:Trade[]=[]; const usedDay=new Set<string>(); let lastExitI=-1;
  for(const s of sigs){ const d=dayKey(s.time); if(usedDay.has(d) || s.i<=lastExitI) continue; usedDay.add(d);
    const risk=Math.abs(s.entry-s.stop); const levels=s.targets.map(rm=>s.dir==='long'?s.entry+risk*rm:s.entry-risk*rm);
    const filled=levels.map(()=>false); let remaining=1, r=0, stop=s.stop, outcome='timeout', exitI=Math.min(c.length-1,s.i+72), mfeR=0, maeR=0;
    const maxHold=s.strategy==='trend'?96:40;
    for(let j=s.i+1;j<=Math.min(c.length-1,s.i+maxHold);j++){
      const high=c[j].high, low=c[j].low; const fav=s.dir==='long'?(high-s.entry)/risk:(s.entry-low)/risk; const adv=s.dir==='long'?(s.entry-low)/risk:(high-s.entry)/risk; mfeR=Math.max(mfeR,fav); maeR=Math.max(maeR,adv);
      const stopHit=s.dir==='long'?low<=stop:high>=stop;
      if(stopHit){ r += remaining*((stop-s.entry)/(s.dir==='long'?risk:-risk)); outcome=filled[0]?'breakeven_or_trailing_stop':'stop'; exitI=j; remaining=0; break; }
      for(let k=0;k<levels.length;k++) if(!filled[k]){ const hit=s.dir==='long'?high>=levels[k]:low<=levels[k]; if(hit){ const part=s.parts[k]; r += part*s.targets[k]; remaining-=part; filled[k]=true; if(k===0) stop=s.entry + (s.dir==='long'?0.05*risk:-0.05*risk); if(k===levels.length-1){outcome='tp_final'; exitI=j; remaining=0; break;} } }
      if(remaining<=0) break; exitI=j;
    }
    if(remaining>0){ const ex=c[exitI].close; const remR=(ex-s.entry)/(s.dir==='long'?risk:-risk); r += remaining*remR; outcome=filled[1]?'time_after_tp2':filled[0]?'time_after_tp1':'timeout'; }
    const feeR = 0.0008 / s.riskPct;
    const netR = r - feeR;
    trades.push({...s, exitTime:c[exitI].time, r:netR, accountPct:netR*riskPerTrade*100, outcome, mfeR, maeR}); lastExitI=exitI;
  }
  return trades;
}
function stats(trades:Trade[], days:number, riskPerTrade:number){ const wins=trades.filter(t=>t.r>0), losses=trades.filter(t=>t.r<=0); const gp=wins.reduce((a,t)=>a+t.r,0), gl=-losses.reduce((a,t)=>a+t.r,0); let eq=0, peak=0, maxDd=0; for(const t of trades){ eq+=t.r*riskPerTrade; peak=Math.max(peak,eq); maxDd=Math.max(maxDd,peak-eq); } const byStrategy:any={}; for(const st of ['trend','range'] as Strategy[]){ const ts=trades.filter(t=>t.strategy===st); const ws=ts.filter(t=>t.r>0); const gp2=ws.reduce((a,t)=>a+t.r,0), gl2=-ts.filter(t=>t.r<=0).reduce((a,t)=>a+t.r,0); byStrategy[st]={trades:ts.length, winRate:ws.length/Math.max(1,ts.length)*100, pf:gl2>0?gp2/gl2:99, totalR:ts.reduce((a,t)=>a+t.r,0)}; } return { trades:trades.length, days:Math.round(days), tradesPerDay:trades.length/days, daysPerTrade:days/Math.max(1,trades.length), winRate:wins.length/Math.max(1,trades.length)*100, profitFactor:gl>0?gp/gl:99, expectancyR:trades.reduce((a,t)=>a+t.r,0)/Math.max(1,trades.length), totalR:trades.reduce((a,t)=>a+t.r,0), accountReturnPct:trades.reduce((a,t)=>a+t.accountPct,0), maxDrawdownPct:maxDd*100, avgRiskPct:trades.reduce((a,t)=>a+t.riskPct,0)/Math.max(1,trades.length)*100, avgLev:trades.reduce((a,t)=>a+t.leverage,0)/Math.max(1,trades.length), wins:wins.length, losses:losses.length, byStrategy}; }

async function main(){
  ensureData(); const candles=loadCandles(); const days=(candles[candles.length-1].time-candles[0].time)/86400; const riskPerTrade=0.0035;
  const configs=[
    {name:'v2_balanced', trendScore:6.4, rangeScore:5.7, allowRange:true, allowTrend:true, minRrTrend:1.8, minRrRange:0.75},
    {name:'v2_quality', trendScore:7.0, rangeScore:6.2, allowRange:true, allowTrend:true, minRrTrend:2.0, minRrRange:0.9},
    {name:'v2_frequency', trendScore:5.8, rangeScore:5.1, allowRange:true, allowTrend:true, minRrTrend:1.6, minRrRange:0.65},
    {name:'v2_trend_only', trendScore:6.2, rangeScore:99, allowRange:false, allowTrend:true, minRrTrend:1.8, minRrRange:9},
    {name:'v2_trend_quality_66', trendScore:6.6, rangeScore:99, allowRange:false, allowTrend:true, minRrTrend:1.9, minRrRange:9},
    {name:'v2_trend_quality_70', trendScore:7.0, rangeScore:99, allowRange:false, allowTrend:true, minRrTrend:2.0, minRrRange:9},
    {name:'v2_trend_quality_74', trendScore:7.4, rangeScore:99, allowRange:false, allowTrend:true, minRrTrend:2.1, minRrRange:9},
    {name:'v2_range_only', trendScore:99, rangeScore:5.4, allowRange:true, allowTrend:false, minRrTrend:9, minRrRange:0.7},
  ];
  const summaries:any[]=[]; const detail:any={};
  for(const cfg of configs){ const sigs=buildSignals(candles,cfg); const trades=simulate(candles,sigs,riskPerTrade); const st=stats(trades,days,riskPerTrade); const summary={config:cfg.name, rawSignals:sigs.length, ...st}; summaries.push(summary); detail[cfg.name]={config:cfg, summary, trades}; }
  const best=summaries.slice().sort((a,b)=>(b.profitFactor*8+b.accountReturnPct+b.winRate/12+b.tradesPerDay*3)-(a.profitFactor*8+a.accountReturnPct+a.winRate/12+a.tradesPerDay*3))[0];
  fs.writeFileSync(path.join(OUT_DIR,'htr_v2_regime_backtest_1y.json'), JSON.stringify({source:'Binance Data Vision futures monthly klines BTCUSDT 15m', months, candles:candles.length, first:new Date(candles[0].time*1000).toISOString(), last:new Date(candles[candles.length-1].time*1000).toISOString(), riskPerTrade, summaries, best, detail}, null, 2));
  const rows=summaries.map(s=>`| ${s.config} | ${s.rawSignals} | ${s.trades} | ${s.daysPerTrade.toFixed(2)} | ${s.winRate.toFixed(2)}% | ${s.profitFactor.toFixed(2)} | ${s.expectancyR.toFixed(3)}R | ${s.totalR.toFixed(2)}R | ${s.accountReturnPct.toFixed(2)}% | ${s.maxDrawdownPct.toFixed(2)}% | ${s.byStrategy.trend.trades}/${s.byStrategy.range.trades} |`).join('\n');
  const md=`# HTR V2 行情状态分类策略一年回测\n\n数据源：Binance Data Vision USDT-M Futures BTCUSDT 15m 月度 K 线。区间：${new Date(candles[0].time*1000).toISOString()} 至 ${new Date(candles[candles.length-1].time*1000).toISOString()}，共 ${candles.length} 根 15m K 线，约 ${days.toFixed(1)} 天。\n\nV2 将 V1 的单一打分模型改成行情状态分类：4H 趋势明确时只启用趋势突破/回踩；价格位于前日区间、VWAP 多次穿越、TPO 价值区收敛时只启用均值回归；其他噪声状态不交易。每个 UTC 日期最多一笔，账户风险固定 ${(riskPerTrade*100).toFixed(2)}%。\n\n| 配置 | 原始信号 | 实际交易 | 天/笔 | 胜率 | PF | 期望值 | 总R | 账户收益 | 最大回撤 | 趋势/震荡交易 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n\n## 当前最佳\n\n综合频率、PF、收益与胜率后，当前最佳为 **${best.config}**：一年实际交易 **${best.trades} 笔**，约 **${best.daysPerTrade.toFixed(2)} 天一笔**，胜率 **${best.winRate.toFixed(2)}%**，PF **${best.profitFactor.toFixed(2)}**，总结果 **${best.accountReturnPct.toFixed(2)}%**，最大回撤 **${best.maxDrawdownPct.toFixed(2)}%**。\n`;
  fs.writeFileSync(path.join(OUT_DIR,'htr_v2_regime_backtest_1y.md'), md);
  console.log(md);
}
main().catch(e=>{ console.error(e); process.exit(1); });
