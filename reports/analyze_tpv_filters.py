import json
from pathlib import Path
from itertools import combinations

root=Path('/home/ubuntu/btcusdt_dashboard_v6')
v4=json.loads((root/'reports/htr_v4_tpv_multisymbol_backtest_1y.json').read_text())
v3=json.loads((root/'reports/htr_v3_multisymbol_backtest_1y.json').read_text())

def stat(trades):
    if not trades:
        return None
    wins=[t for t in trades if t['r']>0]
    losses=[t for t in trades if t['r']<=0]
    gp=sum(t['r'] for t in wins); gl=-sum(t['r'] for t in losses)
    return dict(trades=len(trades), winRate=len(wins)/len(trades)*100, pf=(gp/gl if gl>0 else 99), expectancy=sum(t['r'] for t in trades)/len(trades), totalR=sum(t['r'] for t in trades), maxRisk=max(t['riskPct'] for t in trades)*100, avgScore=sum(t['score'] for t in trades)/len(trades))

def fmt(name, s):
    return f"{name:38s} {s['trades']:4d} {s['winRate']:6.2f}% PF {s['pf']:5.2f} Exp {s['expectancy']:6.3f}R Total {s['totalR']:7.2f}R AvgScore {s['avgScore']:5.2f}"

lines=[]
lines.append('BASELINE V3 BEST')
v3best=v3['best']['config']; lines.append(fmt(v3best, stat(v3['detail'][v3best]['trades'])))
lines.append('\nV4 CONFIGS')
for sm in v4['summaries']:
    cfg=sm['config']; lines.append(fmt(cfg, stat(v4['detail'][cfg]['trades'])))

base=v4['detail']['v4_tpv_pool8_quality']['trades']
lines.append('\nV4 pool8_quality BY SYMBOL')
for sym in sorted(set(t['symbol'] for t in base)):
    lines.append(fmt(sym, stat([t for t in base if t['symbol']==sym])))
lines.append('\nV4 pool8_quality BY DIRECTION')
for d in ['long','short']:
    lines.append(fmt(d, stat([t for t in base if t['dir']==d])))

lines.append('\nV4 pool8_quality SCORE/RISK FILTERS')
for min_score in [8.2,8.6,9.0,9.4,9.8,10.2]:
    tr=[t for t in base if t['score']>=min_score]
    if len(tr)>=20: lines.append(fmt(f'score>={min_score}', stat(tr)))
for max_risk in [0.003,0.004,0.005,0.006,0.007,0.008]:
    tr=[t for t in base if t['riskPct']<=max_risk]
    if len(tr)>=20: lines.append(fmt(f'risk<={max_risk*100:.2f}%', stat(tr)))

lines.append('\nSYMBOL SUBSET SEARCH ON EXECUTED V4 pool8_quality TRADES')
syms=sorted(set(t['symbol'] for t in base))
best=[]
for r in range(1,len(syms)+1):
    for subset in combinations(syms,r):
        tr=[t for t in base if t['symbol'] in subset]
        if len(tr)>=30:
            st=stat(tr); best.append((st['winRate'], st['pf'], st['expectancy'], st['trades'], subset, st))
for _,_,_,_,subset,st in sorted(best, reverse=True)[:20]:
    lines.append(fmt(','.join(subset), st))

out='\n'.join(lines)
(root/'reports/tpv_filter_analysis.txt').write_text(out)
print(out)
