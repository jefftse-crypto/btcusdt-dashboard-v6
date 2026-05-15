# V6 Live-Cost Stress Test Report

本报告基于 `htr_v3_multisymbol_backtest_1y.json` 中的逐笔交易明细，对原始 HTR V3 回测结果做**实盘成本复算**。复算逻辑并不重新优化参数，而是用相同信号与出场记录叠加手续费、滑点与资金费率代理成本，因此更适合评估策略从理想回测走向纸交易前的可信度缺口。

> 关键结论：以 `v3_pool8_quality` 为 V3 基准配置时，原始总账户收益为 **17.35%**；纳入 base taker 成本后降至 **3.68%**，胜率为 **61.04%**，PF 为 **1.14**，最大回撤为 **4.99%**。在 combined stress 场景下，账户收益为 **-6.48%**。

## Cost Model

| Component | Base Assumption | Conservative Interpretation |
|---|---:|---|
| Fee | 5 bps per side | Binance USDS-M VIP0 taker-style proxy; maker case is separately listed. |
| Slippage | 3 bps per side | Applied to both entry and exit, independent of direction. |
| Funding | 1 bps per 8h | Historical funding files are not yet loaded, so this version treats funding as a conservative cost proxy. |
| Position Size | `riskPerTrade / riskPct` | Notional-to-equity is inferred from fixed account risk and stop distance, capped by leverage hint when present. |

## Focus Configuration Stress Table

| scenario        |   trades |   win_rate_pct |   profit_factor |   net_account_return_pct |   cost_drag_pct_points |   max_drawdown_pct |   avg_cost_account_pct |   avg_holding_hours |
|:----------------|---------:|---------------:|----------------:|-------------------------:|-----------------------:|-------------------:|-----------------------:|--------------------:|
| gross_no_cost   |      154 |          64.94 |            1.82 |                    17.35 |                   0    |               2.98 |                   0    |                5.95 |
| maker_low_cost  |      154 |          63.64 |            1.44 |                    10.51 |                   6.84 |               3.79 |                   0.04 |                5.95 |
| base_taker_cost |      154 |          61.04 |            1.14 |                     3.68 |                  13.68 |               4.99 |                   0.09 |                5.95 |
| high_slippage   |      154 |          57.79 |            0.96 |                    -1.24 |                  18.59 |               6.02 |                   0.12 |                5.95 |
| fee_1p5x        |      154 |          57.79 |            0.99 |                    -0.42 |                  17.77 |               5.85 |                   0.12 |                5.95 |
| funding_3x      |      154 |          60.39 |            1.09 |                     2.52 |                  14.83 |               5.19 |                   0.1  |                5.95 |
| combined_stress |      154 |          53.9  |            0.79 |                    -6.48 |                  23.84 |               7.13 |                   0.15 |                5.95 |

## Base-Cost Ranking Across Configurations

| config             |   trades |   win_rate_pct |   profit_factor |   net_account_return_pct |   cost_drag_pct_points |   max_drawdown_pct |
|:-------------------|---------:|---------------:|----------------:|-------------------------:|-----------------------:|-------------------:|
| v3_pool8_quality   |      154 |          61.04 |            1.14 |                     3.68 |                  13.68 |               4.99 |
| v3_core4_quality   |      135 |          58.52 |            0.98 |                    -0.4  |                  12.41 |               5.42 |
| v3_core4_strict    |       89 |          51.69 |            0.65 |                    -6.68 |                   8.74 |               7.09 |
| v3_pool8_strict    |      103 |          51.46 |            0.63 |                    -8.24 |                   9.95 |               8.54 |
| v3_pool8_frequency |      178 |          53.37 |            0.77 |                    -8.99 |                  16.15 |               9.58 |
| v3_core4_frequency |      155 |          53.55 |            0.72 |                    -9.48 |                  14.57 |               9.63 |

## Interpretation

V6 的主要发现是：HTR 的毛利空间对成本具有显著敏感性，尤其是止损距离较窄、名义仓位倍数较高的交易，双边 taker 手续费与滑点会明显压缩原有 R 值。`base_taker_cost` 是纸交易前更应关注的主口径，因为它不依赖过度乐观的挂单成交假设。若策略在该口径下仍能保持 PF 大于 1、回撤可控，并在样本外验证中保持稳定，才有资格进入纸交易阶段。

`funding_3x` 与 `combined_stress` 并不是对真实历史 funding 的替代，而是**缺数据状态下的保守压力代理**。下一阶段应从 Binance Data Vision 补齐 `fundingRate` 历史文件，并按 `symbol/time/dir` 对每笔持仓期间的实际资金费率逐条累加。届时 long/short 的 funding 可能为正也可能为负，结果会比当前“全部视为成本”的版本更贴近真实。

## Generated Files

| File | Purpose |
|---|---|
| `htr_v6_live_cost_stress_results.json` | Full V6 scenario summary and metadata. |
| `htr_v6_live_cost_stress_summary.csv` | Tabular scenario summary for spreadsheet review. |
| `htr_v6_live_cost_stress_trades.csv` | Trade-level cost repricing records. |
| `htr_v6_cost_stress_account_return.png` | English-label chart for account return under cost stress. |

![V6 Cost Stress Account Return](htr_v6_cost_stress_account_return.png)
