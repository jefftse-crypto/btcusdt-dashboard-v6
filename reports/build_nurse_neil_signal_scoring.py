#!/usr/bin/env python3
"""
Nurse Neil Signal Scoring v1.0

This script turns discretionary Nurse Neil-style calls into a repeatable 0-100
score. It creates a CSV template and scores either the template sample rows or a
user-provided CSV.

Usage:
  python3.11 reports/build_nurse_neil_signal_scoring.py
  python3.11 reports/build_nurse_neil_signal_scoring.py --input reports/nurse_neil_signal_input_template.csv
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Dict, Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports"
TEMPLATE_CSV = REPORT_DIR / "nurse_neil_signal_input_template.csv"
SCORED_CSV = REPORT_DIR / "nurse_neil_signal_scored.csv"
SUMMARY_JSON = REPORT_DIR / "nurse_neil_signal_scoring_results.json"
REPORT_MD = REPORT_DIR / "nurse_neil_signal_scoring_report.md"

DEFAULT_TP_WEIGHTS = [0.30, 0.30, 0.25, 0.15]


@dataclass
class ScoreResult:
    symbol: str
    direction: str
    timeframe: str
    entry: float
    stop_loss: float
    take_profits: str
    weighted_rr: float
    stop_distance_pct: float
    structure_score: int
    rr_score: int
    stop_score: int
    liquidity_score: int
    slippage_score: int
    volatility_score: int
    total_score: int
    grade: str
    decision: str
    suggested_account_risk_pct: float
    position_notional_per_10000_usdt: float
    hard_rejects: str
    warnings: str
    reasoning: str


def boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if pd.isna(value):
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "是", "有", "對", "✅"}


def parse_float(value: Any, default: float = 0.0) -> float:
    if pd.isna(value):
        return default
    try:
        return float(str(value).strip().replace("%", ""))
    except Exception:
        return default


def parse_tps(value: Any) -> List[float]:
    if pd.isna(value):
        return []
    text = str(value).replace("|", ",").replace(";", ",")
    values: List[float] = []
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            values.append(float(part))
        except ValueError:
            continue
    return values


def normalize_weights(n: int, raw: Any = None) -> List[float]:
    if n <= 0:
        return []
    weights: List[float] = []
    if raw is not None and not pd.isna(raw) and str(raw).strip():
        for part in str(raw).replace("|", ",").replace(";", ",").split(","):
            try:
                weights.append(max(0.0, float(part.strip())))
            except ValueError:
                pass
    if len(weights) != n:
        weights = [(DEFAULT_TP_WEIGHTS[i] if i < len(DEFAULT_TP_WEIGHTS) else 0.0) for i in range(n)]
    s = sum(weights)
    if s <= 0:
        return [1 / n] * n
    return [w / s for w in weights]


def weighted_rr(direction: str, entry: float, stop_loss: float, tps: List[float], weights: List[float]) -> float:
    if entry <= 0 or not tps:
        return 0.0
    direction = direction.lower().strip()
    risk = entry - stop_loss if direction == "long" else stop_loss - entry
    if risk <= 0:
        return 0.0
    total = 0.0
    for tp, w in zip(tps, weights):
        reward = tp - entry if direction == "long" else entry - tp
        total += max(0.0, reward / risk) * w
    return total


def score_structure(row: pd.Series) -> int:
    score = 0
    if boolish(row.get("trendline_break")): score += 8
    if boolish(row.get("sr_flip")): score += 7
    if boolish(row.get("above_key_ma")): score += 4
    if boolish(row.get("market_structure_shift")): score += 4
    if boolish(row.get("not_catching_knife")): score += 2
    return max(0, min(25, score))


def score_rr(rr: float) -> int:
    if rr < 1.0: return 0
    if rr < 1.5: return 8
    if rr < 2.0: return 12
    if rr < 3.0: return 17
    if rr < 5.0: return 22
    return 25


def score_stop(stop_type: str) -> int:
    mapping = {
        "structure_failure": 15,
        "prior_low_or_support": 12,
        "short_term_low": 8,
        "percentage_only": 4,
        "unclear": 0,
    }
    return mapping.get(str(stop_type).strip(), 0)


def score_liquidity(tier: str) -> int:
    mapping = {"major": 10, "mid": 7, "small": 5, "illiquid": 2}
    return mapping.get(str(tier).strip(), 5)


def score_slippage(row: pd.Series) -> int:
    tier = str(row.get("liquidity_tier", "small")).strip()
    tf = str(row.get("timeframe", "4H")).upper().strip()
    move = max(0.0, parse_float(row.get("signal_move_pct", 0)))
    base = {"major": 10, "mid": 8, "small": 6, "illiquid": 3}.get(tier, 6)
    if move > 5:
        base -= 6
    elif move > 3:
        base -= 4
    elif move > 2:
        base -= 2
    if tf == "1H":
        base -= 2
    return max(0, min(10, base))


def score_volatility(row: pd.Series) -> int:
    tier = str(row.get("liquidity_tier", "small")).strip()
    tf = str(row.get("timeframe", "4H")).upper().strip()
    btc = str(row.get("btc_4h_risk", "neutral")).strip()
    concurrent = int(parse_float(row.get("concurrent_alt_longs", 0)))
    if tier == "major" and tf != "1H":
        score = 14
    elif tier == "mid" and tf != "1H":
        score = 11
    elif tier == "small":
        score = 7
    elif tier == "illiquid":
        score = 3
    else:
        score = 8
    if tf == "1H":
        score -= 4
    if btc == "bearish_breakdown":
        score -= 5
    if concurrent >= 4:
        score -= 2
    return max(0, min(15, score))


def classify_grade(score: int) -> str:
    if score >= 90: return "A+"
    if score >= 80: return "A"
    if score >= 70: return "B"
    if score >= 60: return "C"
    return "D"


def decision_and_risk(score: int, hard_rejects: List[str]) -> tuple[str, float]:
    if hard_rejects or score < 60:
        return "reject", 0.0
    if score >= 90:
        return "normal_size", 1.0
    if score >= 80:
        return "half_size", 0.75
    if score >= 70:
        return "half_size", 0.5
    return "quarter_size", 0.25


def score_row(row: pd.Series) -> ScoreResult:
    symbol = str(row.get("symbol", "")).strip().upper()
    direction = str(row.get("direction", "long")).strip().lower()
    timeframe = str(row.get("timeframe", "4H")).strip()
    entry = parse_float(row.get("entry"))
    stop_loss = parse_float(row.get("stop_loss"))
    tps = parse_tps(row.get("take_profits"))
    weights = normalize_weights(len(tps), row.get("tp_weights"))
    rr = weighted_rr(direction, entry, stop_loss, tps, weights)
    risk_abs = entry - stop_loss if direction == "long" else stop_loss - entry
    stop_distance_pct = risk_abs / entry * 100 if entry > 0 else 0.0

    components = {
        "structure": score_structure(row),
        "rr": score_rr(rr),
        "stop": score_stop(str(row.get("stop_type", "unclear")).strip()),
        "liquidity": score_liquidity(str(row.get("liquidity_tier", "small")).strip()),
        "slippage": score_slippage(row),
        "volatility": score_volatility(row),
    }

    hard_rejects: List[str] = []
    warnings: List[str] = []
    signal_move = parse_float(row.get("signal_move_pct", 0))
    has_clear_sl = boolish(row.get("has_clear_sl", True))
    has_clear_tp = boolish(row.get("has_clear_tp", True))
    btc_risk = str(row.get("btc_4h_risk", "neutral")).strip()
    concurrent = int(parse_float(row.get("concurrent_alt_longs", 0)))

    if not has_clear_sl or risk_abs <= 0:
        hard_rejects.append("沒有有效或方向正確的止損")
    if not has_clear_tp or len(tps) == 0:
        hard_rejects.append("沒有明確止盈")
    if rr < 2:
        warnings.append(f"加權 R:R {rr:.2f} 低於 2.0")
    if signal_move > 5:
        hard_rejects.append("訊號後已移動超過 5%")
    elif signal_move > 3:
        warnings.append("訊號後已移動超過 3%，需等回踩")
    if stop_distance_pct > 6:
        hard_rejects.append(f"止損距離 {stop_distance_pct:.2f}% 超過 6%")
    if timeframe.upper() == "1H":
        warnings.append("1H scalp 訊號需降倉")
    if btc_risk == "bearish_breakdown":
        hard_rejects.append("BTC 4H 明顯破位向下")
    if concurrent >= 5:
        hard_rejects.append("同時山寨多單過多")

    raw_total = sum(components.values())
    total = min(raw_total, 59) if hard_rejects else max(0, min(100, raw_total))
    grade = classify_grade(total)
    decision, risk_pct = decision_and_risk(total, hard_rejects)
    position_notional = 10000 * (risk_pct / 100) / (stop_distance_pct / 100) if risk_pct > 0 and stop_distance_pct > 0 else 0.0

    reasoning = (
        f"structure {components['structure']}/25 | rr {components['rr']}/25 weighted={rr:.2f} | "
        f"stop {components['stop']}/15 distance={stop_distance_pct:.2f}% | liquidity {components['liquidity']}/10 | "
        f"slippage {components['slippage']}/10 | volatility {components['volatility']}/15"
    )

    return ScoreResult(
        symbol=symbol,
        direction=direction,
        timeframe=timeframe,
        entry=entry,
        stop_loss=stop_loss,
        take_profits=",".join(f"{x:g}" for x in tps),
        weighted_rr=round(rr, 4),
        stop_distance_pct=round(stop_distance_pct, 4),
        structure_score=components["structure"],
        rr_score=components["rr"],
        stop_score=components["stop"],
        liquidity_score=components["liquidity"],
        slippage_score=components["slippage"],
        volatility_score=components["volatility"],
        total_score=total,
        grade=grade,
        decision=decision,
        suggested_account_risk_pct=risk_pct,
        position_notional_per_10000_usdt=round(position_notional, 2),
        hard_rejects="; ".join(hard_rejects),
        warnings="; ".join(warnings),
        reasoning=reasoning,
    )


def create_template() -> None:
    rows = [
        {
            "symbol": "XRPUSDT", "direction": "long", "timeframe": "4H", "entry": 1.4601, "stop_loss": 1.418,
            "take_profits": "1.5288,1.6190,1.7423,1.8665", "tp_weights": "0.30,0.30,0.25,0.15",
            "trendline_break": True, "sr_flip": True, "above_key_ma": True, "market_structure_shift": True, "not_catching_knife": True,
            "stop_type": "structure_failure", "liquidity_tier": "major", "signal_move_pct": 0.0,
            "btc_4h_risk": "neutral", "concurrent_alt_longs": 1, "has_clear_tp": True, "has_clear_sl": True,
            "note": "Trendline break + SR flip sample from screenshot.",
        },
        {
            "symbol": "AVNTUSDT", "direction": "long", "timeframe": "4H", "entry": 0.1554, "stop_loss": 0.1428,
            "take_profits": "0.2291,0.3117", "tp_weights": "0.60,0.40",
            "trendline_break": True, "sr_flip": True, "above_key_ma": True, "market_structure_shift": False, "not_catching_knife": True,
            "stop_type": "prior_low_or_support", "liquidity_tier": "small", "signal_move_pct": 0.0,
            "btc_4h_risk": "neutral", "concurrent_alt_longs": 2, "has_clear_tp": True, "has_clear_sl": True,
            "note": "Small-cap 4H setup; liquidity and volatility capped.",
        },
        {
            "symbol": "CETUSUSDT", "direction": "long", "timeframe": "4H", "entry": 0.0253, "stop_loss": 0.0246,
            "take_profits": "0.0290,0.0340,0.0410", "tp_weights": "0.40,0.35,0.25",
            "trendline_break": False, "sr_flip": True, "above_key_ma": False, "market_structure_shift": True, "not_catching_knife": True,
            "stop_type": "prior_low_or_support", "liquidity_tier": "small", "signal_move_pct": 0.0,
            "btc_4h_risk": "neutral", "concurrent_alt_longs": 3, "has_clear_tp": True, "has_clear_sl": True,
            "note": "Breakout/DCA style call; needs paper-trade validation.",
        },
        {
            "symbol": "INITUSDT", "direction": "long", "timeframe": "1H", "entry": 0.0910, "stop_loss": 0.0883,
            "take_profits": "0.0965,0.1113,0.1333", "tp_weights": "0.50,0.30,0.20",
            "trendline_break": False, "sr_flip": False, "above_key_ma": False, "market_structure_shift": True, "not_catching_knife": False,
            "stop_type": "short_term_low", "liquidity_tier": "small", "signal_move_pct": 0.0,
            "btc_4h_risk": "neutral", "concurrent_alt_longs": 1, "has_clear_tp": True, "has_clear_sl": True,
            "note": "1H scalp; should be penalized even if RR is acceptable.",
        },
    ]
    pd.DataFrame(rows).to_csv(TEMPLATE_CSV, index=False)


def build_report(results: List[ScoreResult], source_path: Path) -> str:
    df = pd.DataFrame([asdict(r) for r in results]).sort_values("total_score", ascending=False)
    counts = df["decision"].value_counts().to_dict()
    avg_score = df["total_score"].mean() if len(df) else 0
    eligible = df[df["decision"].isin(["normal_size", "half_size", "quarter_size"])]

    table_cols = [
        "symbol", "timeframe", "weighted_rr", "stop_distance_pct", "total_score",
        "grade", "decision", "suggested_account_risk_pct", "position_notional_per_10000_usdt", "warnings", "hard_rejects"
    ]
    table_md = df[table_cols].to_markdown(index=False)

    return f"""# Nurse Neil 訊號評分模組接入報告

本報告由 `reports/build_nurse_neil_signal_scoring.py` 產生，目標是把 Nurse Neil 類型的主觀圖形訊號轉換為可重複、可審計、可接入 V6 紙交易流程的 **0–100 分量化評分**。目前版本適合做候選信號源與跟單風控層，不應直接作為自動實盤下單依據。

> 來源資料：`{source_path}`。輸出資料：`{SCORED_CSV}`、`{SUMMARY_JSON}`。

| 指標 | 數值 |
|---|---:|
| 訊號數 | {len(df)} |
| 平均分 | {avg_score:.2f} |
| 可交易訊號數 | {len(eligible)} |
| 正常倉 | {counts.get('normal_size', 0)} |
| 半倉 | {counts.get('half_size', 0)} |
| 四分之一倉 | {counts.get('quarter_size', 0)} |
| 拒絕 | {counts.get('reject', 0)} |

## 評分結果

{table_md}

## 接入判斷

此模組可以加進現有分析系統，但建議以 **外部信號評分層** 方式接入，而不是直接併入 HTR/V6 的自動策略核心。原因是 Nurse Neil 的原始訊號包含人工畫線、SR flip、DCA、TP 顏色標註等主觀元素；這些元素在未建立完整圖形識別與歷史訊號資料庫前，難以做到完全機械化。因此，第一階段應將它作為人工輸入或半自動 OCR 後的訊號評分表，再交給 V6 成本、滑點、紙交易驗收框架驗證。

## 建議接入方式

| 接入層級 | 做法 | 是否建議 |
|---|---|---|
| 獨立信號源 | Telegram/截圖訊號整理成 CSV，使用本模組打分後輸出跟單決策 | 建議，作為第一階段 |
| V6 過濾器 | 只允許 Score ≥ 70、RR ≥ 2、止損距離 ≤ 6%、無 hard reject 的外部訊號進入紙交易 | 建議 |
| 倉位管理層 | 用分數映射每單帳戶風險：90+ 為 1%，70–89 為 0.5%–0.75%，60–69 為 0.25% | 建議 |
| 自動實盤策略 | 直接按 Nurse Neil 訊號自動下單 | 暫不建議 |

## 下一步

下一步若要真正接進前端儀表板，可以新增一個 `NurseNeilPanel` 或併入 `SignalAlertPanel`，後端調用 `server/services/nurseNeilSignalScorer.ts`。若要做回測，則需要至少 100–200 筆歷史訊號，欄位包括訊號時間、入場價、止損、全部 TP、實際觸發結果、最大有利/不利波動、是否因 BTC 4H 風險被過濾，以及扣除 taker fee/slippage 後的結果。
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=TEMPLATE_CSV)
    args = parser.parse_args()

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if not TEMPLATE_CSV.exists():
        create_template()

    source = args.input
    if not source.exists():
        raise FileNotFoundError(f"Input CSV not found: {source}")

    df = pd.read_csv(source)
    results = [score_row(row) for _, row in df.iterrows()]
    scored_df = pd.DataFrame([asdict(r) for r in results]).sort_values("total_score", ascending=False)
    scored_df.to_csv(SCORED_CSV, index=False)

    summary = {
        "source": str(source),
        "scored_csv": str(SCORED_CSV),
        "signal_count": len(results),
        "average_score": float(scored_df["total_score"].mean()) if len(scored_df) else 0.0,
        "decision_counts": scored_df["decision"].value_counts().to_dict() if len(scored_df) else {},
        "results": [asdict(r) for r in results],
    }
    SUMMARY_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_MD.write_text(build_report(results, source), encoding="utf-8")

    print(f"Template: {TEMPLATE_CSV}")
    print(f"Scored CSV: {SCORED_CSV}")
    print(f"Summary JSON: {SUMMARY_JSON}")
    print(f"Report: {REPORT_MD}")


if __name__ == "__main__":
    main()
