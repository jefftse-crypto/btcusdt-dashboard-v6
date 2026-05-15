#!/usr/bin/env python3
"""
V6 out-of-sample and rolling validation based on repriced trade-level records.

The script uses trade details that were already repriced by build_v6_live_cost_stress.py.
It evaluates:
- fixed 8+4 month split: 2025-05 to 2025-12 as train, 2026-01 to 2026-04 as OOS
- train-selected configuration under base taker costs
- fixed V3 benchmark configuration v3_pool8_quality
- monthly stability and rolling 3-month return/PF windows

All chart labels are in English.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable, List, Dict, Any, Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


PROJECT = Path('/home/ubuntu/btcusdt_dashboard_v6')
REPORTS = PROJECT / 'reports'
TRADE_CSV = REPORTS / 'htr_v6_live_cost_stress_trades.csv'
SUMMARY_CSV = REPORTS / 'htr_v6_oos_validation_summary.csv'
MONTHLY_CSV = REPORTS / 'htr_v6_oos_monthly_metrics.csv'
ROLLING_CSV = REPORTS / 'htr_v6_oos_rolling_3m_metrics.csv'
OUTPUT_JSON = REPORTS / 'htr_v6_oos_validation_results.json'
CHART_MONTHLY = REPORTS / 'htr_v6_oos_monthly_return.png'
CHART_TRAIN_OOS = REPORTS / 'htr_v6_train_oos_return_pf.png'
REPORT_MD = REPORTS / 'htr_v6_oos_validation_report.md'

FOCUS_CONFIG = 'v3_pool8_quality'
SCENARIO = 'base_taker_cost'
TRAIN_START = pd.Timestamp('2025-05-01', tz='UTC')
OOS_START = pd.Timestamp('2026-01-01', tz='UTC')
OOS_END_EXCLUSIVE = pd.Timestamp('2026-05-01', tz='UTC')


def profit_factor(vals: Iterable[float]) -> float:
    xs = list(vals)
    gp = sum(x for x in xs if x > 0)
    gl = -sum(x for x in xs if x < 0)
    if gl <= 0:
        return math.inf if gp > 0 else 0.0
    return gp / gl


def max_drawdown_pct(vals: Iterable[float]) -> float:
    equity = 1.0
    peak = 1.0
    max_dd = 0.0
    for pct in vals:
        equity *= 1.0 + pct / 100.0
        peak = max(peak, equity)
        if peak > 0:
            max_dd = max(max_dd, (peak - equity) / peak)
    return max_dd * 100.0


def summarize(df: pd.DataFrame, label: str) -> Dict[str, Any]:
    vals = df['net_account_pct'].astype(float).tolist()
    n = len(vals)
    return {
        'period': label,
        'trades': n,
        'wins': int((df['net_account_pct'] > 0).sum()),
        'losses': int((df['net_account_pct'] < 0).sum()),
        'win_rate_pct': float((df['net_account_pct'] > 0).mean() * 100.0) if n else 0.0,
        'profit_factor': profit_factor(vals),
        'net_account_return_pct': float(np.sum(vals)) if n else 0.0,
        'expectancy_r': float(df['net_r'].mean()) if n else 0.0,
        'max_drawdown_pct': max_drawdown_pct(vals),
        'avg_cost_account_pct': float(df['cost_account_pct'].mean()) if n else 0.0,
        'avg_holding_hours': float(df['holding_hours'].mean()) if n else 0.0,
    }


def safe_fmt(x: float) -> str:
    if isinstance(x, float) and math.isinf(x):
        return 'inf'
    return f'{x:.2f}'


def md_table(df: pd.DataFrame, cols: List[str]) -> str:
    view = df[cols].copy()
    for col in view.columns:
        if pd.api.types.is_float_dtype(view[col]):
            view[col] = view[col].map(safe_fmt)
    return view.to_markdown(index=False)


def compute_monthly(df: pd.DataFrame, config: str) -> pd.DataFrame:
    rows = []
    focus = df[df['config'] == config].copy()
    focus['month'] = focus['entry_dt'].dt.strftime('%Y-%m')
    for month, g in focus.groupby('month', sort=True):
        s = summarize(g.sort_values('entry_dt'), month)
        s['config'] = config
        rows.append(s)
    return pd.DataFrame(rows)


def compute_rolling_3m(monthly: pd.DataFrame, config: str) -> pd.DataFrame:
    rows = []
    months = monthly['period'].tolist()
    for i in range(2, len(months)):
        window_months = months[i-2:i+1]
        # Monthly aggregation has enough for return and approximate PF not exact; exact values are recomputed in main from trades.
        rows.append({'config': config, 'window': f'{window_months[0]}..{window_months[-1]}', 'months': ','.join(window_months)})
    return pd.DataFrame(rows)


def plot_monthly(monthly: pd.DataFrame, chart_path: Path, config: str) -> None:
    plt.style.use('seaborn-v0_8-whitegrid')
    fig, ax = plt.subplots(figsize=(11, 5.5))
    colors = ['#2563eb' if m < '2026-01' else '#16a34a' for m in monthly['period']]
    ax.bar(monthly['period'], monthly['net_account_return_pct'], color=colors)
    ax.axhline(0, color='#111827', linewidth=1)
    ax.axvline(7.5, color='#dc2626', linestyle='--', linewidth=1, label='OOS Start')
    ax.set_title(f'V6 Monthly Net Return ({config}, Base Taker Cost)')
    ax.set_xlabel('Month')
    ax.set_ylabel('Net Account Return (%)')
    ax.legend()
    ax.tick_params(axis='x', rotation=35)
    for idx, row in enumerate(monthly.itertuples(index=False)):
        ax.text(idx, row.net_account_return_pct, f'{row.net_account_return_pct:.1f}%', ha='center', va='bottom' if row.net_account_return_pct >= 0 else 'top', fontsize=8)
    fig.tight_layout()
    fig.savefig(chart_path, dpi=180)
    plt.close(fig)


def plot_train_oos(summary: pd.DataFrame, chart_path: Path, configs: List[str]) -> None:
    subset = summary[(summary['config'].isin(configs)) & (summary['period'].isin(['train_2025_05_to_12', 'oos_2026_01_to_04']))].copy()
    period_order = {'train_2025_05_to_12': 0, 'oos_2026_01_to_04': 1}
    config_order = {cfg: i for i, cfg in enumerate(configs)}
    subset['period_order'] = subset['period'].map(period_order)
    subset['config_order'] = subset['config'].map(config_order)
    subset = subset.sort_values(['config_order', 'period_order']).drop(columns=['period_order', 'config_order'])
    subset['label'] = subset['config'] + ' / ' + subset['period'].str.replace('_', ' ')
    x = np.arange(len(subset))
    plt.style.use('seaborn-v0_8-whitegrid')
    fig, ax1 = plt.subplots(figsize=(12, 5.8))
    bars = ax1.bar(x, subset['net_account_return_pct'], color=['#2563eb' if 'train' in p else '#16a34a' for p in subset['period']])
    ax1.axhline(0, color='#111827', linewidth=1)
    ax1.set_ylabel('Net Account Return (%)')
    ax1.set_xticks(x)
    ax1.set_xticklabels(subset['label'], rotation=25, ha='right')
    ax2 = ax1.twinx()
    ax2.plot(x, subset['profit_factor'], color='#dc2626', marker='o', linewidth=2, label='Profit Factor')
    ax2.set_ylabel('Profit Factor')
    ax1.set_title('V6 Train vs OOS Return and Profit Factor')
    for bar, val in zip(bars, subset['net_account_return_pct']):
        ax1.text(bar.get_x() + bar.get_width()/2, val, f'{val:.2f}%', ha='center', va='bottom' if val >= 0 else 'top', fontsize=8)
    fig.tight_layout()
    fig.savefig(chart_path, dpi=180)
    plt.close(fig)


def main() -> None:
    df = pd.read_csv(TRADE_CSV)
    df = df[df['scenario'] == SCENARIO].copy()
    df['entry_dt'] = pd.to_datetime(df['entry_time'], unit='s', utc=True)
    df = df[(df['entry_dt'] >= TRAIN_START) & (df['entry_dt'] < OOS_END_EXCLUSIVE)].copy()

    train = df[(df['entry_dt'] >= TRAIN_START) & (df['entry_dt'] < OOS_START)]
    train_rank = []
    for cfg, g in train.groupby('config'):
        s = summarize(g.sort_values('entry_dt'), 'train_2025_05_to_12')
        s['config'] = cfg
        train_rank.append(s)
    train_rank_df = pd.DataFrame(train_rank).sort_values(['net_account_return_pct', 'profit_factor'], ascending=False)
    selected_config = str(train_rank_df.iloc[0]['config']) if not train_rank_df.empty else FOCUS_CONFIG

    configs = sorted(set([FOCUS_CONFIG, selected_config]))
    rows = []
    for cfg in configs:
        cfg_df = df[df['config'] == cfg].copy().sort_values('entry_dt')
        periods = {
            'full_2025_05_to_2026_04': cfg_df,
            'train_2025_05_to_12': cfg_df[(cfg_df['entry_dt'] >= TRAIN_START) & (cfg_df['entry_dt'] < OOS_START)],
            'oos_2026_01_to_04': cfg_df[(cfg_df['entry_dt'] >= OOS_START) & (cfg_df['entry_dt'] < OOS_END_EXCLUSIVE)],
        }
        for label, part in periods.items():
            s = summarize(part, label)
            s['config'] = cfg
            rows.append(s)
    summary = pd.DataFrame(rows).sort_values(['config', 'period'])
    summary.to_csv(SUMMARY_CSV, index=False)

    monthly = compute_monthly(df, FOCUS_CONFIG)
    monthly.to_csv(MONTHLY_CSV, index=False)

    # Exact rolling 3-month windows from trades.
    roll_rows = []
    months = sorted(df[df['config'] == FOCUS_CONFIG]['entry_dt'].dt.strftime('%Y-%m').unique().tolist())
    focus_trades = df[df['config'] == FOCUS_CONFIG].copy()
    focus_trades['month'] = focus_trades['entry_dt'].dt.strftime('%Y-%m')
    for i in range(2, len(months)):
        win = months[i-2:i+1]
        part = focus_trades[focus_trades['month'].isin(win)].sort_values('entry_dt')
        s = summarize(part, f'{win[0]}..{win[-1]}')
        s['config'] = FOCUS_CONFIG
        roll_rows.append(s)
    rolling = pd.DataFrame(roll_rows)
    rolling.to_csv(ROLLING_CSV, index=False)

    plot_monthly(monthly, CHART_MONTHLY, FOCUS_CONFIG)
    plot_train_oos(summary, CHART_TRAIN_OOS, configs)

    output = {
        'scenario': SCENARIO,
        'train_start_utc': TRAIN_START.isoformat(),
        'oos_start_utc': OOS_START.isoformat(),
        'oos_end_exclusive_utc': OOS_END_EXCLUSIVE.isoformat(),
        'focus_config': FOCUS_CONFIG,
        'train_selected_config': selected_config,
        'summary': summary.to_dict(orient='records'),
        'train_ranking': train_rank_df.to_dict(orient='records'),
        'monthly_focus': monthly.to_dict(orient='records'),
        'rolling_3m_focus': rolling.to_dict(orient='records'),
    }
    OUTPUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')

    focus_summary = summary[summary['config'] == FOCUS_CONFIG]
    selected_summary = summary[summary['config'] == selected_config]
    focus_oos = focus_summary[focus_summary['period'] == 'oos_2026_01_to_04'].iloc[0]
    selected_oos = selected_summary[selected_summary['period'] == 'oos_2026_01_to_04'].iloc[0]

    text = f"""# V6 Out-of-Sample Validation Report

本报告将 2025-05 至 2026-04 的真实 Binance 15m K 线回测交易记录固定分割为**前 8 个月训练段**与**后 4 个月样本外段**。为了避免继续追逐回测数字，本阶段只使用上一阶段已经产生的 `base_taker_cost` 成本口径，即双边 taker 风格手续费、双边滑点与保守 funding 代理均已扣除。

> 关键结论：V3 基准配置 `{FOCUS_CONFIG}` 在样本外 2026-01 至 2026-04 录得 **{focus_oos['net_account_return_pct']:.2f}%** 净账户收益，PF 为 **{focus_oos['profit_factor']:.2f}**，胜率为 **{focus_oos['win_rate_pct']:.2f}%**，最大回撤为 **{focus_oos['max_drawdown_pct']:.2f}%**。若仅按训练段表现选参，最佳训练配置为 `{selected_config}`，其样本外收益为 **{selected_oos['net_account_return_pct']:.2f}%**，PF 为 **{selected_oos['profit_factor']:.2f}**。

## Validation Design

| Item | Setting |
|---|---|
| Cost scenario | `{SCENARIO}` |
| Train period | 2025-05-01 to 2025-12-31 UTC |
| OOS period | 2026-01-01 to 2026-04-30 UTC |
| Fixed benchmark | `{FOCUS_CONFIG}` |
| Train-selected config | `{selected_config}` |
| Selection rule | Highest train net account return, PF as secondary check |

## Train vs OOS Summary

{md_table(summary, ['config', 'period', 'trades', 'win_rate_pct', 'profit_factor', 'net_account_return_pct', 'max_drawdown_pct', 'avg_cost_account_pct'])}

## Monthly Stability for Fixed V3 Benchmark

{md_table(monthly, ['period', 'trades', 'win_rate_pct', 'profit_factor', 'net_account_return_pct', 'max_drawdown_pct'])}

## Rolling 3-Month Robustness for Fixed V3 Benchmark

{md_table(rolling, ['period', 'trades', 'win_rate_pct', 'profit_factor', 'net_account_return_pct', 'max_drawdown_pct'])}

## Interpretation

严格样本外口径说明，`{FOCUS_CONFIG}` 在扣除实盘代理成本后仍未彻底失效，但安全边际明显低于 V3 毛回测。若 OOS 收益主要由少数月份贡献，纸交易阶段必须特别关注信号频率、成交质量与连续亏损窗口。相较于继续调高胜率，V6 更应优先解决三件事：补齐真实 fundingRate 数据、记录真实挂单/吃单比例，以及用纸交易日志验证信号出现后是否能以回测假设价格成交。

![V6 Monthly Net Return]({CHART_MONTHLY.name})

![V6 Train OOS Return PF]({CHART_TRAIN_OOS.name})

## Generated Files

| File | Purpose |
|---|---|
| `{SUMMARY_CSV.name}` | Train/OOS summary for fixed benchmark and train-selected config. |
| `{MONTHLY_CSV.name}` | Monthly stability metrics for `{FOCUS_CONFIG}`. |
| `{ROLLING_CSV.name}` | Rolling 3-month robustness metrics. |
| `{OUTPUT_JSON.name}` | Structured validation output. |
| `{CHART_MONTHLY.name}` | Monthly English-label chart. |
| `{CHART_TRAIN_OOS.name}` | Train/OOS return and PF chart. |
"""
    REPORT_MD.write_text(text, encoding='utf-8')

    print(f'Focus OOS: config={FOCUS_CONFIG}, return={focus_oos["net_account_return_pct"]:.2f}%, PF={focus_oos["profit_factor"]:.2f}, win={focus_oos["win_rate_pct"]:.2f}%')
    print(f'Train-selected config: {selected_config}; OOS return={selected_oos["net_account_return_pct"]:.2f}%, PF={selected_oos["profit_factor"]:.2f}')
    print(f'Wrote: {SUMMARY_CSV}')
    print(f'Wrote: {MONTHLY_CSV}')
    print(f'Wrote: {ROLLING_CSV}')
    print(f'Wrote: {OUTPUT_JSON}')
    print(f'Wrote: {CHART_MONTHLY}')
    print(f'Wrote: {CHART_TRAIN_OOS}')
    print(f'Wrote: {REPORT_MD}')


if __name__ == '__main__':
    main()
