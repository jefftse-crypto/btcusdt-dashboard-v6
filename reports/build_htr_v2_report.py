import json
import csv
from pathlib import Path
from datetime import datetime

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path('/home/ubuntu/btcusdt_dashboard_v6')
report_dir = root / 'reports'
v1 = json.loads((report_dir / 'htr_1d_daily_backtest_1y.json').read_text())
v2 = json.loads((report_dir / 'htr_v2_regime_backtest_1y.json').read_text())

best_key = v2['best']['config']
compare_keys = [('V1 threshold 7.5', v1['detail']['7.5']['trades']), ('V1 strict 9.0', v1['detail']['9']['trades']), (f'V2 best {best_key}', v2['detail'][best_key]['trades'])]

plt.style.use('seaborn-v0_8-whitegrid')
fig, ax = plt.subplots(figsize=(12, 6.5))
for label, trades in compare_keys:
    eq = 0.0
    xs, ys = [], []
    for t in trades:
        eq += t['accountPct']
        xs.append(datetime.utcfromtimestamp(t['exitTime']))
        ys.append(eq)
    ax.plot(xs, ys, label=f'{label}: {len(trades)} trades')
ax.axhline(0, color='#888', linewidth=1)
ax.set_title('HTR Strategy Backtest: V1 vs V2 Equity Curve')
ax.set_ylabel('Account return, %; fixed 0.35% risk per trade')
ax.set_xlabel('Exit date UTC')
ax.legend()
fig.autofmt_xdate()
plt.tight_layout()
chart = report_dir / 'htr_v2_vs_v1_equity_curve.png'
fig.savefig(chart, dpi=160)

# CSV for all V2 best trades.
best_trades = v2['detail'][best_key]['trades']
csv_path = report_dir / f'htr_v2_best_{best_key}_trades.csv'
with csv_path.open('w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['entry_time_utc','exit_time_utc','strategy','regime','dir','score','entry','stop','risk_pct','leverage','r','account_pct','outcome','mfe_r','mae_r','notes'])
    w.writeheader()
    for t in best_trades:
        w.writerow({
            'entry_time_utc': datetime.utcfromtimestamp(t['time']).isoformat(),
            'exit_time_utc': datetime.utcfromtimestamp(t['exitTime']).isoformat(),
            'strategy': t['strategy'],
            'regime': t['regime'],
            'dir': t['dir'],
            'score': round(t['score'], 2),
            'entry': round(t['entry'], 2),
            'stop': round(t['stop'], 2),
            'risk_pct': round(t['riskPct'] * 100, 4),
            'leverage': t['leverage'],
            'r': round(t['r'], 4),
            'account_pct': round(t['accountPct'], 4),
            'outcome': t['outcome'],
            'mfe_r': round(t['mfeR'], 3),
            'mae_r': round(t['maeR'], 3),
            'notes': '; '.join(t['notes']),
        })

rows = []
for s in v2['summaries']:
    rows.append(f"| {s['config']} | {s['rawSignals']} | {s['trades']} | {s['daysPerTrade']:.2f} | {s['winRate']:.2f}% | {s['profitFactor']:.2f} | {s['expectancyR']:.3f}R | {s['totalR']:.2f}R | {s['accountReturnPct']:.2f}% | {s['maxDrawdownPct']:.2f}% | {s['byStrategy']['trend']['trades']} / {s['byStrategy']['range']['trades']} |")

v1_near = next(s for s in v1['summaries'] if str(s['threshold']) == '7.5')
v1_strict = next(s for s in v1['summaries'] if str(s['threshold']) == '9')
b = v2['best']

md = f"""# HTR V2 行情状态分类策略回测报告

作者：**Manus AI**  
数据区间：**{v2['first']} 至 {v2['last']}**  
数据源：**{v2['source']}**  
基础周期：**BTCUSDT 永续合约 15m K 线**，账户风险固定为每笔 **{v2['riskPerTrade']*100:.2f}%**。

> V2 已完成：原本 V1 的单一打分模型被改成 **行情状态分类 + 趋势策略 / 震荡策略切换**。一年回测显示，V2 明显优于 V1，但真正有效的是 **趋势模块**；震荡均值回归模块在 BTCUSDT 单币种上仍然拖累结果，因此当前实盘候选应采用 **V2 Trend Quality 70**，而不是完整双模块版本。

![V1 与 V2 权益曲线](htr_v2_vs_v1_equity_curve.png)

## V2 逻辑改动

V2 的第一层不再直接找入场，而是先判定市场状态。若 4H 均线结构、方向斜率与波动率扩张同时支持趋势，则启用趋势突破或回踩策略；若价格位于前日区间内部、VWAP 多次穿越且 TPO 价值区收敛，则启用均值回归策略；若两者都不满足，则归类为噪声状态并不交易。这一改动的目的，是避免 V1 把趋势、震荡和噪声行情混在同一套分数里处理。

| 模块 | V2 规则 | 本轮回测结论 |
|---|---|---|
| 趋势模块 | 4H 趋势方向明确，15m 回踩或突破，VWAP 同向，CVD 顺势确认，目标至少约 2R | **有效**，严格版本 PF 达到 1.16 |
| 震荡模块 | 前日区间内、VWAP 来回穿越、TPO 价值区收敛，在 VAH / VAL 附近做均值回归 | **无效**，单独运行 PF 仅 0.37 |
| 噪声过滤 | 不满足趋势或震荡定义时不交易 | **必要**，降低 V1 过度交易问题 |

## 一年参数敏感性结果

| 配置 | 原始信号 | 实际交易 | 天/笔 | 胜率 | PF | 期望值 | 总R | 账户收益 | 最大回撤 | 趋势 / 震荡交易 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
{chr(10).join(rows)}

## 与 V1 对比

V1 接近每日一单的版本一年交易 **{v1_near['trades']} 笔**，约 **{v1_near['daysPerTrade']:.2f} 天一笔**，账户结果为 **{v1_near['accountReturnPct']:.2f}%**。V1 严格版本一年交易 **{v1_strict['trades']} 笔**，约 **{v1_strict['daysPerTrade']:.2f} 天一笔**，账户结果为 **{v1_strict['accountReturnPct']:.2f}%**。V2 最佳版本 **{b['config']}** 一年交易 **{b['trades']} 笔**，约 **{b['daysPerTrade']:.2f} 天一笔**，胜率 **{b['winRate']:.2f}%**，PF **{b['profitFactor']:.2f}**，账户结果 **{b['accountReturnPct']:.2f}%**，最大回撤 **{b['maxDrawdownPct']:.2f}%**。

| 版本 | 交易频率 | 胜率 | PF | 账户收益 | 最大回撤 | 判断 |
|---|---:|---:|---:|---:|---:|---|
| V1 近每日版 | {v1_near['daysPerTrade']:.2f} 天/笔 | {v1_near['winRate']:.2f}% | {v1_near['profitFactor']:.2f} | {v1_near['accountReturnPct']:.2f}% | {v1_near['maxDrawdownPct']:.2f}% | 频率较高但负期望 |
| V1 严格版 | {v1_strict['daysPerTrade']:.2f} 天/笔 | {v1_strict['winRate']:.2f}% | {v1_strict['profitFactor']:.2f} | {v1_strict['accountReturnPct']:.2f}% | {v1_strict['maxDrawdownPct']:.2f}% | 回撤较小但仍负期望 |
| V2 最佳版 | {b['daysPerTrade']:.2f} 天/笔 | {b['winRate']:.2f}% | {b['profitFactor']:.2f} | {b['accountReturnPct']:.2f}% | {b['maxDrawdownPct']:.2f}% | 初步转正，但频率不足 |

## 结论与建议

V2 的方向是正确的，因为它把 V1 的亏损从结构上拆开了：**趋势模块可以保留，震荡模块应暂停或重写**。目前最佳的 V2 趋势严格版已经从 V1 的负期望改善到小幅正期望，但交易频率约 **{b['daysPerTrade']:.2f} 天一笔**，还没有达到每天约一单。若强行把震荡模块打开以提高频率，整体结果会重新转负。

因此，下一步不建议继续在 BTC 单币种上硬凑每日一单。更合理的 V3 方向是保留 V2 趋势模块，把标的扩展到 BTC / ETH / SOL / BNB 等高流动性币种池，用同一套趋势条件跨币种筛选每日最强一笔。这样比降低阈值或强行加入震荡交易更有机会同时接近「每天一单」和「正期望」。

## 输出文件

| 文件 | 内容 |
|---|---|
| `htr_v2_regime_backtest_1y.json` | V2 全部配置与逐笔交易明细 |
| `htr_v2_best_{best_key}_trades.csv` | V2 最佳配置逐笔交易表 |
| `htr_v2_vs_v1_equity_curve.png` | V1 与 V2 权益曲线对比 |
| `backtest_htr_v2_regime.ts` | V2 回测源码 |
"""
(report_dir / 'htr_v2_regime_backtest_1y_full_report.md').write_text(md)
print(report_dir / 'htr_v2_regime_backtest_1y_full_report.md')
print(chart)
print(csv_path)
