from pathlib import Path

p = Path('/home/ubuntu/btcusdt_dashboard_v6/server/backtest_htr_v4_tpv_multisymbol.ts')
s = p.read_text()

helper = r'''
function touchCount(c:Candle[], i:number, dir:Dir, level:number, atr14:number[], lookback=72, tolAtr=0.45, minGap=6){
  let touches=0, last=-999;
  for(let j=Math.max(20,i-lookback); j<=i; j++){
    const tol=Math.max(1e-9, atr14[j]*tolAtr);
    const ok = dir==='long'
      ? (Math.abs(c[j].low-level)<=tol || (c[j].low<=level+tol && c[j].close>=level))
      : (Math.abs(c[j].high-level)<=tol || (c[j].high>=level-tol && c[j].close<=level));
    if(ok && j-last>=minGap){ touches++; last=j; }
  }
  return touches;
}
function closePos(x:Candle){ return (x.close-x.low)/Math.max(1e-9,x.high-x.low); }
function rrText(rr:number){ return `TPV盈亏比${rr.toFixed(2)}`; }
'''
needle = "function indexAtOrBefore(c:Candle[], t:number){ let lo=0, hi=c.length-1, ans=-1; while(lo<=hi){ const m=(lo+hi)>>1; if(c[m].time<=t){ans=m;lo=m+1;} else hi=m-1; } return ans; }\n"
s = s.replace(needle, needle + helper + "\n")

old_long = r'''    if(trend4Up && state1Up){
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
'''
new_long = r'''    if(trend4Up && state1Up){
      let score=3.4; const notes=[`${symbol}:4H多头`,`1H趋势状态确认`,`TPV大周期方向一致`];
      const support=Math.max(ema50[i], vwap[i]);
      const supportPrev=Math.max(ema50[i-1], vwap[i-1]);
      const touchN=touchCount(c,i,'long',support,atr14,72,0.48,6);
      const nearPoint=Math.abs(entry-support)/a<=0.95 || Math.abs(c[i].low-support)/a<=0.55;
      const verify=entry>support && c[i].close>c[i].open && closePos(c[i])>=0.55;
      const slopeOk=ema50[i]>ema50[i-8] && e1_50[idx1]>e1_50[Math.max(0,idx1-3)];
      if(slopeOk){score+=1.1; notes.push('TPV趋势项：1H/15m EMA斜率同向');}
      if(touchN>=3){score+=1.55; notes.push(`TPV第三触点：动态支点触碰${touchN}次`);}
      if(nearPoint){score+=1.25; notes.push('TPV位置项：入场接近EMA55/VWAP支点');}
      if(c[i-1].low<=supportPrev*1.0035 && verify){score+=1.35; notes.push('TPV收线验证：回踩后收回支点上方');}
      if(entry>vwap[i] && vwap[i]>vwap[i-8]){score+=0.65; notes.push('15m在日内VWAP上方且VWAP上行');}
      if(cvd6>0 && cvd16>0 && cvd32>=0){score+=1.15; notes.push('TPV量能项：CVD多周期顺势');}
      if(c[i].volume>=volSma[i]*0.9 && bodyRatio>=0.24){score+=0.65; notes.push('量能实体合格');}
      if(entry>high12 && c[i-1].close<=high12){score+=0.35; notes.push('突破短结构高点');}
      const stop=Math.min(low24, ema50[i], vwap[i])-0.14*a; const risk=entry-stop; const rrTo=Math.max(high96,pd.pdh,entry+cfg.minRr*risk); const rr=(rrTo-entry)/risk; const riskPct=risk/entry; const lev=leverageFor(riskPct);
      if(risk>0 && rr>=cfg.minRr){score+=1.2; notes.push(rrText(rr));}
      const tpvPass = touchN>=3 && nearPoint && verify && slopeOk;
      if(tpvPass && score>=cfg.score && lev>0 && riskPct>=cfg.minRiskPct && riskPct<=cfg.maxRiskPct) sigs.push({symbol,i,time:c[i].time,dir:'long',score,entry,stop,riskPct,leverage:lev,notes,targets:[1.0,2.2,3.2],parts:[0.40,0.35,0.25],regime:'tpv_trend_up'});
    }
'''
s = s.replace(old_long, new_long)

old_short = r'''    if(trend4Dn && state1Dn){
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
'''
new_short = r'''    if(trend4Dn && state1Dn){
      let score=3.4; const notes=[`${symbol}:4H空头`,`1H趋势状态确认`,`TPV大周期方向一致`];
      const resist=Math.min(ema50[i], vwap[i]);
      const resistPrev=Math.min(ema50[i-1], vwap[i-1]);
      const touchN=touchCount(c,i,'short',resist,atr14,72,0.48,6);
      const nearPoint=Math.abs(entry-resist)/a<=0.95 || Math.abs(c[i].high-resist)/a<=0.55;
      const verify=entry<resist && c[i].close<c[i].open && closePos(c[i])<=0.45;
      const slopeOk=ema50[i]<ema50[i-8] && e1_50[idx1]<e1_50[Math.max(0,idx1-3)];
      if(slopeOk){score+=1.1; notes.push('TPV趋势项：1H/15m EMA斜率同向');}
      if(touchN>=3){score+=1.55; notes.push(`TPV第三触点：动态支点触碰${touchN}次`);}
      if(nearPoint){score+=1.25; notes.push('TPV位置项：入场接近EMA55/VWAP压力');}
      if(c[i-1].high>=resistPrev*0.9965 && verify){score+=1.35; notes.push('TPV收线验证：反抽后收回压力下方');}
      if(entry<vwap[i] && vwap[i]<vwap[i-8]){score+=0.65; notes.push('15m在日内VWAP下方且VWAP下行');}
      if(cvd6<0 && cvd16<0 && cvd32<=0){score+=1.15; notes.push('TPV量能项：CVD多周期顺势');}
      if(c[i].volume>=volSma[i]*0.9 && bodyRatio>=0.24){score+=0.65; notes.push('量能实体合格');}
      if(entry<low12 && c[i-1].close>=low12){score+=0.35; notes.push('跌破短结构低点');}
      const stop=Math.max(high24, ema50[i], vwap[i])+0.14*a; const risk=stop-entry; const rrTo=Math.min(low96,pd.pdl,entry-cfg.minRr*risk); const rr=(entry-rrTo)/risk; const riskPct=risk/entry; const lev=leverageFor(riskPct);
      if(risk>0 && rr>=cfg.minRr){score+=1.2; notes.push(rrText(rr));}
      const tpvPass = touchN>=3 && nearPoint && verify && slopeOk;
      if(tpvPass && score>=cfg.score && lev>0 && riskPct>=cfg.minRiskPct && riskPct<=cfg.maxRiskPct) sigs.push({symbol,i,time:c[i].time,dir:'short',score,entry,stop,riskPct,leverage:lev,notes,targets:[1.0,2.2,3.2],parts:[0.40,0.35,0.25],regime:'tpv_trend_down'});
    }
'''
s = s.replace(old_short, new_short)

old_cfg = r'''  const configs:Cfg[]=[
    {name:'v3_core4_quality', symbols:core4, score:7.0, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'asia_eu_us', cooldownHours:0},
    {name:'v3_core4_frequency', symbols:core4, score:6.5, minRr:1.8, minRiskPct:0.0014, maxRiskPct:0.009, session:'asia_eu_us', cooldownHours:0},
    {name:'v3_core4_strict', symbols:core4, score:7.4, minRr:2.1, minRiskPct:0.0016, maxRiskPct:0.008, session:'eu_us', cooldownHours:4},
    {name:'v3_pool8_quality', symbols:pool8, score:7.0, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'asia_eu_us', cooldownHours:0},
    {name:'v3_pool8_frequency', symbols:pool8, score:6.5, minRr:1.8, minRiskPct:0.0014, maxRiskPct:0.009, session:'asia_eu_us', cooldownHours:0},
    {name:'v3_pool8_strict', symbols:pool8, score:7.4, minRr:2.1, minRiskPct:0.0016, maxRiskPct:0.008, session:'eu_us', cooldownHours:4},
  ];
'''
new_cfg = r'''  const configs:Cfg[]=[
    {name:'v4_tpv_core4_quality', symbols:core4, score:8.2, minRr:2.4, minRiskPct:0.0014, maxRiskPct:0.010, session:'asia_eu_us', cooldownHours:0},
    {name:'v4_tpv_core4_strict', symbols:core4, score:8.8, minRr:2.6, minRiskPct:0.0014, maxRiskPct:0.009, session:'eu_us', cooldownHours:4},
    {name:'v4_tpv_pool8_quality', symbols:pool8, score:8.2, minRr:2.4, minRiskPct:0.0014, maxRiskPct:0.010, session:'asia_eu_us', cooldownHours:0},
    {name:'v4_tpv_pool8_strict', symbols:pool8, score:8.8, minRr:2.6, minRiskPct:0.0014, maxRiskPct:0.009, session:'eu_us', cooldownHours:4},
    {name:'v4_tpv_pool8_elite', symbols:pool8, score:9.3, minRr:2.8, minRiskPct:0.0014, maxRiskPct:0.008, session:'eu_us', cooldownHours:8},
  ];
'''
s = s.replace(old_cfg, new_cfg)

s = s.replace("htr_v3_multisymbol_backtest_1y.json", "htr_v4_tpv_multisymbol_backtest_1y.json")
s = s.replace("htr_v3_multisymbol_backtest_1y.md", "htr_v4_tpv_multisymbol_backtest_1y.md")
s = s.replace("# HTR V3 多币种趋势策略一年回测", "# HTR V4 TPV 启发式多币种策略一年回测")
s = s.replace("V3 使用 4H 定方向、1H 确认交易状态、15m 入场触发", "V4 TPV 使用 4H 定方向、1H 确认交易状态、15m 第三触点与收线验证触发")
s = s.replace("当前最佳为 **${best.config}**", "当前 TPV 最佳为 **${best.config}**")

if "v3_pool8_quality" in s or "trend_up'}" in s:
    print('warning: old markers still present')

p.write_text(s)
print('patched', p)
