#!/usr/bin/env python3
"""
V6 live-cost and stress-test repricing for HTR V3/V4/V5 JSON trade details.

This script reprices historical trade details with explicit live-trading costs:
- fee bps per side, default Binance USDS-M VIP0 taker assumption
- slippage bps per side
- funding bps per 8h, conservative signed as a cost without historical funding files
- position notional inferred from fixed account risk and trade stop distance

All chart labels are in English to avoid CJK font rendering issues.
"""
from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


PROJECT = Path('/home/ubuntu/btcusdt_dashboard_v6')
REPORTS = PROJECT / 'reports'
DEFAULT_INPUT = REPORTS / 'htr_v3_multisymbol_backtest_1y.json'
DEFAULT_OUTPUT_JSON = REPORTS / 'htr_v6_live_cost_stress_results.json'
DEFAULT_OUTPUT_CSV = REPORTS / 'htr_v6_live_cost_stress_summary.csv'
DEFAULT_TRADES_CSV = REPORTS / 'htr_v6_live_cost_stress_trades.csv'
DEFAULT_CHART = REPORTS / 'htr_v6_cost_stress_account_return.png'
DEFAULT_REPORT = REPORTS / 'htr_v6_live_cost_stress_report.md'


@dataclass(frozen=True)
class Scenario:
    name: str
    fee_bps_per_side: float
    slippage_bps_per_side: float
    funding_bps_per_8h: float
    note: str


SCENARIOS: List[Scenario] = [
    Scenario('gross_no_cost', 0.0, 0.0, 0.0, 'Original gross backtest, used only as a control.'),
    Scenario('maker_low_cost', 2.0, 2.0, 0.5, 'Optimistic maker-like execution with light funding proxy.'),
    Scenario('base_taker_cost', 5.0, 3.0, 1.0, 'Conservative Binance VIP0 taker-style fee plus slippage and funding proxy.'),
    Scenario('high_slippage', 5.0, 6.0, 1.0, 'Base fee with doubled slippage.'),
    Scenario('fee_1p5x', 7.5, 3.0, 1.0, 'Fee multiplied by 1.5 while keeping base slippage/funding.'),
    Scenario('funding_3x', 5.0, 3.0, 3.0, 'Base fee/slippage with funding cost tripled.'),
    Scenario('combined_stress', 7.5, 6.0, 3.0, 'Combined adverse case: fee 1.5x, slippage 2x, funding 3x.'),
]


def safe_float(x: Any, default: float = math.nan) -> float:
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default


def max_drawdown_pct(returns_pct_points: Iterable[float]) -> float:
    equity = 1.0
    peak = 1.0
    max_dd = 0.0
    for pct in returns_pct_points:
        equity *= 1.0 + pct / 100.0
        if equity > peak:
            peak = equity
        if peak > 0:
            max_dd = max(max_dd, (peak - equity) / peak)
    return max_dd * 100.0


def profit_factor(returns_pct_points: Iterable[float]) -> float:
    vals = list(returns_pct_points)
    gross_profit = sum(x for x in vals if x > 0)
    gross_loss = -sum(x for x in vals if x < 0)
    if gross_loss <= 0:
        return math.inf if gross_profit > 0 else 0.0
    return gross_profit / gross_loss


def to_iso(ts: Any) -> str:
    try:
        return pd.to_datetime(int(ts), unit='s', utc=True).isoformat()
    except Exception:
        return ''


def iter_config_trades(data: Dict[str, Any]) -> Iterable[Tuple[str, Dict[str, Any], Dict[str, Any]]]:
    detail = data.get('detail', {})
    if not isinstance(detail, dict):
        return
    for config_name, payload in detail.items():
        if not isinstance(payload, dict):
            continue
        trades = payload.get('trades', [])
        summary = payload.get('summary', {}) or {}
        for t in trades:
            if isinstance(t, dict):
                yield config_name, summary, t


def reprice_trade(t: Dict[str, Any], scenario: Scenario, risk_per_trade: float, config_name: str) -> Dict[str, Any]:
    gross_r = safe_float(t.get('r'), 0.0)
    gross_account_pct = safe_float(t.get('accountPct'), gross_r * risk_per_trade * 100.0)
    risk_pct = safe_float(t.get('riskPct'))
    leverage_hint = safe_float(t.get('leverage'))
    if not np.isfinite(risk_pct) or risk_pct <= 0:
        notional_to_equity = leverage_hint if np.isfinite(leverage_hint) and leverage_hint > 0 else 1.0
    else:
        notional_to_equity = risk_per_trade / risk_pct
        if np.isfinite(leverage_hint) and leverage_hint > 0:
            # Do not exceed explicit leverage cap/hint if provided by the backtest engine.
            notional_to_equity = min(notional_to_equity, leverage_hint)
    entry_time = safe_float(t.get('time'), math.nan)
    exit_time = safe_float(t.get('exitTime'), entry_time)
    holding_hours = max(0.0, (exit_time - entry_time) / 3600.0) if np.isfinite(entry_time) and np.isfinite(exit_time) else 0.0
    funding_intervals = holding_hours / 8.0

    fee_notional_pct = 2.0 * scenario.fee_bps_per_side / 10000.0
    slippage_notional_pct = 2.0 * scenario.slippage_bps_per_side / 10000.0
    funding_notional_pct = funding_intervals * scenario.funding_bps_per_8h / 10000.0
    total_cost_account_pct = (fee_notional_pct + slippage_notional_pct + funding_notional_pct) * notional_to_equity * 100.0
    fee_account_pct = fee_notional_pct * notional_to_equity * 100.0
    slippage_account_pct = slippage_notional_pct * notional_to_equity * 100.0
    funding_account_pct = funding_notional_pct * notional_to_equity * 100.0

    net_account_pct = gross_account_pct - total_cost_account_pct
    net_r = net_account_pct / (risk_per_trade * 100.0) if risk_per_trade > 0 else math.nan

    return {
        'config': config_name,
        'scenario': scenario.name,
        'symbol': t.get('symbol', ''),
        'dir': t.get('dir', ''),
        'entry_time': int(entry_time) if np.isfinite(entry_time) else None,
        'exit_time': int(exit_time) if np.isfinite(exit_time) else None,
        'entry_time_iso': to_iso(t.get('time')),
        'exit_time_iso': to_iso(t.get('exitTime')),
        'holding_hours': holding_hours,
        'gross_r': gross_r,
        'net_r': net_r,
        'gross_account_pct': gross_account_pct,
        'net_account_pct': net_account_pct,
        'cost_account_pct': total_cost_account_pct,
        'fee_account_pct': fee_account_pct,
        'slippage_account_pct': slippage_account_pct,
        'funding_account_pct': funding_account_pct,
        'risk_pct_price': risk_pct * 100.0 if np.isfinite(risk_pct) else math.nan,
        'notional_to_equity': notional_to_equity,
        'leverage_hint': leverage_hint,
        'outcome': t.get('outcome', ''),
        'score': safe_float(t.get('score'), math.nan),
        'regime': t.get('regime', ''),
    }


def summarize(group: pd.DataFrame, scenario: Scenario, source_summary: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    source_summary = source_summary or {}
    vals = group['net_account_pct'].astype(float).tolist()
    gross_vals = group['gross_account_pct'].astype(float).tolist()
    trades = len(vals)
    wins = int((group['net_account_pct'] > 0).sum())
    losses = int((group['net_account_pct'] < 0).sum())
    total_return = float(np.sum(vals))
    gross_return = float(np.sum(gross_vals))
    return {
        'config': str(group['config'].iloc[0]),
        'scenario': scenario.name,
        'trades': trades,
        'wins': wins,
        'losses': losses,
        'win_rate_pct': wins / trades * 100.0 if trades else 0.0,
        'profit_factor': profit_factor(vals),
        'expectancy_r': float(group['net_r'].mean()) if trades else 0.0,
        'total_r': float(group['net_r'].sum()) if trades else 0.0,
        'gross_account_return_pct': gross_return,
        'net_account_return_pct': total_return,
        'cost_drag_pct_points': gross_return - total_return,
        'avg_cost_account_pct': float(group['cost_account_pct'].mean()) if trades else 0.0,
        'avg_fee_account_pct': float(group['fee_account_pct'].mean()) if trades else 0.0,
        'avg_slippage_account_pct': float(group['slippage_account_pct'].mean()) if trades else 0.0,
        'avg_funding_account_pct': float(group['funding_account_pct'].mean()) if trades else 0.0,
        'max_drawdown_pct': max_drawdown_pct(vals),
        'avg_holding_hours': float(group['holding_hours'].mean()) if trades else 0.0,
        'avg_notional_to_equity': float(group['notional_to_equity'].mean()) if trades else 0.0,
        'source_win_rate_pct': safe_float(source_summary.get('winRate'), math.nan),
        'source_profit_factor': safe_float(source_summary.get('profitFactor'), math.nan),
        'source_account_return_pct': safe_float(source_summary.get('accountReturnPct'), math.nan),
        'source_max_drawdown_pct': safe_float(source_summary.get('maxDrawdownPct'), math.nan),
        'fee_bps_per_side': scenario.fee_bps_per_side,
        'slippage_bps_per_side': scenario.slippage_bps_per_side,
        'funding_bps_per_8h': scenario.funding_bps_per_8h,
        'scenario_note': scenario.note,
    }


def make_chart(summary_df: pd.DataFrame, chart_path: Path, focus_config: str) -> None:
    focus = summary_df[summary_df['config'] == focus_config].copy()
    if focus.empty:
        focus = summary_df.copy()
    order = [s.name for s in SCENARIOS if s.name in set(focus['scenario'])]
    focus['scenario'] = pd.Categorical(focus['scenario'], categories=order, ordered=True)
    focus = focus.sort_values('scenario')
    plt.style.use('seaborn-v0_8-whitegrid')
    fig, ax = plt.subplots(figsize=(11, 5.5))
    colors = ['#64748b', '#2563eb', '#16a34a', '#f59e0b', '#f97316', '#a855f7', '#dc2626']
    ax.bar(focus['scenario'].astype(str), focus['net_account_return_pct'], color=colors[:len(focus)])
    ax.axhline(0, color='#111827', linewidth=1)
    ax.set_title(f'V6 Cost Stress: Account Return ({focus_config})')
    ax.set_xlabel('Scenario')
    ax.set_ylabel('Account Return (%)')
    ax.tick_params(axis='x', rotation=35)
    for idx, row in enumerate(focus.itertuples(index=False)):
        ax.text(idx, row.net_account_return_pct, f'{row.net_account_return_pct:.2f}%', ha='center', va='bottom' if row.net_account_return_pct >= 0 else 'top', fontsize=9)
    fig.tight_layout()
    fig.savefig(chart_path, dpi=180)
    plt.close(fig)


def markdown_table(df: pd.DataFrame, cols: List[str], n: Optional[int] = None) -> str:
    view = df[cols].copy()
    if n is not None:
        view = view.head(n)
    for col in view.columns:
        if pd.api.types.is_float_dtype(view[col]):
            view[col] = view[col].map(lambda x: 'inf' if math.isinf(x) else f'{x:.2f}')
    return view.to_markdown(index=False)


def write_report(data: Dict[str, Any], summary_df: pd.DataFrame, report_path: Path, chart_path: Path, focus_config: str) -> None:
    focus = summary_df[summary_df['config'] == focus_config].copy()
    base = focus[focus['scenario'] == 'base_taker_cost']
    combined = focus[focus['scenario'] == 'combined_stress']
    gross = focus[focus['scenario'] == 'gross_no_cost']
    def one(df: pd.DataFrame, col: str) -> float:
        return float(df[col].iloc[0]) if not df.empty else math.nan

    all_base = summary_df[summary_df['scenario'] == 'base_taker_cost'].copy()
    all_base = all_base.sort_values(['net_account_return_pct', 'profit_factor'], ascending=False)
    focus_cols = ['scenario', 'trades', 'win_rate_pct', 'profit_factor', 'net_account_return_pct', 'cost_drag_pct_points', 'max_drawdown_pct', 'avg_cost_account_pct', 'avg_holding_hours']
    config_cols = ['config', 'trades', 'win_rate_pct', 'profit_factor', 'net_account_return_pct', 'cost_drag_pct_points', 'max_drawdown_pct']

    text = f"""# V6 Live-Cost Stress Test Report

本报告基于 `htr_v3_multisymbol_backtest_1y.json` 中的逐笔交易明细，对原始 HTR V3 回测结果做**实盘成本复算**。复算逻辑并不重新优化参数，而是用相同信号与出场记录叠加手续费、滑点与资金费率代理成本，因此更适合评估策略从理想回测走向纸交易前的可信度缺口。

> 关键结论：以 `{focus_config}` 为 V3 基准配置时，原始总账户收益为 **{one(gross, 'net_account_return_pct'):.2f}%**；纳入 base taker 成本后降至 **{one(base, 'net_account_return_pct'):.2f}%**，胜率为 **{one(base, 'win_rate_pct'):.2f}%**，PF 为 **{one(base, 'profit_factor'):.2f}**，最大回撤为 **{one(base, 'max_drawdown_pct'):.2f}%**。在 combined stress 场景下，账户收益为 **{one(combined, 'net_account_return_pct'):.2f}%**。

## Cost Model

| Component | Base Assumption | Conservative Interpretation |
|---|---:|---|
| Fee | 5 bps per side | Binance USDS-M VIP0 taker-style proxy; maker case is separately listed. |
| Slippage | 3 bps per side | Applied to both entry and exit, independent of direction. |
| Funding | 1 bps per 8h | Historical funding files are not yet loaded, so this version treats funding as a conservative cost proxy. |
| Position Size | `riskPerTrade / riskPct` | Notional-to-equity is inferred from fixed account risk and stop distance, capped by leverage hint when present. |

## Focus Configuration Stress Table

{markdown_table(focus, focus_cols)}

## Base-Cost Ranking Across Configurations

{markdown_table(all_base, config_cols)}

## Interpretation

V6 的主要发现是：HTR 的毛利空间对成本具有显著敏感性，尤其是止损距离较窄、名义仓位倍数较高的交易，双边 taker 手续费与滑点会明显压缩原有 R 值。`base_taker_cost` 是纸交易前更应关注的主口径，因为它不依赖过度乐观的挂单成交假设。若策略在该口径下仍能保持 PF 大于 1、回撤可控，并在样本外验证中保持稳定，才有资格进入纸交易阶段。

`funding_3x` 与 `combined_stress` 并不是对真实历史 funding 的替代，而是**缺数据状态下的保守压力代理**。下一阶段应从 Binance Data Vision 补齐 `fundingRate` 历史文件，并按 `symbol/time/dir` 对每笔持仓期间的实际资金费率逐条累加。届时 long/short 的 funding 可能为正也可能为负，结果会比当前“全部视为成本”的版本更贴近真实。

## Generated Files

| File | Purpose |
|---|---|
| `{DEFAULT_OUTPUT_JSON.name}` | Full V6 scenario summary and metadata. |
| `{DEFAULT_OUTPUT_CSV.name}` | Tabular scenario summary for spreadsheet review. |
| `{DEFAULT_TRADES_CSV.name}` | Trade-level cost repricing records. |
| `{chart_path.name}` | English-label chart for account return under cost stress. |

![V6 Cost Stress Account Return]({chart_path.name})
"""
    report_path.write_text(text, encoding='utf-8')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', type=Path, default=DEFAULT_INPUT)
    ap.add_argument('--focus-config', default='v3_pool8_quality')
    args = ap.parse_args()

    data = json.loads(args.input.read_text(encoding='utf-8'))
    risk_per_trade = float(data.get('riskPerTrade', 0.0035))

    summary_lookup: Dict[str, Dict[str, Any]] = {}
    detail = data.get('detail', {})
    for cfg, payload in detail.items():
        if isinstance(payload, dict):
            summary_lookup[cfg] = payload.get('summary', {}) or {}

    trade_records: List[Dict[str, Any]] = []
    for config_name, _, t in iter_config_trades(data):
        for scenario in SCENARIOS:
            trade_records.append(reprice_trade(t, scenario, risk_per_trade, config_name))
    trades_df = pd.DataFrame(trade_records)
    trades_df.to_csv(DEFAULT_TRADES_CSV, index=False)

    summaries: List[Dict[str, Any]] = []
    for (config_name, scenario_name), group in trades_df.groupby(['config', 'scenario'], sort=False):
        scenario = next(s for s in SCENARIOS if s.name == scenario_name)
        summaries.append(summarize(group.sort_values('entry_time'), scenario, summary_lookup.get(config_name)))
    summary_df = pd.DataFrame(summaries)
    # Stable ordering: original scenario order, then configs.
    scenario_order = {s.name: i for i, s in enumerate(SCENARIOS)}
    summary_df['scenario_order'] = summary_df['scenario'].map(scenario_order)
    summary_df = summary_df.sort_values(['config', 'scenario_order']).drop(columns=['scenario_order'])
    summary_df.to_csv(DEFAULT_OUTPUT_CSV, index=False)

    output = {
        'source_file': str(args.input),
        'risk_per_trade': risk_per_trade,
        'generated_at_utc': pd.Timestamp.utcnow().isoformat(),
        'cost_model': [asdict(s) for s in SCENARIOS],
        'summary': summary_df.to_dict(orient='records'),
        'notes': [
            'Funding is a conservative fixed proxy until historical Binance fundingRate files are downloaded and joined.',
            'Costs are subtracted from account PnL based on notional-to-equity inferred from stop distance and account risk.',
            'This script reprices existing trades; it does not re-simulate intrabar execution sequence.',
        ],
    }
    DEFAULT_OUTPUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')

    make_chart(summary_df, DEFAULT_CHART, args.focus_config)
    write_report(data, summary_df, DEFAULT_REPORT, DEFAULT_CHART, args.focus_config)

    focus_base = summary_df[(summary_df['config'] == args.focus_config) & (summary_df['scenario'] == 'base_taker_cost')]
    if not focus_base.empty:
        row = focus_base.iloc[0]
        print(f"{args.focus_config} base_taker_cost: trades={int(row.trades)}, win={row.win_rate_pct:.2f}%, PF={row.profit_factor:.2f}, return={row.net_account_return_pct:.2f}%, maxDD={row.max_drawdown_pct:.2f}%")
    print(f'Wrote: {DEFAULT_OUTPUT_JSON}')
    print(f'Wrote: {DEFAULT_OUTPUT_CSV}')
    print(f'Wrote: {DEFAULT_TRADES_CSV}')
    print(f'Wrote: {DEFAULT_CHART}')
    print(f'Wrote: {DEFAULT_REPORT}')


if __name__ == '__main__':
    main()
