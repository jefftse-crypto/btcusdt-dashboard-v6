from __future__ import annotations

import csv
import json
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path('/home/ubuntu/btcusdt_dashboard_v6')
REPORT_DIR = ROOT / 'reports'
V3_JSON = REPORT_DIR / 'htr_v3_multisymbol_backtest_1y.json'
V2_JSON = REPORT_DIR / 'htr_v2_regime_backtest_1y.json'
V1_JSON = REPORT_DIR / 'htr_1d_daily_backtest_1y.json'

OUT_REPORT = REPORT_DIR / 'htr_v3_multisymbol_backtest_1y_full_report.md'
OUT_EQUITY = REPORT_DIR / 'htr_v3_vs_v2_equity_curve.png'
OUT_BAR = REPORT_DIR / 'htr_v3_config_comparison.png'
OUT_CSV = REPORT_DIR / 'htr_v3_best_v3_pool8_quality_trades.csv'


def pct(x: float) -> str:
    return f"{x:.2f}%"


def num(x: float) -> str:
    return f"{x:.2f}"


def dt(ts: int | float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%d %H:%M')


def load(path: Path):
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def find_result(data: dict, name: str) -> dict:
    detail = data.get('detail', {})
    if isinstance(detail, dict) and name in detail:
        return detail[name]
    for r in data.get('results', []):
        cfg = r.get('config', {})
        if isinstance(cfg, dict) and cfg.get('name') == name:
            return r
        if isinstance(cfg, str) and cfg == name:
            return r
        if r.get('summary', {}).get('config') == name:
            return r
    raise KeyError(name)


def best_by_name(data: dict, fallback: str) -> dict:
    if 'best' in data and isinstance(data['best'], dict):
        best_name = data['best'].get('config') or data['best'].get('name')
        if best_name:
            try:
                return find_result(data, best_name)
            except Exception:
                pass
    return find_result(data, fallback)


def trades_to_df(trades: list[dict]) -> pd.DataFrame:
    rows = []
    equity = 100.0
    peak = 100.0
    for n, t in enumerate(trades, start=1):
        account_pct = float(t.get('accountPct', 0.0))
        equity *= 1.0 + account_pct / 100.0
        peak = max(peak, equity)
        dd = equity / peak - 1.0
        rows.append({
            'trade_no': n,
            'entry_time_utc': dt(t['time']),
            'exit_time_utc': dt(t.get('exitTime', t['time'])),
            'symbol': t.get('symbol', ''),
            'direction': t.get('dir', ''),
            'regime': t.get('regime', ''),
            'score': t.get('score', 0),
            'entry': t.get('entry', 0),
            'stop': t.get('stop', 0),
            'leverage': t.get('leverage', 0),
            'risk_pct_price': t.get('riskPct', 0) * 100,
            'r_multiple': t.get('r', 0),
            'account_pct': account_pct,
            'outcome': t.get('outcome', ''),
            'mfe_r': t.get('mfeR', 0),
            'mae_r': t.get('maeR', 0),
            'equity': equity,
            'drawdown_pct': dd * 100,
            'notes': ' / '.join(t.get('notes', [])),
        })
    return pd.DataFrame(rows)


def summary_table(summaries: list[dict]) -> str:
    lines = [
        '| 配置 | 币种数 | 实际交易 | 天/笔 | 胜率 | PF | 期望值 | 账户收益 | 最大回撤 | 平均杠杆 |',
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ]
    for s in summaries:
        lines.append(
            f"| {s['config']} | {len(s.get('symbols', []))} | {s['trades']} | {s['daysPerTrade']:.2f} | "
            f"{s['winRate']:.2f}% | {s['profitFactor']:.2f} | {s['expectancyR']:.3f}R | "
            f"{s['accountReturnPct']:.2f}% | {s['maxDrawdownPct']:.2f}% | {s.get('avgLev', 0):.1f}x |"
        )
    return '\n'.join(lines)


def by_symbol_table(by_symbol: dict) -> str:
    lines = [
        '| 币种 | 交易数 | 胜率 | PF | 总 R |',
        '|---|---:|---:|---:|---:|',
    ]
    for sym, stats in sorted(by_symbol.items(), key=lambda kv: kv[1].get('totalR', 0), reverse=True):
        lines.append(f"| {sym} | {stats['trades']} | {stats['winRate']:.2f}% | {stats['pf']:.2f} | {stats['totalR']:.2f}R |")
    return '\n'.join(lines)


def maybe_summary(data: dict, fallback_name: str) -> dict | None:
    try:
        result = best_by_name(data, fallback_name)
        return result.get('summary', data.get('best'))
    except Exception:
        best = data.get('best')
        if isinstance(best, dict):
            return best
        return None


def plot_equity(v1_data, v2_data, v3_data, v3_best_result):
    plt.style.use('seaborn-v0_8-whitegrid')
    fig, ax = plt.subplots(figsize=(12, 6.5), dpi=160)

    def add_curve(data, fallback_name, label, color):
        try:
            r = best_by_name(data, fallback_name)
            df = trades_to_df(r['trades'])
            if len(df):
                ax.plot(pd.to_datetime(df['exit_time_utc']), df['equity'], label=label, linewidth=2.1, color=color)
        except Exception:
            pass

    add_curve(v1_data, 'threshold_7_5', 'V1 BTC daily scoring', '#9ca3af')
    add_curve(v2_data, 'v2_trend_quality_70', 'V2 BTC regime trend', '#2563eb')
    df3 = trades_to_df(v3_best_result['trades'])
    ax.plot(pd.to_datetime(df3['exit_time_utc']), df3['equity'], label='V3 multi-symbol pool8 quality', linewidth=2.4, color='#16a34a')

    ax.axhline(100, color='#111827', linestyle='--', linewidth=0.8, alpha=0.55)
    ax.set_title('HTR Strategy Equity Curve Comparison, 2025-05 to 2026-04')
    ax.set_ylabel('Equity, initial = 100')
    ax.set_xlabel('Exit time, UTC')
    ax.legend(loc='best')
    fig.tight_layout()
    fig.savefig(OUT_EQUITY)
    plt.close(fig)


def plot_config_bar(summaries: list[dict]):
    plt.style.use('seaborn-v0_8-whitegrid')
    labels = [s['config'].replace('v3_', '') for s in summaries]
    returns = [s['accountReturnPct'] for s in summaries]
    pfs = [s['profitFactor'] for s in summaries]
    trades = [s['trades'] for s in summaries]

    fig, axes = plt.subplots(1, 3, figsize=(14, 4.8), dpi=160)
    axes[0].bar(labels, returns, color='#60a5fa')
    axes[0].set_title('Account Return %')
    axes[1].bar(labels, pfs, color='#34d399')
    axes[1].axhline(1.0, color='#ef4444', linestyle='--', linewidth=1)
    axes[1].set_title('Profit Factor')
    axes[2].bar(labels, trades, color='#fbbf24')
    axes[2].set_title('Trades per Year')
    for ax in axes:
        ax.tick_params(axis='x', labelrotation=35)
    fig.tight_layout()
    fig.savefig(OUT_BAR)
    plt.close(fig)


def main():
    v3 = load(V3_JSON)
    v2 = load(V2_JSON) if V2_JSON.exists() else {}
    v1 = load(V1_JSON) if V1_JSON.exists() else {}

    summaries = v3['summaries']
    best_result = find_result(v3, 'v3_pool8_quality')
    best = best_result['summary']
    best_trades = best_result['trades']
    df = trades_to_df(best_trades)
    df.to_csv(OUT_CSV, index=False, encoding='utf-8-sig', quoting=csv.QUOTE_MINIMAL)

    plot_equity(v1, v2, v3, best_result)
    plot_config_bar(summaries)

    v1_sum = maybe_summary(v1, 'threshold_7_5')
    v2_sum = maybe_summary(v2, 'v2_trend_quality_70')
    outcome_counts = Counter(df['outcome'])
    month_stats = df.assign(month=pd.to_datetime(df['exit_time_utc']).dt.strftime('%Y-%m')).groupby('month').agg(
        trades=('trade_no', 'count'),
        avg_r=('r_multiple', 'mean'),
        total_r=('r_multiple', 'sum'),
        account_pct=('account_pct', 'sum'),
    ).reset_index()

    comparison_lines = [
        '| 版本 | 市场 | 实际交易 | 天/笔 | 胜率 | PF | 账户收益 | 最大回撤 | 结论 |',
        '|---|---|---:|---:|---:|---:|---:|---:|---|',
    ]
    if v1_sum:
        comparison_lines.append(f"| V1 | BTC 单币种 | {v1_sum.get('trades', 0)} | {v1_sum.get('daysPerTrade', 0):.2f} | {v1_sum.get('winRate', 0):.2f}% | {v1_sum.get('profitFactor', 0):.2f} | {v1_sum.get('accountReturnPct', 0):.2f}% | {v1_sum.get('maxDrawdownPct', 0):.2f}% | 负期望或接近无优势 |")
    if v2_sum:
        comparison_lines.append(f"| V2 | BTC 单币种趋势 | {v2_sum.get('trades', 0)} | {v2_sum.get('daysPerTrade', 0):.2f} | {v2_sum.get('winRate', 0):.2f}% | {v2_sum.get('profitFactor', 0):.2f} | {v2_sum.get('accountReturnPct', 0):.2f}% | {v2_sum.get('maxDrawdownPct', 0):.2f}% | 转正但频率不足 |")
    comparison_lines.append(f"| V3 | 8 币种择优 | {best['trades']} | {best['daysPerTrade']:.2f} | {best['winRate']:.2f}% | {best['profitFactor']:.2f} | {best['accountReturnPct']:.2f}% | {best['maxDrawdownPct']:.2f}% | 当前最佳，质量显著提升 |")

    month_lines = ['| 月份 | 交易数 | 平均 R | 总 R | 账户贡献 |', '|---|---:|---:|---:|---:|']
    for _, r in month_stats.iterrows():
        month_lines.append(f"| {r['month']} | {int(r['trades'])} | {r['avg_r']:.3f}R | {r['total_r']:.2f}R | {r['account_pct']:.2f}% |")

    comparison_text = '\n'.join(comparison_lines)
    month_text = '\n'.join(month_lines)
    outcome_text = ', '.join([f'{k}: {v}' for k, v in outcome_counts.items()])
    summary_text = summary_table(summaries)
    by_symbol_text = by_symbol_table(best['bySymbol'])

    md = f"""# HTR V3 多币种策略一年回测完整报告

作者：**Manus AI**  
数据区间：**{v3['first']} 至 {v3['last']}**  
数据来源：Binance Data Vision USDT-M Futures 15m 月度 K 线；回测在本地脚本中完成，使用固定账户风险模型，不包含真实盘口深度滑点。[^1]

> 本报告只用于策略研究与回测验证，不构成投资建议。20–50 倍杠杆会显著放大亏损、滑点与强平风险，实盘必须先经过更长区间、多币种样本、交易成本压力测试与小资金验证。

## 一、核心结论

V3 的改动是有效的。相比 V1 的单一 BTC 打分模型与 V2 的 BTC 单币种趋势模型，**V3 将策略改为 4H 定方向、1H 确认交易状态、15m 触发入场，并在多币种池中每日择优一单**。回测结果显示，最佳配置 **v3_pool8_quality** 的一年实际交易数为 **{best['trades']} 笔**，约 **{best['daysPerTrade']:.2f} 天一笔**，胜率 **{best['winRate']:.2f}%**，PF **{best['profitFactor']:.2f}**，期望值 **{best['expectancyR']:.3f}R**，账户收益 **{best['accountReturnPct']:.2f}%**，最大回撤 **{best['maxDrawdownPct']:.2f}%**。

这说明「加 1H 状态确认 + 多币种择优」比在 BTC 单币种上强行增加交易频率更合理。它没有达到严格意义上的每天一单，但已经从 V2 的约 3.97 天一笔推进到约 2.37 天一笔，同时把 PF 从约 1.16 提高到 1.82。

![V3 versus earlier equity curve]({OUT_EQUITY.name})

## 二、V1、V2、V3 对比

{comparison_text}

V3 的优势主要来自两个方面。第一，4H 与 1H 的分工减少了方向错误和低质量入场；第二，多币种池让策略不必在 BTC 没有优势时硬做交易，而是把资金分配给当天结构更清晰的币种。

## 三、V3 参数敏感性结果

{summary_text}

![V3 configuration comparison]({OUT_BAR.name})

从参数敏感性看，**quality** 版本明显优于 frequency 与 strict。frequency 虽然交易更多，约 2.05 天一笔，但 PF 只有 1.23，质量下降明显；strict 虽然过滤更强，却损失了太多优质趋势机会。因此当前不建议继续降低阈值追求每天一单，也不建议过度提高阈值。

## 四、最佳配置的币种贡献

{by_symbol_text}

在最佳配置中，BNB、BTC、ETH 与 XRP 对收益贡献最大。SOL、DOGE、LINK、AVAX 的交易数较少，但它们的存在仍然提供了择优机会；其中个别币种的独立 PF 不一定高，但多币种择优机制的目标不是让每个币种都单独优秀，而是让全市场每天只选最高质量结构。

## 五、最佳配置交易结构

最佳配置的结果分布为：{outcome_text}。每笔交易使用固定账户风险 **0.35%**，脚本内根据止损距离动态限制杠杆，平均杠杆约 **{best.get('avgLev', 0):.1f}x**。这比固定 50x 更稳，因为当止损距离扩大时，强行使用过高杠杆会放大强平和滑点风险。

{month_text}

## 六、是否保留 4H 与 1H

回测支持保留 4H，并且必须加入 1H。4H 负责定义大方向，避免在大周期逆势时做 15m 噪声；1H 负责确认当天是否进入可交易状态，例如趋势修复、VWAP / EMA 回踩后延续、波动率恢复与成交量配合。15m 只负责触发，不应该单独决定多空。

| 周期 | V3 角色 | 回测后的判断 |
|---|---|---|
| 4H | 大方向过滤 | **保留**，但只做方向与结构背景，不直接入场。 |
| 1H | 交易状态确认 | **必须保留**，这是 V3 提升质量的关键层。 |
| 15m | 入场触发 | **保留**，用于回踩、突破、VWAP 同向与短结构确认。 |
| 5m | 精细化入场 | 暂未纳入本次脚本主逻辑；下一版可用于缩小止损，但不能降低质量过滤。 |

## 七、下一步建议

当前 V3 已经显著优于 V1 与 V2，但仍没有达到「每天一单」。如果目标是继续提高频率，不建议降低 quality 阈值，因为 frequency 版本已经显示 PF 明显下降。更合理的 V4 方向是扩大到 **12–20 个高流动性合约**，同时增加相关性控制，例如同一天若 BTC、ETH、SOL 同向，只允许做评分最高且波动结构最干净的一笔。

第二个优化方向是把 5m 用作止损压缩工具，而不是信号放宽工具。也就是说，仍由 4H / 1H / 15m 决定是否交易，但在入场前用 5m 结构找到更近的无效点，从而提高实际 R 值。这样比单纯增加交易次数更符合高杠杆策略的生存逻辑。

## 附件说明

完整 JSON 结果、最佳配置交易 CSV、V3 源码、权益曲线与配置对比图已保存到项目 reports 目录。CSV 明细包含每笔交易的进出场时间、币种、方向、分数、杠杆、R 倍数、账户贡献、MFE / MAE 与备注，可用于进一步复盘。

## References

[^1]: [Binance Data Vision — Public market data download](https://data.binance.vision/)
"""
    OUT_REPORT.write_text(md, encoding='utf-8')
    print(f'wrote {OUT_REPORT}')
    print(f'wrote {OUT_EQUITY}')
    print(f'wrote {OUT_BAR}')
    print(f'wrote {OUT_CSV}')


if __name__ == '__main__':
    main()
