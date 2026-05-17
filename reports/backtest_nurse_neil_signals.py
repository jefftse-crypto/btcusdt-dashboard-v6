#!/usr/bin/env python3
"""
Nurse Neil event backtest v1.0

Backtests screenshot-derived Nurse Neil calls that contain enough numeric levels
(entry, stop, at least one TP) against real Binance USD-M futures 15m OHLCV data.

Important limitation:
- This is an event-level replay of a very small screenshot sample, not a full
  historical edge study. It is intended to validate whether the V6 system can
  ingest and audit these external signals.
"""

from __future__ import annotations

import argparse
import json
import math
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib.pyplot as plt
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports"
DATA_DIR = ROOT / "data" / "nurse_neil_backtest_15m"

OUT_EVENTS = REPORT_DIR / "nurse_neil_backtest_events.csv"
OUT_FILLS = REPORT_DIR / "nurse_neil_backtest_fills.csv"
OUT_SUMMARY = REPORT_DIR / "nurse_neil_backtest_summary.json"
OUT_REPORT = REPORT_DIR / "nurse_neil_backtest_report.md"
OUT_EQUITY = REPORT_DIR / "nurse_neil_backtest_equity.png"
OUT_THRESH = REPORT_DIR / "nurse_neil_backtest_thresholds.csv"

BINANCE_FAPI = "https://fapi.binance.com/fapi/v1/klines"

TAKER_FEE_BPS = 5.0       # 0.05% per side, conservative taker assumption.
BASE_SLIPPAGE_BPS = 5.0   # default execution/slippage per entry/exit.
STRESS_SLIPPAGE_BPS = 15.0
ACCOUNT_RISK_CAP_PCT = 1.0
INITIAL_EQUITY = 10_000.0


def utc_ms(text: str) -> int:
    dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    return int(dt.timestamp() * 1000)


# Screenshot-derived signals with sufficiently visible numeric levels.
# Use only exact or near-exact levels visible in the provided screenshots/text.
RAW_SIGNALS: List[Dict[str, Any]] = [
    {
        "id": "INIT_2026-04-28_2203",
        "symbol": "INITUSDT",
        "signal_time_utc": "2026-04-28T14:03:00Z",  # screenshot UTC+8 22:03
        "direction": "long",
        "timeframe": "1H",
        "entry": 0.0910,
        "stop_loss": 0.0883,
        "take_profits": [0.0965, 0.1113, 0.1333],
        "tp_weights": [0.50, 0.30, 0.20],
        "score": 49,
        "decision": "reject",
        "source_note": "Scalp INIT; visible stop 0.0883 and TP labels 0.0965/0.1113/0.1333.",
    },
    {
        "id": "AVNT_2026-05-07_0024",
        "symbol": "AVNTUSDT",
        "signal_time_utc": "2026-05-06T16:24:00Z",  # screenshot UTC+8 00:24 on May 7/8 region; use displayed time as UTC+8.
        "direction": "long",
        "timeframe": "4H",
        "entry": 0.1554,
        "stop_loss": 0.1428,
        "take_profits": [0.2291, 0.3117],
        "tp_weights": [0.60, 0.40],
        "score": 59,
        "decision": "reject",
        "source_note": "AVNT 4H long; visible stop 0.1428 and TP labels 0.2291/0.3117.",
    },
    {
        "id": "BIO_2026-05-09_0029",
        "symbol": "BIOUSDT",
        "signal_time_utc": "2026-05-08T16:29:00Z",
        "direction": "long",
        "timeframe": "2H",
        "entry": 0.04792,
        "stop_loss": 0.0440,
        "take_profits": [0.05181, 0.05694, 0.06573],
        "tp_weights": [0.40, 0.35, 0.25],
        "score": None,
        "decision": "unscored",
        "source_note": "BIO 2H long; text stop 0.044, visible TP labels 0.05181/0.05694/0.06573.",
    },
    {
        "id": "XRP_2026-05-11_0928",
        "symbol": "XRPUSDT",
        "signal_time_utc": "2026-05-11T01:28:00Z",
        "direction": "long",
        "timeframe": "4H",
        "entry": 1.4601,
        "stop_loss": 1.4180,
        "take_profits": [1.5288, 1.6190, 1.7423, 1.8665],
        "tp_weights": [0.30, 0.30, 0.25, 0.15],
        "score": 96,
        "decision": "normal_size",
        "source_note": "XRP 4H long; visible trendline break/SR flip with TP labels.",
    },
]


@dataclass
class Fill:
    signal_id: str
    symbol: str
    timestamp_utc: str
    fill_type: str
    price: float
    weight: float
    gross_r_multiple: float
    net_return_pct_on_notional: float


@dataclass
class EventResult:
    id: str
    symbol: str
    signal_time_utc: str
    timeframe: str
    entry: float
    stop_loss: float
    take_profits: str
    score: Optional[float]
    decision: str
    data_status: str
    bars_used: int
    entry_time_utc: str
    exit_time_utc: str
    exit_reason: str
    tp_hit_count: int
    weighted_rr_target: float
    realized_r: float
    gross_return_pct_on_notional: float
    net_return_pct_on_notional: float
    max_favorable_excursion_pct: float
    max_adverse_excursion_pct: float
    suggested_account_risk_pct: float
    account_return_pct: float
    source_note: str


def weighted_rr(entry: float, stop: float, tps: List[float], weights: List[float]) -> float:
    risk = entry - stop
    if risk <= 0:
        return 0.0
    return sum(max(0.0, (tp - entry) / risk) * w for tp, w in zip(tps, weights))


def iso_from_ms(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_klines(symbol: str, start_ms: int, end_ms: int, interval: str = "15m") -> pd.DataFrame:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    cache = DATA_DIR / f"{symbol}_{interval}_{start_ms}_{end_ms}.csv"
    if cache.exists():
        return pd.read_csv(cache)

    all_rows: List[List[Any]] = []
    cur = start_ms
    while cur < end_ms:
        params = {"symbol": symbol, "interval": interval, "startTime": cur, "endTime": end_ms, "limit": 1500}
        resp = requests.get(BINANCE_FAPI, params=params, timeout=20)
        if resp.status_code != 200:
            raise RuntimeError(f"Binance API error {resp.status_code} for {symbol}: {resp.text[:200]}")
        rows = resp.json()
        if not rows:
            break
        all_rows.extend(rows)
        last_open = int(rows[-1][0])
        nxt = last_open + 15 * 60 * 1000
        if nxt <= cur:
            break
        cur = nxt
        time.sleep(0.05)

    cols = [
        "open_time", "open", "high", "low", "close", "volume", "close_time", "quote_volume",
        "count", "taker_buy_volume", "taker_buy_quote_volume", "ignore",
    ]
    df = pd.DataFrame(all_rows, columns=cols)
    if df.empty:
        return df
    for col in ["open", "high", "low", "close", "volume", "quote_volume", "taker_buy_volume", "taker_buy_quote_volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    for col in ["open_time", "close_time", "count"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").astype("int64")
    df.drop_duplicates("open_time").sort_values("open_time").to_csv(cache, index=False)
    return df


def load_market_data(symbol: str, signal_ms: int, max_hold_days: int) -> Tuple[pd.DataFrame, str]:
    start_ms = signal_ms - 4 * 60 * 60 * 1000
    end_ms = signal_ms + max_hold_days * 24 * 60 * 60 * 1000
    try:
        df = fetch_klines(symbol, start_ms, end_ms)
        status = "binance_futures_api"
    except Exception as exc:
        return pd.DataFrame(), f"fetch_failed: {exc}"
    if df.empty:
        return df, "no_data"
    return df, status


def resample_close_bars(df_after: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    tf = timeframe.upper().strip()
    rule = {"1H": "1h", "2H": "2h", "4H": "4h", "1D": "1d"}.get(tf, "4h")
    tmp = df_after.copy()
    tmp["dt"] = pd.to_datetime(tmp["open_time"], unit="ms", utc=True)
    tmp = tmp.set_index("dt")
    agg = tmp.resample(rule, label="right", closed="right").agg({"open": "first", "high": "max", "low": "min", "close": "last", "open_time": "last"}).dropna()
    return agg.reset_index()


def backtest_one(signal: Dict[str, Any], fee_bps: float, slippage_bps: float, max_hold_days: int, score_threshold: int = 0) -> Tuple[EventResult, List[Fill]]:
    signal_ms = utc_ms(signal["signal_time_utc"])
    symbol = signal["symbol"]
    entry = float(signal["entry"])
    stop = float(signal["stop_loss"])
    tps = [float(x) for x in signal["take_profits"]]
    weights = [float(x) for x in signal["tp_weights"]]
    risk = entry - stop
    target_rr = weighted_rr(entry, stop, tps, weights)

    # If score is known and below threshold, record an observed-but-not-traded event.
    score = signal.get("score")
    if score is not None and float(score) < score_threshold:
        return EventResult(
            id=signal["id"], symbol=symbol, signal_time_utc=signal["signal_time_utc"], timeframe=signal["timeframe"],
            entry=entry, stop_loss=stop, take_profits=",".join(map(str, tps)), score=score, decision="filtered_out",
            data_status="not_requested_below_threshold", bars_used=0, entry_time_utc="", exit_time_utc="", exit_reason="score_filter",
            tp_hit_count=0, weighted_rr_target=target_rr, realized_r=0.0, gross_return_pct_on_notional=0.0,
            net_return_pct_on_notional=0.0, max_favorable_excursion_pct=0.0, max_adverse_excursion_pct=0.0,
            suggested_account_risk_pct=0.0, account_return_pct=0.0, source_note=signal.get("source_note", "")
        ), []

    df, status = load_market_data(symbol, signal_ms, max_hold_days)
    if df.empty:
        return EventResult(
            id=signal["id"], symbol=symbol, signal_time_utc=signal["signal_time_utc"], timeframe=signal["timeframe"],
            entry=entry, stop_loss=stop, take_profits=",".join(map(str, tps)), score=score, decision=signal.get("decision", ""),
            data_status=status, bars_used=0, entry_time_utc="", exit_time_utc="", exit_reason="no_data",
            tp_hit_count=0, weighted_rr_target=target_rr, realized_r=0.0, gross_return_pct_on_notional=0.0,
            net_return_pct_on_notional=0.0, max_favorable_excursion_pct=0.0, max_adverse_excursion_pct=0.0,
            suggested_account_risk_pct=0.0, account_return_pct=0.0, source_note=signal.get("source_note", "")
        ), []

    df_after = df[df["open_time"] >= signal_ms].copy().sort_values("open_time")
    if df_after.empty:
        status = "no_after_signal_data"
        return EventResult(
            id=signal["id"], symbol=symbol, signal_time_utc=signal["signal_time_utc"], timeframe=signal["timeframe"],
            entry=entry, stop_loss=stop, take_profits=",".join(map(str, tps)), score=score, decision=signal.get("decision", ""),
            data_status=status, bars_used=0, entry_time_utc="", exit_time_utc="", exit_reason="no_data",
            tp_hit_count=0, weighted_rr_target=target_rr, realized_r=0.0, gross_return_pct_on_notional=0.0,
            net_return_pct_on_notional=0.0, max_favorable_excursion_pct=0.0, max_adverse_excursion_pct=0.0,
            suggested_account_risk_pct=0.0, account_return_pct=0.0, source_note=signal.get("source_note", "")
        ), []

    entry_row = df_after.iloc[0]
    entry_time = int(entry_row["open_time"])
    fills: List[Fill] = []
    remaining = 1.0
    realized_r = 0.0
    gross_notional_ret = 0.0
    net_notional_ret = 0.0
    tp_hit = [False] * len(tps)
    exit_time = entry_time
    exit_reason = "max_hold_close"

    # Apply entry cost once on full notional.
    one_way_cost = (fee_bps + slippage_bps) / 10_000
    net_notional_ret -= one_way_cost

    max_high = float(df_after["high"].max())
    min_low = float(df_after["low"].min())
    mfe = (max_high / entry - 1) * 100
    mae = (min_low / entry - 1) * 100

    stop_closes = resample_close_bars(df_after, signal["timeframe"])
    stop_by_time: Dict[int, bool] = {}
    for _, row in stop_closes.iterrows():
        close_ms = int(row["open_time"])
        stop_by_time[close_ms] = float(row["close"]) < stop

    for _, row in df_after.iterrows():
        ts = int(row["open_time"])
        high = float(row["high"])
        close = float(row["close"])

        # Conservative order: if TP and timeframe stop occur same 15m window, TP is checked first because stop is close-based.
        for i, tp in enumerate(tps):
            if not tp_hit[i] and high >= tp and remaining > 0:
                w = min(weights[i], remaining)
                rr = (tp - entry) / risk if risk > 0 else 0.0
                gross = (tp / entry - 1) * w
                net = gross - one_way_cost * w
                realized_r += rr * w
                gross_notional_ret += gross
                net_notional_ret += net
                remaining -= w
                tp_hit[i] = True
                fills.append(Fill(signal["id"], symbol, iso_from_ms(ts), f"TP{i+1}", tp, w, rr, net * 100))
                exit_time = ts
                exit_reason = f"tp{i+1}"
        if remaining <= 1e-9:
            exit_reason = "all_tp_hit"
            break

        # Close-based invalidation. Map by the latest row of each resampled period.
        if stop_by_time.get(ts, False) and remaining > 0:
            rr = (stop - entry) / risk if risk > 0 else -1.0
            gross = (stop / entry - 1) * remaining
            net = gross - one_way_cost * remaining
            realized_r += rr * remaining
            gross_notional_ret += gross
            net_notional_ret += net
            fills.append(Fill(signal["id"], symbol, iso_from_ms(ts), "STOP_CLOSE", stop, remaining, rr, net * 100))
            remaining = 0.0
            exit_time = ts
            exit_reason = "close_below_stop"
            break

    if remaining > 1e-9:
        last = df_after.iloc[-1]
        final_price = float(last["close"])
        rr = (final_price - entry) / risk if risk > 0 else 0.0
        gross = (final_price / entry - 1) * remaining
        net = gross - one_way_cost * remaining
        realized_r += rr * remaining
        gross_notional_ret += gross
        net_notional_ret += net
        exit_time = int(last["open_time"])
        fills.append(Fill(signal["id"], symbol, iso_from_ms(exit_time), "TIME_EXIT", final_price, remaining, rr, net * 100))

    # Risk mapping uses prior scoring decision; unscored events are capped at 0.25%.
    if score is None:
        acct_risk = 0.25
    elif score >= 90:
        acct_risk = 1.0
    elif score >= 80:
        acct_risk = 0.75
    elif score >= 70:
        acct_risk = 0.5
    elif score >= 60:
        acct_risk = 0.25
    else:
        acct_risk = 0.0
    account_return = realized_r * acct_risk if acct_risk > 0 else 0.0

    return EventResult(
        id=signal["id"], symbol=symbol, signal_time_utc=signal["signal_time_utc"], timeframe=signal["timeframe"],
        entry=entry, stop_loss=stop, take_profits=",".join(map(str, tps)), score=score, decision=signal.get("decision", ""),
        data_status=status, bars_used=len(df_after), entry_time_utc=iso_from_ms(entry_time), exit_time_utc=iso_from_ms(exit_time),
        exit_reason=exit_reason, tp_hit_count=sum(tp_hit), weighted_rr_target=round(target_rr, 4), realized_r=round(realized_r, 4),
        gross_return_pct_on_notional=round(gross_notional_ret * 100, 4), net_return_pct_on_notional=round(net_notional_ret * 100, 4),
        max_favorable_excursion_pct=round(mfe, 4), max_adverse_excursion_pct=round(mae, 4),
        suggested_account_risk_pct=acct_risk, account_return_pct=round(account_return, 4), source_note=signal.get("source_note", "")
    ), fills


def run_backtest(fee_bps: float, slippage_bps: float, max_hold_days: int, score_threshold: int) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    events: List[EventResult] = []
    fills: List[Fill] = []
    for sig in RAW_SIGNALS:
        ev, fs = backtest_one(sig, fee_bps, slippage_bps, max_hold_days, score_threshold)
        events.append(ev)
        fills.extend(fs)

    ev_df = pd.DataFrame([asdict(x) for x in events])
    fill_df = pd.DataFrame([asdict(x) for x in fills])
    traded = ev_df[(ev_df["exit_reason"] != "score_filter") & (ev_df["data_status"].str.contains("api", na=False))]
    summary = {
        "fee_bps_per_side": fee_bps,
        "slippage_bps_per_side": slippage_bps,
        "max_hold_days": max_hold_days,
        "score_threshold": score_threshold,
        "signals_total": len(ev_df),
        "signals_with_data": int((ev_df["data_status"].str.contains("api", na=False)).sum()),
        "traded_events": int(len(traded)),
        "filtered_events": int((ev_df["exit_reason"] == "score_filter").sum()),
        "tp_hit_events": int((traded["tp_hit_count"] > 0).sum()) if len(traded) else 0,
        "stop_events": int((traded["exit_reason"] == "close_below_stop").sum()) if len(traded) else 0,
        "mean_realized_r": float(traded["realized_r"].mean()) if len(traded) else 0.0,
        "median_realized_r": float(traded["realized_r"].median()) if len(traded) else 0.0,
        "total_account_return_pct": float(traded["account_return_pct"].sum()) if len(traded) else 0.0,
        "mean_net_notional_return_pct": float(traded["net_return_pct_on_notional"].mean()) if len(traded) else 0.0,
        "data_notes": "Backtest uses only screenshot-derived signals with visible numeric entry/stop/TP levels.",
    }
    return ev_df, fill_df, summary


def plot_equity(ev_df: pd.DataFrame) -> None:
    traded = ev_df[(ev_df["data_status"].str.contains("api", na=False)) & (ev_df["exit_reason"] != "score_filter")].copy()
    if traded.empty:
        return
    traded["exit_dt"] = pd.to_datetime(traded["exit_time_utc"], utc=True)
    traded = traded.sort_values("exit_dt")
    traded["equity_pct"] = traded["account_return_pct"].cumsum()
    plt.figure(figsize=(9, 4.8))
    plt.plot(traded["exit_dt"], traded["equity_pct"], marker="o", linewidth=2)
    for _, row in traded.iterrows():
        plt.annotate(row["symbol"], (row["exit_dt"], row["equity_pct"]), textcoords="offset points", xytext=(0, 8), ha="center", fontsize=8)
    plt.axhline(0, color="black", linewidth=0.8)
    plt.title("Nurse Neil Screenshot Sample Backtest - Cumulative Account Return")
    plt.ylabel("Cumulative Account Return (%)")
    plt.xlabel("Exit Time (UTC)")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(OUT_EQUITY, dpi=160)
    plt.close()


def threshold_sensitivity(max_hold_days: int) -> pd.DataFrame:
    rows = []
    for threshold in [0, 60, 70, 80, 90]:
        for slip in [BASE_SLIPPAGE_BPS, STRESS_SLIPPAGE_BPS]:
            ev, _, summary = run_backtest(TAKER_FEE_BPS, slip, max_hold_days, threshold)
            rows.append({
                "score_threshold": threshold,
                "slippage_bps_per_side": slip,
                "traded_events": summary["traded_events"],
                "filtered_events": summary["filtered_events"],
                "signals_with_data": summary["signals_with_data"],
                "mean_realized_r": round(summary["mean_realized_r"], 4),
                "total_account_return_pct": round(summary["total_account_return_pct"], 4),
                "mean_net_notional_return_pct": round(summary["mean_net_notional_return_pct"], 4),
            })
    return pd.DataFrame(rows)


def build_report(ev_df: pd.DataFrame, fill_df: pd.DataFrame, summary: Dict[str, Any], thresh_df: pd.DataFrame) -> str:
    events_table = ev_df[[
        "symbol", "timeframe", "score", "entry", "stop_loss", "take_profits", "exit_reason", "tp_hit_count",
        "realized_r", "net_return_pct_on_notional", "suggested_account_risk_pct", "account_return_pct", "data_status"
    ]].to_markdown(index=False)
    thresh_table = thresh_df.to_markdown(index=False)
    fill_table = fill_df.to_markdown(index=False) if not fill_df.empty else "無成交明細。"

    caveat = """
本次回測不是完整策略績效檢定，而是對截圖中可讀出完整數字的訊號做事件級 replay。樣本數太小，不能用來估計長期勝率、Sharpe 或容量；它的價值在於驗證接入流程、成本口徑、止損/止盈邏輯，以及篩選門檻是否能避免低分訊號進入風險池。
""".strip()

    return f"""# Nurse Neil 外部訊號樣本回測報告

{caveat}

## 回測口徑

本回測使用 Binance USD-M Futures 15m OHLCV 行情，對每筆訊號在訊號時間後立即按截圖中的 CMP/entry 建倉，並以訊號週期的 **收盤跌破止損** 作為失效條件。止盈採分批出場，預設每邊 taker fee 為 `{summary['fee_bps_per_side']:.1f}` bps，每邊滑點為 `{summary['slippage_bps_per_side']:.1f}` bps，最長持有 `{summary['max_hold_days']}` 天。帳戶層風險按照先前 Nurse Neil 評分模組映射：90 分以上 1.0% 風險、70–89 分降倉、60 分以下不交易。

| 指標 | 數值 |
|---|---:|
| 截圖訊號總數 | {summary['signals_total']} |
| 有行情資料訊號 | {summary['signals_with_data']} |
| 實際交易事件 | {summary['traded_events']} |
| 分數過濾事件 | {summary['filtered_events']} |
| 至少觸發一個 TP 的事件 | {summary['tp_hit_events']} |
| 收盤止損事件 | {summary['stop_events']} |
| 平均 realized R | {summary['mean_realized_r']:.4f} |
| 中位 realized R | {summary['median_realized_r']:.4f} |
| 帳戶總收益率 | {summary['total_account_return_pct']:.4f}% |
| 平均名義淨收益率 | {summary['mean_net_notional_return_pct']:.4f}% |

![Nurse Neil backtest equity]({OUT_EQUITY.name})

## 事件結果

{events_table}

## 成交明細

{fill_table}

## 分數門檻與滑點敏感度

{thresh_table}

## 解讀

若只有高分訊號進入交易池，樣本會非常少，但能顯著降低小幣種與 1H scalp 的噪音暴露。若完全不設分數門檻，回測結果更像「訊號提供者所有喊單」的跟單測試，會混入原本評分模組已拒絕的 INIT、AVNT 等交易。從系統接入角度，較合理的第一階段不是追求回測收益最大化，而是要求所有外部訊號必須留下可審計的 entry、stop、TP、score、成本後 realized R 與帳戶風險。

## 限制與下一步

第一，截圖樣本只有少數訊號，而且部分訊號缺少完整 TP 或準確入場價，因此本報告只納入可讀出完整數字的事件。第二，Nurse Neil 訊號原文常使用「TPs above」或圖中顏色線，若沒有 OCR/人工校對的結構化資料，就不能做大樣本統計。第三，下一步應建立至少 100–200 筆歷史訊號表，然後用同一腳本重跑，才能判斷 Score ≥ 70、Score ≥ 80、只做 4H、排除 BTC 4H 破位等門檻是否真的有統計優勢。
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-hold-days", type=int, default=14)
    parser.add_argument("--score-threshold", type=int, default=0)
    parser.add_argument("--slippage-bps", type=float, default=BASE_SLIPPAGE_BPS)
    args = parser.parse_args()

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    ev_df, fill_df, summary = run_backtest(TAKER_FEE_BPS, args.slippage_bps, args.max_hold_days, args.score_threshold)
    ev_df.to_csv(OUT_EVENTS, index=False)
    fill_df.to_csv(OUT_FILLS, index=False)
    thresh_df = threshold_sensitivity(args.max_hold_days)
    thresh_df.to_csv(OUT_THRESH, index=False)
    plot_equity(ev_df)
    OUT_SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_REPORT.write_text(build_report(ev_df, fill_df, summary, thresh_df), encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"events={OUT_EVENTS}")
    print(f"fills={OUT_FILLS}")
    print(f"thresholds={OUT_THRESH}")
    print(f"report={OUT_REPORT}")


if __name__ == "__main__":
    main()
