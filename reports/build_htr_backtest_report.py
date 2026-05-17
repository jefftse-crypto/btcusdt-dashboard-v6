import json
import csv
from pathlib import Path
from datetime import datetime

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path('/home/ubuntu/btcusdt_dashboard_v6')
report_dir = root / 'reports'
js = json.loads((report_dir / 'htr_1d_daily_backtest_1y.json').read_text())

# 选取两个代表版本：最接近每日一单的 7.5，以及质量较好的 9.0。
variants = ['7.5', '9']

plt.style.use('seaborn-v0_8-whitegrid')
fig, ax = plt.subplots(figsize=(11, 6))
for key in variants:
    trades = js['detail'][key]['trades']
    x, y = [], []
    eq = 0.0
    for t in trades:
        eq += t['accountPct']
        x.append(datetime.utcfromtimestamp(t['exitTime']))
        y.append(eq)
    ax.plot(x, y, label=f'threshold {key}: {len(trades)} trades')
ax.axhline(0, color='#999999', linewidth=1)
ax.set_title('HTR-1D BTCUSDT 1Y Backtest Equity Curve')
ax.set_ylabel('Account return, %; fixed 0.35% risk per trade')
ax.set_xlabel('Exit date UTC')
ax.legend()
fig.autofmt_xdate()
plt.tight_layout()
chart = report_dir / 'htr_1d_daily_equity_curve.png'
fig.savefig(chart, dpi=160)

# 输出阈值 9 的交易样本与全交易 CSV。
for key in variants:
    trades = js['detail'][key]['trades']
    csv_path = report_dir / f'htr_1d_trades_threshold_{key.replace(".", "_")}.csv'
    with csv_path.open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['entry_time_utc','exit_time_utc','dir','score','entry','stop','risk_pct','leverage','r','account_pct','outcome','mfe_r','mae_r','notes'])
        w.writeheader()
        for t in trades:
            w.writerow({
                'entry_time_utc': datetime.utcfromtimestamp(t['time']).isoformat(),
                'exit_time_utc': datetime.utcfromtimestamp(t['exitTime']).isoformat(),
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

# 构建增强版报告。
summary_rows = []
for s in js['summaries']:
    summary_rows.append(f"| {s['threshold']} | {s['rawSignals']} | {s['trades']} | {s['daysPerTrade']:.2f} | {s['winRate']:.2f}% | {s['profitFactor']:.2f} | {s['expectancyR']:.3f}R | {s['totalR']:.2f}R | {s['accountReturnPct']:.2f}% | {s['maxDrawdownPct']:.2f}% | {s['avgRiskPct']:.3f}% | {s['avgLev']:.1f}x |")

best = js['best']
near_daily = js['summaries'][0]
md = f"""# BTCUSDT HTR-1D 高杠杆日内策略一年回测报告

作者：**Manus AI**  
数据区间：**{js['first']} 至 {js['last']}**  
数据源：**{js['source']}**  
基础周期：**15m**，并由 15m 重采样生成 4H 趋势过滤。样本包含 **{js['candles']}** 根 15m K 线。

> 重要结论：这套「高胜率、高回报、尽量每日一单」规则在 2025-05 至 2026-04 的 BTCUSDT 永续 15m 数据上，**没有跑出正期望**。越接近每日一单，亏损越明显；越严格，回撤变小但频率降到约每 6.6 天一单，仍然不是可直接实盘的版本。

![权益曲线](htr_1d_daily_equity_curve.png)

## 回测规则摘要

本次把策略转成机械规则：4H 趋势确认、VWAP / TPO 价值区、扫流动性、CVD 估算确认、成交量与实体过滤、关键目标 RR 过滤。每个 UTC 日期最多一笔，入场窗口限制在欧洲盘与美盘主要交易时段。出场使用分批止盈：40% at 1R、35% at 2R、25% at 3R，价格达到 1R 后将余仓止损移动至入场附近。账户风险固定为每笔 **0.35%**；20–50 倍杠杆只作为保证金效率约束，平均止损距离若过大则不允许进入高杠杆版本。

| 信号阈值 | 原始信号 | 实际交易 | 天/笔 | 胜率 | PF | 期望值 | 总R | 账户收益 | 最大回撤 | 平均止损 | 平均杠杆 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
{chr(10).join(summary_rows)}

## 结果解释

最接近「每天一单」的是 **7.5 分阈值**，一年实际交易 **{near_daily['trades']} 笔**，约 **{near_daily['daysPerTrade']:.2f} 天一笔**，但胜率只有 **{near_daily['winRate']:.2f}%**，Profit Factor 仅 **{near_daily['profitFactor']:.2f}**，总结果为 **{near_daily['accountReturnPct']:.2f}%**。这说明信号数量足够，但信号质量不足以覆盖手续费、噪声和高杠杆下的小止损误差。

相对表现较好的版本是 **{best['threshold']} 分阈值**，一年 **{best['trades']} 笔**，胜率 **{best['winRate']:.2f}%**，PF **{best['profitFactor']:.2f}**，亏损缩小到 **{best['accountReturnPct']:.2f}%**，但频率降到 **{best['daysPerTrade']:.2f} 天一笔**。这代表「强过滤」确实可以降低坏交易，但还不能同时满足高胜率、高回报与每日一单三个目标。

## 风险结论

这次回测的结论不是「马上上 20–50 倍」，而是：当前规则还需要继续优化。尤其是 CVD 这里只能用 K 线涨跌方向近似，不能替代真实主动买卖量；TPO 也使用 15m K 线滚动轮廓近似，不能等同交易所逐笔成交分布。因此，本结果适合作为策略筛选的第一轮压力测试，而不是实盘承诺。

我建议下一轮优化方向是把目标从「每天一定一单」改成「只做 A+ 日，每周 2–4 单」，同时加入更严格的波动率 regime、前一日高低点位置、资金费率与多空比过滤。若必须维持每日一单，则需要降低 RR 目标、引入均值回归版本，或把标的扩大到 ETH / SOL / BNB 等多币种轮动，否则单一 BTCUSDT 很难稳定提供每天一个高质量 20–50 倍信号。

## 输出文件

| 文件 | 内容 |
|---|---|
| `htr_1d_daily_backtest_1y.json` | 完整参数敏感性结果与每笔交易明细 |
| `htr_1d_trades_threshold_7_5.csv` | 接近每日一单版本的全部交易 |
| `htr_1d_trades_threshold_9.csv` | 严格过滤版本的全部交易 |
| `htr_1d_daily_equity_curve.png` | 权益曲线图 |
"""
(report_dir / 'htr_1d_daily_backtest_1y_full_report.md').write_text(md)
print(report_dir / 'htr_1d_daily_backtest_1y_full_report.md')
print(chart)
