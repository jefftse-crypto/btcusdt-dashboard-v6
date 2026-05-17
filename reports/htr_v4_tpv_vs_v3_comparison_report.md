# TPV 启发式改良 V4 回测对比报告

作者：**Manus AI**

本报告根据用户提供的青岚 TPV 页面与聊天截图，将其中可量化的思想做成 V3 策略之后的结构质量过滤层，并以 2025-05-01 至 2026-04-30 的 Binance Data Vision USDT-M 15m K 线进行一年回测。需要强调的是，截图中的「新闻、情绪、主观波浪支点」无法完全用现有 K 线数据复刻，因此 V4 使用的是 TPV 的可程式化代理规则，而非原版人工/机器人完整信号。

> 结论先行：**TPV 启发式规则没有全面提高现有 V3 最佳组合的胜率**。V3 最佳 `v3_pool8_quality` 胜率为 64.94%、PF 为 1.82、账户收益为 17.35%。V4 TPV 最佳组合 `v4_tpv_pool8_elite` 胜率为 63.41%、PF 为 1.66、账户收益为 7.69%。TPV 对回撤有一定改善，但以目前代理规则看，会牺牲交易频率与收益，尚不能替代 V3。

## 一、TPV 规则如何落地为程式化条件

| TPV 截图/网页特征 | V4 可程式化代理 | 设计目的 |
|---|---|---|
| 趋势项：4H/1H/15m 均线方向一致 | 保留 V3 4H 定方向与 1H 状态确认，并增加 15m EMA50 与 1H EMA50 斜率同向 | 避免逆大周期交易。 |
| 位置项 P：接近关键支撑/压力 | 入场价必须接近 EMA50/VWAP 动态支点，且 K 线高低点触及该区域 | 模拟截图中“入场位接近斐波那契关键位/压力位附近”。 |
| 第三触点/TPV | 最近 72 根 15m 内至少 3 次触碰 EMA50/VWAP 动态支撑或压力，并要求触点间隔 | 模拟“第三次触点后顺势入场”。 |
| 收线确认 | 多头收在 K 线 55% 以上且阳线；空头收在 45% 以下且阴线 | 避免只碰位但未确认的假信号。 |
| 量能/CVD | CVD 6/16/32 根同向，成交量实体合格 | 保留 V3 量价确认。 |
| 盈亏比 | TPV 版最低 RR 提高至 2.4–2.8 | 对齐截图中常见 2.72、3.35、4.55 的盈亏比。 |

## 二、核心绩效对比

| 版本/配置 | 实际交易 | 天/笔 | 胜率 | PF | 期望值 | 账户收益 | 最大回撤 |
|---|---:|---:|---:|---:|---:|---:|---:|
| V3 最佳：v3_pool8_quality | 154 | 2.37 | 64.94% | 1.82 | 0.322R | 17.35% | 3.02% |
| V4 TPV 最佳：v4_tpv_pool8_elite | 82 | 4.45 | 63.41% | 1.66 | 0.268R | 7.69% | 2.40% |
| v4_tpv_pool8_quality | 135 | 2.70 | 57.78% | 1.21 | 0.100R | 4.72% | 2.91% |
| v4_tpv_pool8_strict | 98 | 3.72 | 62.24% | 1.54 | 0.224R | 7.69% | 1.89% |
| v4_tpv_pool8_elite | 82 | 4.45 | 63.41% | 1.66 | 0.268R | 7.69% | 2.40% |
| v4_tpv_best2_quality | 80 | 4.56 | 62.50% | 1.50 | 0.213R | 5.96% | 2.53% |
| v4_tpv_best3_elite | 78 | 4.68 | 61.54% | 1.61 | 0.258R | 7.05% | 1.90% |
| v4_tpv_best4_quality | 120 | 3.04 | 61.67% | 1.49 | 0.210R | 8.84% | 2.71% |

从表中可以看到，V4 TPV 的严格过滤确实减少了交易数量，并将最大回撤压低到约 1.89%–2.71% 区间，但胜率与 PF 没有超过 V3 最佳版本。尤其 `v4_tpv_pool8_elite` 的交易频率降至约 4.45 天一笔，收益也从 V3 的 17.35% 降至 7.69%。这说明 TPV 代理规则更像是**保守降频过滤器**，而不是当前数据下的胜率增益器。

## 三、筛选分析与可用发现

对 V4 已执行交易进行分层观察后，较值得保留的线索是：BNB、BTC、XRP 的 TPV 代理信号明显优于 ETH、SOL、DOGE、LINK。以执行后交易样本观察，BNB+XRP 子集可达到 66.67% 胜率、PF 1.82，但重新做实际组合回测后，`v4_tpv_best2_quality` 只有 62.50% 胜率，说明单纯事后挑币存在样本偏差，不能直接当作可交易结论。

| 观察项 | 结果 | 解读 |
|---|---:|---|
| V4 pool8_quality 中 XRP 单币 | 73.33% 胜率，15 笔 | 样本太少，只能作为候选观察。 |
| V4 pool8_quality 中 BNB 单币 | 64.29% 胜率，42 笔 | 与 V3 最佳接近，是较稳定候选。 |
| V4 pool8_quality 多头 | 61.90% 胜率 | 多头明显优于空头，但仍低于 V3 最佳。 |
| V4 pool8_quality 空头 | 54.17% 胜率 | TPV 空头代理对现有数据不够有效。 |
| 实际 best2 组合回测 | 62.50% 胜率，PF 1.50 | 事后筛选优势在重新组合时减弱。 |

## 四、结论与建议

目前不建议把 TPV V4 直接替换为主策略。更稳妥的做法是保留 V3 `v3_pool8_quality` 作为主线，因为它在一年数据中同时拥有较高胜率、PF、收益与可接受回撤。TPV 规则可以作为后续 V4.1 的研究方向，但应调整实现方式：第一，改用真正的局部高低点/斐波那契支点，而不是 EMA50/VWAP 代理；第二，引入资金费率、OI、真实订单流或新闻情绪数据，以更接近截图中的“量能项、风险调整、新闻项”；第三，单独研究 BNB、BTC、XRP 三个币种，并避免把 DOGE、SOL、LINK 纳入 TPV 组合。

如果下一步继续优化，我建议做 **V4.1 结构支点版**：用 swing high/low 建立支撑压力线，检测第三次触线，要求入场价距离结构线小于 0.35 ATR，并把空头规则单独降权或暂时移除。这样更贴近 TPV 的“关键位第三触点”，也比当前 EMA/VWAP 代理更有机会改善胜率。

## 五、相关输出文件

| 文件 | 用途 |
|---|---|
| `server/backtest_htr_v4_tpv_multisymbol.ts` | V4 TPV 启发式回测脚本。 |
| `reports/htr_v4_tpv_multisymbol_backtest_1y.json` | V4 完整 JSON，含各配置交易明细。 |
| `reports/htr_v4_tpv_multisymbol_backtest_1y.md` | V4 自动摘要报告。 |
| `reports/tpv_strategy_notes.md` | TPV 网页与截图规则整理。 |
| `reports/tpv_integration_design.md` | TPV 接入 V3 的设计说明。 |
| `reports/tpv_filter_analysis.txt` | 分币种、分方向、分评分筛选分析。 |

## 附录：筛选分析原文摘录

```text
BASELINE V3 BEST
v3_pool8_quality                        154  64.94% PF  1.82 Exp  0.322R Total   49.58R AvgScore  8.05

V4 CONFIGS
v4_tpv_core4_quality                    114  56.14% PF  1.15 Exp  0.074R Total    8.43R AvgScore 10.62
v4_tpv_core4_strict                      82  57.32% PF  1.25 Exp  0.119R Total    9.75R AvgScore 10.50
v4_tpv_pool8_quality                    135  57.78% PF  1.21 Exp  0.100R Total   13.50R AvgScore 10.53
v4_tpv_pool8_strict                      98  62.24% PF  1.54 Exp  0.224R Total   21.97R AvgScore 10.50
v4_tpv_pool8_elite                       82  63.41% PF  1.66 Exp  0.268R Total   21.98R AvgScore 10.48

V4 pool8_quality BY SYMBOL
AVAXUSDT                                 10  60.00% PF  1.12 Exp  0.052R Total    0.52R AvgScore 10.21
BNBUSDT                                  42  64.29% PF  1.64 Exp  0.258R Total   10.85R AvgScore 10.63
BTCUSDT                                  34  61.76% PF  1.56 Exp  0.235R Total    7.99R AvgScore 10.73
DOGEUSDT                                  8  37.50% PF  0.45 Exp -0.383R Total   -3.07R AvgScore 10.23
ETHUSDT                                  16  50.00% PF  0.88 Exp -0.065R Total   -1.04R AvgScore 10.57
LINKUSDT                                  2   0.00% PF  0.00 Exp -1.105R Total   -2.21R AvgScore 10.82
SOLUSDT                                   8  25.00% PF  0.09 Exp -0.783R Total   -6.27R AvgScore 10.24
XRPUSDT                                  15  73.33% PF  2.53 Exp  0.448R Total    6.71R AvgScore 10.23

V4 pool8_quality BY DIRECTION
long                                     63  61.90% PF  1.43 Exp  0.181R Total   11.37R AvgScore 10.62
short                                    72  54.17% PF  1.06 Exp  0.030R Total    2.12R AvgScore 10.45

V4 pool8_quality SCORE/RISK FILTERS
score>=8.2                              135  57.78% PF  1.21 Exp  0.100R Total   13.50R AvgScore 10.53
score>=8.6                              135  57.78% PF  1.21 Exp  0.100R Total   13.50R AvgScore 10.53
score>=9.0                              127  57.48% PF  1.23 Exp  0.109R Total   13.90R AvgScore 10.65
score>=9.4                              106  56.60% PF  1.20 Exp  0.098R Total   10.40R AvgScore 10.91
score>=9.8                              105  57.14% PF  1.23 Exp  0.110R Total   11.52R AvgScore 10.93
score>=10.2                              89  57.30% PF  1.24 Exp  0.118R Total   10.48R AvgScore 11.12
risk<=0.50%                              21  42.86% PF  0.78 Exp -0.151R Total   -3.18R AvgScore 10.64
risk<=0.60%                              37  54.05% PF  1.09 Exp  0.052R Total    1.91R AvgScore 10.58
risk<=0.70%                              61  55.74% PF  1.20 Exp  0.101R Total    6.19R AvgScore 10.45
risk<=0.80%                              99  58.59% PF  1.23 Exp  0.108R Total   10.68R AvgScore 10.46

SYMBOL SUBSET SEARCH ON EXECUTED V4 pool8_quality TRADES
BNBUSDT,XRPUSDT                          57  66.67% PF  1.82 Exp  0.308R Total   17.56R AvgScore 10.53
AVAXUSDT,BNBUSDT,XRPUSDT                 67  65.67% PF  1.70 Exp  0.270R Total   18.08R AvgScore 10.48
BTCUSDT,XRPUSDT                          49  65.31% PF  1.79 Exp  0.300R Total   14.70R AvgScore 10.57
BNBUSDT,BTCUSDT,XRPUSDT                  91  64.84% PF  1.72 Exp  0.281R Total   25.55R AvgScore 10.60
AVAXUSDT,BTCUSDT,XRPUSDT                 59  64.41% PF  1.66 Exp  0.258R Total   15.23R AvgScore 10.51
BNBUSDT,LINKUSDT,XRPUSDT                 59  64.41% PF  1.65 Exp  0.260R Total   15.35R AvgScore 10.54
AVAXUSDT,BNBUSDT,BTCUSDT,XRPUSDT        101  64.36% PF  1.65 Exp  0.258R Total   26.08R AvgScore 10.56
BNBUSDT                                  42  64.29% PF  1.64 Exp  0.258R Total   10.85R AvgScore 10.63
AVAXUSDT,BNBUSDT,LINKUSDT,XRPUSDT        69  63.77% PF  1.56 Exp  0.230R Total   15.87R AvgScore 10.49
AVAXUSDT,BNBUSDT                         52  63.46% PF  1.53 Exp  0.219R Total   11.37R AvgScore 10.55
BNBUSDT,BTCUSDT,LINKUSDT,XRPUSDT         93  63.44% PF  1.62 Exp  0.251R Total   23.34R AvgScore 10.60
BNBUSDT,BTCUSDT                          76  63.16% PF  1.60 Exp  0.248R Total   18.84R AvgScore 10.67
AVAXUSDT,BNBUSDT,BTCUSDT,LINKUSDT,XRPUSDT  103  63.11% PF  1.56 Exp  0.232R Total   23.86R AvgScore 10.57
BNBUSDT,DOGEUSDT,XRPUSDT                 65  63.08% PF  1.54 Exp  0.223R Total   14.50R AvgScore 10.49
BNBUSDT,ETHUSDT,XRPUSDT                  73  63.01% PF  1.54 Exp  0.226R Total   16.53R AvgScore 10.54
AVAXUSDT,BNBUSDT,BTCUSDT                 86  62.79% PF  1.54 Exp  0.225R Total   19.36R AvgScore 10.62
BTCUSDT,LINKUSDT,XRPUSDT                 51  62.75% PF  1.60 Exp  0.245R Total   12.49R AvgScore 10.58
AVAXUSDT,BNBUSDT,DOGEUSDT,XRPUSDT        75  62.67% PF  1.48 Exp  0.200R Total   15.02R AvgScore 10.45
AVAXUSDT,BNBUSDT,ETHUSDT,XRPUSDT         83  62.65% PF  1.49 Exp  0.205R Total   17.05R AvgScore 10.50
BNBUSDT,BTCUSDT,DOGEUSDT,XRPUSDT         99  62.63% PF  1.55 Exp  0.227R Total   22.49R AvgScore 10.57
```
