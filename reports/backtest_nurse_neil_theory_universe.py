#!/usr/bin/env python3
"""
Nurse Neil theory backtest across the existing V6 multi-symbol universe.

This script does NOT replay posted calls. It turns the supplied theory into a
mechanical long-only scanner and replays all historical opportunities found in
existing Binance USD-M 15m data, resampled to 4H bars.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path('/home/ubuntu/btcusdt_dashboard_v6')
DATA_DIR = ROOT / 'data' / 'binance_um_15m_1y_multi'
OUT_DIR = ROOT / 'reports'
OUT_DIR.mkdir(parents=True, exist_ok=True)

FEE_BPS_PER_SIDE = 5.0
SLIPPAGE_BPS_PER_SIDE_BASE = 5.0
SLIPPAGE_BPS_PER_SIDE_STRESS = 15.0
MAX_HOLD_BARS_4H = 42  # 7 days
MIN_BARS_BETWEEN_SIGNALS = 12  # avoid clustered duplicate signals
TP_WEIGHTS = [0.30, 0.30, 0.25, 0.15]
TP_R_MULTIPLES = [1.5, 2.5, 4.0, 6.0]

LIQUIDITY_SCORE = {
    'BTCUSDT': 10, 'ETHUSDT': 10, 'BNBUSDT': 9, 'SOLUSDT': 9, 'XRPUSDT': 9,
    'DOGEUSDT': 8, 'LINKUSDT': 8, 'AVAXUSDT': 8,
}
VOLATILITY_BASE = {
    'BTCUSDT': 15, 'ETHUSDT': 14, 'BNBUSDT': 13, 'SOLUSDT': 12, 'XRPUSDT': 14,
    'DOGEUSDT': 11, 'LINKUSDT': 12, 'AVAXUSDT': 11,
}

@dataclass
class Trade:
    symbol: str
    entry_time: str
    exit_time: str
    entry: float
    stop: float
    final_exit_price: float
    score: float
    structure_score: float
    rr_score: float
    stop_score: float
    liquidity_score: float
    slippage_score: float
    volatility_score: float
    weighted_rr: float
    risk_pct: float
    tp_hits: int
    exit_reason: str
    gross_r: float
    net_notional_return_pct: float
    account_risk_pct: float
    account_return_pct: float
    btc_filter_pass: bool


def load_symbol_15m(symbol: str) -> pd.DataFrame:
    files = sorted((DATA_DIR / symbol).glob('*.csv'))
    if not files:
        raise FileNotFoundError(symbol)
    parts = []
    for f in files:
        df = pd.read_csv(f)
        parts.append(df)
    df = pd.concat(parts, ignore_index=True)
    df['timestamp'] = pd.to_datetime(df['open_time'], unit='ms', utc=True)
    for col in ['open', 'high', 'low', 'close', 'volume', 'quote_volume']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df = df.dropna(subset=['open', 'high', 'low', 'close']).drop_duplicates('timestamp')
    df = df.set_index('timestamp').sort_index()
    return df[['open','high','low','close','volume','quote_volume']]


def to_4h(df15: pd.DataFrame) -> pd.DataFrame:
    df = df15.resample('4h', label='right', closed='right').agg({
        'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last',
        'volume': 'sum', 'quote_volume': 'sum'
    }).dropna()
    return df


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out['ema20'] = out['close'].ewm(span=20, adjust=False).mean()
    out['ema50'] = out['close'].ewm(span=50, adjust=False).mean()
    out['ema200'] = out['close'].ewm(span=200, adjust=False).mean()
    high_low = out['high'] - out['low']
    high_close = (out['high'] - out['close'].shift()).abs()
    low_close = (out['low'] - out['close'].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    out['atr14'] = tr.rolling(14).mean()
    out['prior_high_20'] = out['high'].shift(1).rolling(20).max()
    out['prior_low_20'] = out['low'].shift(1).rolling(20).min()
    out['prior_high_10'] = out['high'].shift(1).rolling(10).max()
    out['prior_low_10'] = out['low'].shift(1).rolling(10).min()
    out['rolling_max_60'] = out['close'].shift(1).rolling(60).max()
    out['rolling_min_60'] = out['close'].shift(1).rolling(60).min()
    out['ret_3'] = out['close'].pct_change(3)
    out['ret_12'] = out['close'].pct_change(12)
    out['ema20_slope'] = out['ema20'].pct_change(3)
    out['atr_pct'] = out['atr14'] / out['close']
    return out


def btc_filter(btc: pd.DataFrame) -> pd.Series:
    # Supplied theory says do not long alts when BTC 4H clearly breaks down.
    # Mechanical proxy: BTC close must be above EMA50 or not more than 1.5% below it,
    # and the last 3 bars must not have a sharp negative impulse below EMA200.
    filt = ((btc['close'] >= btc['ema50'] * 0.985) | (btc['ema20_slope'] > 0)) & ~(
        (btc['close'] < btc['ema200']) & (btc['ret_3'] < -0.035)
    )
    return filt.rename('btc_filter_pass')


def rr_to_score(rr: float) -> int:
    if rr < 1.0:
        return 0
    if rr < 1.5:
        return 8
    if rr < 2.0:
        return 12
    if rr < 3.0:
        return 17
    if rr < 5.0:
        return 22
    return 25


def risk_to_account(score: float) -> float:
    if score >= 90:
        return 1.0
    if score >= 80:
        return 0.75
    if score >= 70:
        return 0.50
    if score >= 60:
        return 0.25
    return 0.0


def calc_signal_score(row: pd.Series, symbol: str, entry: float, stop: float, tps: List[float], btc_ok: bool) -> Dict[str, float]:
    # Structure score, max 25, based on supplied dimensions.
    structure = 0
    if entry > row['prior_high_20']:
        structure += 8  # breakout / trendline break proxy
    if row['low'] <= row['prior_high_20'] * 1.012 and entry > row['prior_high_20']:
        structure += 7  # SR flip / retest proxy
    if entry > row['ema20'] and entry > row['ema50']:
        structure += 4  # important MA confirmation
    if row['prior_low_10'] > row['prior_low_20'] or row['ema20_slope'] > 0:
        structure += 4  # higher low / structure turning up
    if row['ret_3'] > -0.025:
        structure += 2  # not a pure falling knife
    structure = min(structure, 25)

    risk = max(entry - stop, 1e-12)
    rr_values = [(tp - entry) / risk for tp in tps]
    weighted_rr = sum(w * rr for w, rr in zip(TP_WEIGHTS, rr_values))
    rr_score = rr_to_score(weighted_rr)

    # Stop reasonableness: ATR-based stop below reclaimed support/EMA zone.
    stop_score = 15
    if stop >= min(row['prior_high_20'], row['ema20']) * 0.995:
        stop_score = 12
    if (entry - stop) / entry > 0.06:
        stop_score = min(stop_score, 8)
    if (entry - stop) / entry > 0.10:
        stop_score = min(stop_score, 4)

    liquidity = LIQUIDITY_SCORE.get(symbol, 6)
    # Slippage risk: penalize large entry impulse, high ATR, and lower liquidity.
    slippage = 10
    if row['ret_3'] > 0.055:
        slippage -= 4
    elif row['ret_3'] > 0.035:
        slippage -= 2
    if row['atr_pct'] > 0.045:
        slippage -= 2
    if liquidity <= 8:
        slippage -= 1
    slippage = max(0, min(10, slippage))

    volatility = VOLATILITY_BASE.get(symbol, 9)
    if row['atr_pct'] > 0.05:
        volatility -= 4
    elif row['atr_pct'] > 0.035:
        volatility -= 2
    if not btc_ok:
        volatility -= 5
    volatility = max(0, min(15, volatility))

    score = structure + rr_score + stop_score + liquidity + slippage + volatility
    return {
        'structure_score': float(structure), 'rr_score': float(rr_score), 'stop_score': float(stop_score),
        'liquidity_score': float(liquidity), 'slippage_score': float(slippage), 'volatility_score': float(volatility),
        'score': float(score), 'weighted_rr': float(weighted_rr), 'risk_pct': float((entry - stop) / entry * 100)
    }


def find_signals(df: pd.DataFrame, symbol: str, btc_ok: pd.Series) -> List[Tuple[pd.Timestamp, Dict[str, float], List[float]]]:
    signals = []
    last_i = -10**9
    joined = df.join(btc_ok, how='left')
    joined['btc_filter_pass'] = joined['btc_filter_pass'].ffill().fillna(False)
    for i in range(220, len(joined) - 2):
        if i - last_i < MIN_BARS_BETWEEN_SIGNALS:
            continue
        row = joined.iloc[i]
        numeric_check = pd.to_numeric(row[['prior_high_20','atr14','ema20','ema50','ema200','atr_pct']], errors='coerce')
        if not np.isfinite(numeric_check.to_numpy(dtype=float)).all():
            continue
        entry = float(row['close'])
        # Mechanical version of "not already chased too far": entry must not be too far above breakout level.
        breakout_level = float(row['prior_high_20'])
        if entry <= breakout_level:
            continue
        if (entry / breakout_level - 1) > 0.035:
            continue
        # Needs a prior selloff / consolidation, approximating long-after-downtrend setups.
        prior_dd = entry / float(row['rolling_max_60']) - 1 if row['rolling_max_60'] else 0
        if prior_dd > -0.035 and not (row['close'] > row['ema200'] and row['ema20_slope'] > 0):
            continue
        # Require MA confirmation and avoid severe BTC breakdown.
        if not (entry > row['ema20'] and entry > row['ema50']):
            continue
        if not bool(row['btc_filter_pass']):
            continue
        # Stop below reclaimed resistance and recent structure, ATR-capped.
        stop_candidates = [float(row['prior_high_20']) - 0.65 * float(row['atr14']), float(row['ema20']) - 0.50 * float(row['atr14']), float(row['prior_low_10'])]
        stop = max(min(stop_candidates), entry * 0.90)  # cap maximum mechanical stop at 10%
        if not np.isfinite(stop) or stop >= entry:
            continue
        risk_pct = (entry - stop) / entry
        if risk_pct <= 0.005 or risk_pct > 0.06:
            continue
        risk = entry - stop
        tps = [entry + r * risk for r in TP_R_MULTIPLES]
        score_parts = calc_signal_score(row, symbol, entry, stop, tps, bool(row['btc_filter_pass']))
        # Necessary conditions from supplied theory: clear SL, R:R>2, clear TP, enough liquidity, not 1H scalp.
        if score_parts['weighted_rr'] < 2.0:
            continue
        signals.append((joined.index[i], score_parts, tps))
        last_i = i
    return signals


def replay_trade(df: pd.DataFrame, symbol: str, entry_time: pd.Timestamp, score_parts: Dict[str, float], tps: List[float], slippage_bps: float) -> Trade:
    idx = df.index.get_loc(entry_time)
    entry = float(df.iloc[idx]['close'])
    risk_pct = score_parts['risk_pct'] / 100.0
    stop = entry * (1 - risk_pct)
    remaining = 1.0
    realized_r = 0.0
    tp_hits = 0
    exit_reason = 'max_hold_close'
    exit_time = df.index[min(idx + MAX_HOLD_BARS_4H, len(df)-1)]
    final_exit_price = float(df.loc[exit_time, 'close'])
    tp_done = [False] * len(tps)
    for j in range(idx + 1, min(idx + 1 + MAX_HOLD_BARS_4H, len(df))):
        bar = df.iloc[j]
        # Close-based stop, as in supplied theory.
        if float(bar['close']) < stop:
            realized_r += remaining * (-1.0)
            remaining = 0.0
            exit_reason = 'close_below_stop'
            exit_time = df.index[j]
            final_exit_price = stop
            break
        for k, tp in enumerate(tps):
            if not tp_done[k] and float(bar['high']) >= tp:
                w = TP_WEIGHTS[k]
                take = min(w, remaining)
                realized_r += take * ((tp - entry) / (entry - stop))
                remaining -= take
                tp_done[k] = True
                tp_hits += 1
        if remaining <= 1e-9:
            exit_reason = 'all_tp_hit'
            exit_time = df.index[j]
            final_exit_price = tps[-1]
            break
    if remaining > 1e-9 and exit_reason == 'max_hold_close':
        final_close = float(df.loc[exit_time, 'close'])
        realized_r += remaining * ((final_close - entry) / (entry - stop))
        final_exit_price = final_close

    gross_notional_return = realized_r * ((entry - stop) / entry) * 100.0
    cost_pct = 2 * (FEE_BPS_PER_SIDE + slippage_bps) / 100.0  # bps to percent over round trip
    net_notional_return_pct = gross_notional_return - cost_pct
    account_risk_pct = risk_to_account(score_parts['score'])
    account_return_pct = realized_r * account_risk_pct if account_risk_pct > 0 else 0.0
    return Trade(
        symbol=symbol, entry_time=entry_time.isoformat(), exit_time=exit_time.isoformat(),
        entry=entry, stop=stop, final_exit_price=final_exit_price,
        score=score_parts['score'], structure_score=score_parts['structure_score'], rr_score=score_parts['rr_score'],
        stop_score=score_parts['stop_score'], liquidity_score=score_parts['liquidity_score'],
        slippage_score=score_parts['slippage_score'], volatility_score=score_parts['volatility_score'],
        weighted_rr=score_parts['weighted_rr'], risk_pct=score_parts['risk_pct'], tp_hits=tp_hits,
        exit_reason=exit_reason, gross_r=realized_r, net_notional_return_pct=net_notional_return_pct,
        account_risk_pct=account_risk_pct, account_return_pct=account_return_pct,
        btc_filter_pass=True
    )


def metrics(trades: pd.DataFrame) -> Dict[str, float]:
    if trades.empty:
        return {'trades': 0}
    rets = trades['account_return_pct'].astype(float) / 100.0
    equity = (1 + rets).cumprod()
    dd = equity / equity.cummax() - 1
    wins = trades['gross_r'] > 0
    gains = trades.loc[trades['account_return_pct'] > 0, 'account_return_pct'].sum()
    losses = -trades.loc[trades['account_return_pct'] < 0, 'account_return_pct'].sum()
    return {
        'trades': int(len(trades)),
        'symbols': int(trades['symbol'].nunique()),
        'win_rate_pct': float(wins.mean() * 100),
        'mean_gross_r': float(trades['gross_r'].mean()),
        'median_gross_r': float(trades['gross_r'].median()),
        'total_account_return_pct': float((equity.iloc[-1] - 1) * 100),
        'max_drawdown_pct': float(dd.min() * 100),
        'profit_factor': float(gains / losses) if losses > 0 else math.inf,
        'mean_score': float(trades['score'].mean()),
        'mean_net_notional_return_pct': float(trades['net_notional_return_pct'].mean()),
    }


def main() -> None:
    symbols = sorted([p.name for p in DATA_DIR.iterdir() if p.is_dir()])
    raw_4h: Dict[str, pd.DataFrame] = {}
    for sym in symbols:
        raw_4h[sym] = add_indicators(to_4h(load_symbol_15m(sym)))
    btc_ok = btc_filter(raw_4h['BTCUSDT'])

    all_trades: List[Trade] = []
    all_trades_stress: List[Trade] = []
    signal_counts = []
    for sym, df in raw_4h.items():
        if sym == 'BTCUSDT':
            # keep BTC in universe too; BTC filter naturally applies to itself.
            pass
        signals = find_signals(df, sym, btc_ok)
        signal_counts.append({'symbol': sym, 'signals_found': len(signals)})
        for entry_time, score_parts, tps in signals:
            all_trades.append(replay_trade(df, sym, entry_time, score_parts, tps, SLIPPAGE_BPS_PER_SIDE_BASE))
            all_trades_stress.append(replay_trade(df, sym, entry_time, score_parts, tps, SLIPPAGE_BPS_PER_SIDE_STRESS))

    trades = pd.DataFrame([asdict(t) for t in all_trades]).sort_values(['entry_time','symbol']) if all_trades else pd.DataFrame()
    stress = pd.DataFrame([asdict(t) for t in all_trades_stress]).sort_values(['entry_time','symbol']) if all_trades_stress else pd.DataFrame()
    trades.to_csv(OUT_DIR / 'nurse_neil_theory_universe_trades.csv', index=False)
    stress.to_csv(OUT_DIR / 'nurse_neil_theory_universe_trades_stress.csv', index=False)
    pd.DataFrame(signal_counts).to_csv(OUT_DIR / 'nurse_neil_theory_universe_signal_counts.csv', index=False)

    thresholds = []
    for th in [0, 60, 70, 80, 85, 90]:
        for label, df in [('base_5bps_slip', trades), ('stress_15bps_slip', stress)]:
            sub = df[df['score'] >= th].copy() if not df.empty else df
            m = metrics(sub)
            m.update({'score_threshold': th, 'scenario': label})
            thresholds.append(m)
    thdf = pd.DataFrame(thresholds)
    thdf.to_csv(OUT_DIR / 'nurse_neil_theory_universe_thresholds.csv', index=False)

    by_symbol = []
    for sym, sub in trades.groupby('symbol') if not trades.empty else []:
        m = metrics(sub.copy())
        m['symbol'] = sym
        by_symbol.append(m)
    symdf = pd.DataFrame(by_symbol).sort_values('total_account_return_pct', ascending=False) if by_symbol else pd.DataFrame()
    symdf.to_csv(OUT_DIR / 'nurse_neil_theory_universe_by_symbol.csv', index=False)

    # Equity curve for main recommended threshold Score >= 70.
    eq_trades = trades[trades['score'] >= 70].copy() if not trades.empty else pd.DataFrame()
    plt.style.use('seaborn-v0_8-whitegrid')
    fig, ax = plt.subplots(figsize=(11, 6))
    if not eq_trades.empty:
        eq_trades['entry_dt'] = pd.to_datetime(eq_trades['entry_time'])
        eq_trades = eq_trades.sort_values('entry_dt')
        eq = (1 + eq_trades['account_return_pct'] / 100.0).cumprod() - 1
        ax.plot(eq_trades['entry_dt'], eq * 100, linewidth=2.2, label='Score >= 70 equity')
        ax.axhline(0, color='black', linewidth=0.8)
        ax.set_title('Nurse Neil Theory Universe Backtest: Account Return (Score >= 70)')
        ax.set_ylabel('Cumulative account return (%)')
        ax.set_xlabel('Entry time')
        ax.legend()
    else:
        ax.text(0.5, 0.5, 'No Score >= 70 trades', ha='center', va='center', transform=ax.transAxes)
    fig.tight_layout()
    fig.savefig(OUT_DIR / 'nurse_neil_theory_universe_equity.png', dpi=160)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(10, 6))
    if not symdf.empty:
        plotdf = symdf.sort_values('total_account_return_pct')
        colors = ['#2ca02c' if v >= 0 else '#d62728' for v in plotdf['total_account_return_pct']]
        ax.barh(plotdf['symbol'], plotdf['total_account_return_pct'], color=colors)
        ax.axvline(0, color='black', linewidth=0.8)
        ax.set_title('Nurse Neil Theory Backtest by Symbol')
        ax.set_xlabel('Total account return (%)')
    else:
        ax.text(0.5, 0.5, 'No trades', ha='center', va='center', transform=ax.transAxes)
    fig.tight_layout()
    fig.savefig(OUT_DIR / 'nurse_neil_theory_universe_by_symbol.png', dpi=160)
    plt.close(fig)

    summary = {
        'universe': symbols,
        'period_start_utc': str(min(df.index.min() for df in raw_4h.values())),
        'period_end_utc': str(max(df.index.max() for df in raw_4h.values())),
        'bar_timeframe': '4H derived from existing 15m Binance USD-M futures data',
        'base_metrics_all': metrics(trades),
        'base_metrics_score_ge_70': metrics(trades[trades['score'] >= 70]) if not trades.empty else {'trades': 0},
        'base_metrics_score_ge_80': metrics(trades[trades['score'] >= 80]) if not trades.empty else {'trades': 0},
        'stress_metrics_score_ge_70': metrics(stress[stress['score'] >= 70]) if not stress.empty else {'trades': 0},
        'files': {
            'trades': 'nurse_neil_theory_universe_trades.csv',
            'thresholds': 'nurse_neil_theory_universe_thresholds.csv',
            'by_symbol': 'nurse_neil_theory_universe_by_symbol.csv',
            'equity_chart': 'nurse_neil_theory_universe_equity.png',
        }
    }
    with open(OUT_DIR / 'nurse_neil_theory_universe_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)

    # Markdown report.
    def md_table(df: pd.DataFrame, cols: List[str], max_rows: int = 20) -> str:
        if df.empty:
            return '_No rows._'
        return df[cols].head(max_rows).to_markdown(index=False, floatfmt='.4f')

    report = []
    report.append('# Nurse Neil 理論規則多幣種回測報告\n')
    report.append('本次回測不是回放 Discord/社群實際喊單，而是把你提供的 Nurse Neil 理論拆成可重複執行的機械條件，套用到 V6 系統目前已有的 Binance USD-M 15m 多幣種行情，並統一轉為 4H 結構交易。其目的在於回答：這套「下跌後結構轉強、突破/SR flip、均線確認、明確 SL、分批 TP、分數控倉」理論，在目前系統已有幣種上是否具備可量化優勢。\n')
    report.append('## 回測 universe 與規則\n')
    report.append(f'Universe 為 `{", ".join(symbols)}`，資料期間為 `{summary["period_start_utc"]}` 至 `{summary["period_end_utc"]}`。回測使用 4H K 線，入場條件要求價格突破前 20 根 4H 高點、收盤站上 EMA20/EMA50、入場未相對突破位追高超過 3.5%、止損距離不超過 6%，並通過 BTC 4H 大盤過濾。止損採「收盤跌破止損」；止盈以 1.5R、2.5R、4R、6R 分批出場；base 成本採每邊 taker fee 5 bps 與每邊滑點 5 bps。\n')
    report.append('## 核心結果\n')
    m70 = summary['base_metrics_score_ge_70']
    mall = summary['base_metrics_all']
    report.append(pd.DataFrame([
        {'口徑':'全部機械訊號', **mall},
        {'口徑':'Score >= 70', **m70},
        {'口徑':'Score >= 80', **summary['base_metrics_score_ge_80']},
        {'口徑':'Score >= 70 壓力滑點', **summary['stress_metrics_score_ge_70']},
    ]).to_markdown(index=False, floatfmt='.4f'))
    report.append('\n\n![Equity](nurse_neil_theory_universe_equity.png)\n')
    report.append('## 門檻敏感度\n')
    report.append(md_table(thdf, ['scenario','score_threshold','trades','symbols','win_rate_pct','mean_gross_r','total_account_return_pct','max_drawdown_pct','profit_factor','mean_score']))
    report.append('\n\n## 分幣種結果\n')
    report.append('![By symbol](nurse_neil_theory_universe_by_symbol.png)\n')
    if not symdf.empty:
        report.append(md_table(symdf, ['symbol','trades','win_rate_pct','mean_gross_r','total_account_return_pct','max_drawdown_pct','profit_factor','mean_score']))
    report.append('\n\n## 解讀\n')
    report.append('如果 Score >= 70 的口徑能保持正收益、較低回撤且壓力滑點後仍不崩潰，則這套理論可以作為 V6 系統的候選多幣種結構掃描器；若收益主要集中在少數幣或少數月份，則應只保留為「提示/觀察」而非自動交易訊號。由於目前 universe 只有系統既有 8 個幣種，且全部是相對高流動性的主流或中大型幣，本結果不能直接外推到 Nurse Neil 原始截圖中更小市值的新幣。\n')
    report.append('## 下一步\n')
    report.append('建議把這個腳本接入每日掃描流程，先只輸出候選而不自動下單；同時擴充行情 universe 到 Nurse Neil 常喊的小幣，並加入真實 funding、order book spread、訊號延遲與同時持倉上限。只有當 Score >= 70 或 Score >= 80 在擴充樣本與走樣本外期間仍穩定，才值得升級為紙交易。\n')
    (OUT_DIR / 'nurse_neil_theory_universe_backtest_report.md').write_text('\n'.join(report), encoding='utf-8')

    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()
