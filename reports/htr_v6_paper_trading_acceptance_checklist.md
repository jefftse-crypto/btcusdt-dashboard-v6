# HTR V6 Paper Trading and Pre-Live Acceptance Checklist

本文档定义 HTR 从 V6 成本复算与样本外验证进入纸交易、再进入小资金实盘前的验收标准。它的目标不是证明策略一定可盈利，而是把“回测看起来不错”转换为“每一笔交易都能被真实执行条件审计”的流程。

## 1. Go/No-Go Gate

| Gate | Required Evidence | Pass Threshold | Current V6 Status |
|---|---|---:|---|
| Cost-adjusted profitability | Base taker cost summary | PF > 1.05 and net return > 0 | Marginal pass for `v3_pool8_quality`: PF 1.14, net return 3.68%. |
| Out-of-sample survival | 2026-01 to 2026-04 OOS | PF > 1.00 and net return > 0 | Marginal pass: PF 1.11, net return 1.08%. |
| Stress robustness | Combined stress scenario | Prefer net return > 0; otherwise classify as fragile | Not passed: combined stress return is negative. |
| Execution auditability | Paper trade log | 100% of signals logged with timestamp, intended price, executable price and reason for skip | Not started. |
| Risk containment | Max daily/weekly loss rules | Hard stop rules implemented before live | To be implemented in paper trading rules. |

> V6 的结论是“可以进入纸交易验证”，但**不应直接进入真实资金自动化交易**。原因是 base taker 口径仅为边际通过，而 combined stress 已转负，说明策略对手续费、滑点与资金费率代理成本高度敏感。

## 2. Paper Trading Rules

| Rule Area | Required Rule |
|---|---|
| Duration | Minimum 30 calendar days, preferred 60 days if signal frequency is lower than expected. |
| Minimum Trades | At least 30 executable signals before considering any live deployment. |
| Signal Logging | Every raw signal must be logged, including skipped signals. Missing logs invalidate the period. |
| Execution Price | Record decision price, simulated fill price, bid/ask or mark price if available, and slippage in bps. |
| Order Type | Separate maker-intended and taker-executed trades; do not blend them into one fill quality metric. |
| Funding | Record actual funding accrual by symbol and direction whenever the position crosses a funding timestamp. |
| Risk Per Trade | Keep paper sizing equivalent to 0.35% account risk per trade to match the V3/V6 evaluation basis. |
| Max Simultaneous Exposure | Track aggregate notional-to-equity across symbols and cap correlated crypto exposure. |
| Daily Stop | Stop new entries for the day if realized paper PnL falls below -1.0% account equivalent. |
| Weekly Stop | Stop new entries for the week if realized paper PnL falls below -2.5% account equivalent. |
| Manual Overrides | Any discretionary skip or exit must include a written reason, otherwise it cannot be used to improve the system. |

## 3. Paper Trade Log Schema

| Field | Type | Description |
|---|---|---|
| `signal_id` | string | Deterministic ID using symbol, timeframe, signal timestamp and direction. |
| `created_at_utc` | datetime | Time when the signal was generated. |
| `symbol` | string | Trading pair, such as `BTCUSDT`. |
| `direction` | string | `long` or `short`. |
| `strategy_config` | string | Fixed configuration, currently `v3_pool8_quality`. |
| `score` | number | Final signal score at decision time. |
| `entry_plan` | number | Planned entry price from strategy. |
| `stop_plan` | number | Planned stop price from strategy. |
| `targets_plan` | string | Serialized targets and partial exits. |
| `decision_mark_price` | number | Market/mark price at decision time. |
| `paper_fill_price` | number | Fill price used in paper trading. |
| `fill_slippage_bps` | number | Difference between planned entry and paper fill. |
| `order_type_assumption` | string | `maker`, `taker`, or `missed`. |
| `skip_reason` | string | Required if no paper trade is opened. |
| `exit_time_utc` | datetime | Exit timestamp. |
| `exit_price` | number | Paper exit price. |
| `fees_account_pct` | number | Fee impact as account percentage points. |
| `funding_account_pct` | number | Funding impact as account percentage points. |
| `net_account_pct` | number | Net paper PnL after costs. |
| `notes` | string | Human-readable rationale and anomalies. |

## 4. Advancement Criteria After Paper Trading

| Criterion | Required Result |
|---|---:|
| Paper PF | Greater than 1.10 after all fees, slippage and funding. |
| Paper net account return | Positive over the paper period. |
| Paper max drawdown | Lower than the V6 OOS max drawdown scaled to the same trade count, or explicitly explained by market regime. |
| Average realized slippage | No worse than V6 base assumption by more than 1 bps per side. |
| Fill ratio | At least 70% of strategy-intended trades executable without materially worse price. |
| Log completeness | 100% signal coverage, including skipped signals. |
| Operational errors | Zero unresolved cases of duplicated entries, missed stops, or stale data decisions. |

If these criteria are not met, the correct response is not to optimize parameters immediately. The first response should be to classify the failure into one of three causes: signal edge decay, execution cost underestimation, or operational implementation error. Only signal edge decay justifies returning to model design; execution or operational failures require infrastructure fixes before more optimization.

## 5. Small-Live Pilot Rules

A small-live pilot should begin only after the paper trading criteria are met. The initial pilot should use materially smaller risk than the research setting, such as 10% to 25% of the modeled 0.35% account risk per trade. The pilot must retain the same logging schema as paper trading and must not introduce discretionary improvements that are absent from the backtest. The objective of the first live stage is **execution validation**, not maximizing profit.

| Pilot Control | Rule |
|---|---|
| Starting risk | 0.035% to 0.0875% account risk per trade. |
| Minimum duration | 30 days or 30 trades, whichever is later. |
| Escalation | Increase risk only if live cost-adjusted PF > 1.05 and logs are complete. |
| Emergency stop | Disable new entries after any unhandled system, exchange, or data error. |
| Review cadence | Weekly review of slippage, funding, skipped trades and rule compliance. |

## 6. Immediate Next Tasks

| Priority | Task | Purpose |
|---:|---|---|
| 1 | Add historical Binance `fundingRate` joins by symbol and timestamp. | Replace the conservative fixed funding proxy with direction-aware actual funding. |
| 2 | Build paper-trade logger using the schema above. | Ensure every signal is auditable before deployment. |
| 3 | Add bid/ask or order-book snapshot collection if available. | Verify whether base slippage assumptions are realistic. |
| 4 | Add daily/weekly risk lockout to the execution layer. | Prevent a valid strategy from failing due to uncontrolled operational risk. |
| 5 | Re-run V6 monthly after each new month of data. | Maintain rolling evidence instead of relying on one static backtest. |
