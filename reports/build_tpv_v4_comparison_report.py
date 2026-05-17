import json
from pathlib import Path

root=Path('/home/ubuntu/btcusdt_dashboard_v6')
reports=root/'reports'
v3=json.loads((reports/'htr_v3_multisymbol_backtest_1y.json').read_text())
v4=json.loads((reports/'htr_v4_tpv_multisymbol_backtest_1y.json').read_text())
filter_text=(reports/'tpv_filter_analysis.txt').read_text()

def row(label, s):
    return f"| {label} | {s['trades']} | {s['daysPerTrade']:.2f} | {s['winRate']:.2f}% | {s['profitFactor']:.2f} | {s['expectancyR']:.3f}R | {s['accountReturnPct']:.2f}% | {s['maxDrawdownPct']:.2f}% |"

v3best=v3['best']
v4best=v4['best']
selected=['v4_tpv_pool8_quality','v4_tpv_pool8_strict','v4_tpv_pool8_elite','v4_tpv_best2_quality','v4_tpv_best3_elite','v4_tpv_best4_quality']
by_cfg={s['config']:s for s in v4['summaries']}

md=[]
md.append('# TPV 启发式改良 V4 回测对比报告\n')
md.append('作者：**Manus AI**\n')
md.append('本报告根据用户提供的青岚 TPV 页面与聊天截图，将其中可量化的思想做成 V3 策略之后的结构质量过滤层，并以 2025-05-01 至 2026-04-30 的 Binance Data Vision USDT-M 15m K 线进行一年回测。需要强调的是，截图中的「新闻、情绪、主观波浪支点」无法完全用现有 K 线数据复刻，因此 V4 使用的是 TPV 的可程式化代理规则，而非原版人工/机器人完整信号。\n')
md.append('> 结论先行：**TPV 启发式规则没有全面提高现有 V3 最佳组合的胜率**。V3 最佳 `v3_pool8_quality` 胜率为 64.94%、PF 为 1.82、账户收益为 17.35%。V4 TPV 最佳组合 `v4_tpv_pool8_elite` 胜率为 63.41%、PF 为 1.66、账户收益为 7.69%。TPV 对回撤有一定改善，但以目前代理规则看，会牺牲交易频率与收益，尚不能替代 V3。\n')
md.append('## 一、TPV 规则如何落地为程式化条件\n')
md.append('| TPV 截图/网页特征 | V4 可程式化代理 | 设计目的 |\n|---|---|---|\n| 趋势项：4H/1H/15m 均线方向一致 | 保留 V3 4H 定方向与 1H 状态确认，并增加 15m EMA50 与 1H EMA50 斜率同向 | 避免逆大周期交易。 |\n| 位置项 P：接近关键支撑/压力 | 入场价必须接近 EMA50/VWAP 动态支点，且 K 线高低点触及该区域 | 模拟截图中“入场位接近斐波那契关键位/压力位附近”。 |\n| 第三触点/TPV | 最近 72 根 15m 内至少 3 次触碰 EMA50/VWAP 动态支撑或压力，并要求触点间隔 | 模拟“第三次触点后顺势入场”。 |\n| 收线确认 | 多头收在 K 线 55% 以上且阳线；空头收在 45% 以下且阴线 | 避免只碰位但未确认的假信号。 |\n| 量能/CVD | CVD 6/16/32 根同向，成交量实体合格 | 保留 V3 量价确认。 |\n| 盈亏比 | TPV 版最低 RR 提高至 2.4–2.8 | 对齐截图中常见 2.72、3.35、4.55 的盈亏比。 |\n')
md.append('## 二、核心绩效对比\n')
md.append('| 版本/配置 | 实际交易 | 天/笔 | 胜率 | PF | 期望值 | 账户收益 | 最大回撤 |\n|---|---:|---:|---:|---:|---:|---:|---:|')
md.append(row('V3 最佳：v3_pool8_quality', v3best))
md.append(row('V4 TPV 最佳：'+v4best['config'], v4best))
for name in selected:
    md.append(row(name, by_cfg[name]))
md.append('\n从表中可以看到，V4 TPV 的严格过滤确实减少了交易数量，并将最大回撤压低到约 1.89%–2.71% 区间，但胜率与 PF 没有超过 V3 最佳版本。尤其 `v4_tpv_pool8_elite` 的交易频率降至约 4.45 天一笔，收益也从 V3 的 17.35% 降至 7.69%。这说明 TPV 代理规则更像是**保守降频过滤器**，而不是当前数据下的胜率增益器。\n')
md.append('## 三、筛选分析与可用发现\n')
md.append('对 V4 已执行交易进行分层观察后，较值得保留的线索是：BNB、BTC、XRP 的 TPV 代理信号明显优于 ETH、SOL、DOGE、LINK。以执行后交易样本观察，BNB+XRP 子集可达到 66.67% 胜率、PF 1.82，但重新做实际组合回测后，`v4_tpv_best2_quality` 只有 62.50% 胜率，说明单纯事后挑币存在样本偏差，不能直接当作可交易结论。\n')
md.append('| 观察项 | 结果 | 解读 |\n|---|---:|---|\n| V4 pool8_quality 中 XRP 单币 | 73.33% 胜率，15 笔 | 样本太少，只能作为候选观察。 |\n| V4 pool8_quality 中 BNB 单币 | 64.29% 胜率，42 笔 | 与 V3 最佳接近，是较稳定候选。 |\n| V4 pool8_quality 多头 | 61.90% 胜率 | 多头明显优于空头，但仍低于 V3 最佳。 |\n| V4 pool8_quality 空头 | 54.17% 胜率 | TPV 空头代理对现有数据不够有效。 |\n| 实际 best2 组合回测 | 62.50% 胜率，PF 1.50 | 事后筛选优势在重新组合时减弱。 |\n')
md.append('## 四、结论与建议\n')
md.append('目前不建议把 TPV V4 直接替换为主策略。更稳妥的做法是保留 V3 `v3_pool8_quality` 作为主线，因为它在一年数据中同时拥有较高胜率、PF、收益与可接受回撤。TPV 规则可以作为后续 V4.1 的研究方向，但应调整实现方式：第一，改用真正的局部高低点/斐波那契支点，而不是 EMA50/VWAP 代理；第二，引入资金费率、OI、真实订单流或新闻情绪数据，以更接近截图中的“量能项、风险调整、新闻项”；第三，单独研究 BNB、BTC、XRP 三个币种，并避免把 DOGE、SOL、LINK 纳入 TPV 组合。\n')
md.append('如果下一步继续优化，我建议做 **V4.1 结构支点版**：用 swing high/low 建立支撑压力线，检测第三次触线，要求入场价距离结构线小于 0.35 ATR，并把空头规则单独降权或暂时移除。这样更贴近 TPV 的“关键位第三触点”，也比当前 EMA/VWAP 代理更有机会改善胜率。\n')
md.append('## 五、相关输出文件\n')
md.append('| 文件 | 用途 |\n|---|---|\n| `server/backtest_htr_v4_tpv_multisymbol.ts` | V4 TPV 启发式回测脚本。 |\n| `reports/htr_v4_tpv_multisymbol_backtest_1y.json` | V4 完整 JSON，含各配置交易明细。 |\n| `reports/htr_v4_tpv_multisymbol_backtest_1y.md` | V4 自动摘要报告。 |\n| `reports/tpv_strategy_notes.md` | TPV 网页与截图规则整理。 |\n| `reports/tpv_integration_design.md` | TPV 接入 V3 的设计说明。 |\n| `reports/tpv_filter_analysis.txt` | 分币种、分方向、分评分筛选分析。 |\n')
md.append('## 附录：筛选分析原文摘录\n')
md.append('```text\n'+filter_text[:6000]+'\n```\n')

(reports/'htr_v4_tpv_vs_v3_comparison_report.md').write_text('\n'.join(md))
print(reports/'htr_v4_tpv_vs_v3_comparison_report.md')
