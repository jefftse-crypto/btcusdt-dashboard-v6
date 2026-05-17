import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path('/home/ubuntu/btcusdt_dashboard_v6')
REPORTS = ROOT / 'reports'
V3 = json.loads((REPORTS/'htr_v3_multisymbol_backtest_1y.json').read_text(encoding='utf-8'))
V4 = json.loads((REPORTS/'htr_v4_tpv_multisymbol_backtest_1y.json').read_text(encoding='utf-8'))
V5TS = json.loads((REPORTS/'htr_v5_realdata_model_backtest_1y.json').read_text(encoding='utf-8'))
V5META = json.loads((REPORTS/'htr_v5_real_data_meta_model.json').read_text(encoding='utf-8'))
OUT_MD = REPORTS/'htr_v5_realdata_upgrade_final_report.md'
OUT_PNG = REPORTS/'htr_v5_model_comparison.png'

def find_summary(data, name):
    for s in data.get('summaries', []):
        if s.get('config') == name:
            return s
    raise KeyError(name)

def f(x, nd=2):
    if isinstance(x, int):
        return str(x)
    if isinstance(x, float) and x > 900:
        return '∞'
    return f'{x:.{nd}f}'

v3_best = find_summary(V3, 'v3_pool8_quality')
v4_best = find_summary(V4, 'v4_tpv_pool8_elite')
v5_best = find_summary(V5TS, 'v5_real_top4_euus_score78')
v5_alt = find_summary(V5TS, 'v5_real_top4_euus_score75')
explore = V5META['exploratory_best_oos_among_train_passed']
strict = V5META['selected_by_train_only']

rows = [
    ('V3 基线最佳', 'v3_pool8_quality', v3_best['trades'], v3_best['winRate'], v3_best['profitFactor'], v3_best['accountReturnPct'], v3_best['maxDrawdownPct'], '原始最佳，收益最高、频率最高'),
    ('V4 TPV 最佳', 'v4_tpv_pool8_elite', v4_best['trades'], v4_best['winRate'], v4_best['profitFactor'], v4_best['accountReturnPct'], v4_best['maxDrawdownPct'], 'TPV 代理规则，回撤较低但收益下降'),
    ('V5 可复现最佳', 'v5_real_top4_euus_score78', v5_best['trades'], v5_best['winRate'], v5_best['profitFactor'], v5_best['accountReturnPct'], v5_best['maxDrawdownPct'], '真实数据升级脚本，可直接重跑'),
    ('V5 可复现宽松', 'v5_real_top4_euus_score75', v5_alt['trades'], v5_alt['winRate'], v5_alt['profitFactor'], v5_alt['accountReturnPct'], v5_alt['maxDrawdownPct'], '交易较多但胜率/PF 略低'),
    ('V5 探索过滤', 'v3_pool8_quality + top4/eu_us/score75', explore['full']['trades'], explore['full']['winRate'], explore['full']['profitFactor'], explore['full']['accountReturnPct'], explore['full']['maxDrawdownPct'], '样本外表现强，但带探索选择偏差'),
]

labels = ['V3 Best', 'V4 TPV', 'V5 Script 7.8', 'V5 Script 7.5', 'V5 Exploratory']
win = [r[3] for r in rows]
pf = [r[4] for r in rows]
ret = [r[5] for r in rows]
dd = [r[6] for r in rows]

plt.style.use('seaborn-v0_8-whitegrid')
fig, axes = plt.subplots(2, 2, figsize=(13, 8))
metrics = [(win, 'Win Rate %'), (pf, 'Profit Factor'), (ret, 'Account Return %'), (dd, 'Max Drawdown %')]
colors = ['#2E86AB', '#4CAF50', '#F59E0B', '#D64550', '#7C3AED']
for ax, (vals, title) in zip(axes.ravel(), metrics):
    ax.bar(labels, vals, color=colors)
    ax.set_title(title)
    ax.tick_params(axis='x', rotation=25)
    for i, v in enumerate(vals):
        ax.text(i, v + (max(vals)*0.02 if max(vals)>0 else 0.05), f'{v:.2f}', ha='center', fontsize=9)
fig.suptitle('HTR V3 / V4 TPV / V5 Real-Data Model Comparison', fontsize=15, fontweight='bold')
fig.tight_layout(rect=[0, 0.02, 1, 0.95])
fig.savefig(OUT_PNG, dpi=180)
plt.close(fig)

lines = []
lines.append('# HTR V5 真实数据升级模型最终报告\n')
lines.append('作者：**Manus AI**\n')
lines.append('本次升级将现有 V3/V4 TPV 回测进一步推进到 **V5 真实数据模型**。V5 使用项目中已经下载并核验的 Binance USDT-M Futures 15m 月度 K 线 CSV，覆盖 2025-05-01 至 2026-04-30，包含 BTC、ETH、SOL、BNB、XRP、DOGE、LINK 与 AVAX 等 8 个币种。数据来源为 Binance Data Vision 的官方公开行情下载服务。[1]\n')
lines.append('> 结论先行：V5 可复现脚本确实是基于真实行情重新回测，而不是随机或模拟数据。若目标是“最高收益”，V3 `v3_pool8_quality` 仍然领先；若目标是“提高胜率/降低交易噪音”，V5 探索过滤组合可把全样本胜率提高到 75.00%，但该组合存在探索选择偏差，建议作为 V5.1 候选而非立即替代实盘主策略。\n')
lines.append('![HTR V3 V4 V5 模型比较](htr_v5_model_comparison.png)\n')
lines.append('## 一、核心绩效比较\n')
lines.append('| 模型 | 配置 | 交易数 | 胜率 | PF | 账户收益 | 最大回撤 | 判断 |')
lines.append('|---|---|---:|---:|---:|---:|---:|---|')
for model, cfg, trades, wr, pff, retp, mdd, note in rows:
    lines.append(f'| {model} | `{cfg}` | {trades} | {f(wr)}% | {f(pff)} | {f(retp)}% | {f(mdd)}% | {note} |')

lines.append('\n## 二、V5 严格样本外检验\n')
if strict:
    sr = strict['rule']; st = strict['test']; tr = strict['train']; full = strict['full']
    rule_desc = f"配置 `{sr['config']}`，币种 {', '.join(sr['symbols'])}，方向 {', '.join(sr['dirs'])}，最低分 {sr['min_score']}，最大风险距离 {sr['max_risk_pct']}%，时段 {sr['session']}，关键词 {sr['keyword_mode']} {sr['keyword']}"
    lines.append(f'严格按照训练段 2025-05 至 2025-12 选择出的规则为：**{rule_desc}**。这个规则在训练段表现非常强，胜率 {f(tr["winRate"])}%、PF {f(tr["profitFactor"])}，但在 2026-01 至 2026-04 样本外测试段仅有 {st["trades"]} 笔、胜率 {f(st["winRate"])}%、PF {f(st["profitFactor"])}、收益 {f(st["accountReturnPct"])}%。这说明单纯追求训练段最优会出现明显过拟合。\n')
    lines.append('| 区间 | 交易数 | 胜率 | PF | 收益 | 最大回撤 | 期望R |')
    lines.append('|---|---:|---:|---:|---:|---:|---:|')
    for name, m in [('训练段', tr), ('测试段', st), ('全样本', full)]:
        lines.append(f'| {name} | {m["trades"]} | {f(m["winRate"])}% | {f(m["profitFactor"])} | {f(m["accountReturnPct"])}% | {f(m["maxDrawdownPct"])}% | {f(m["expectancyR"],3)} |')

lines.append('\n## 三、V5 可复现脚本结果\n')
lines.append('为了避免只在报告层面筛选交易，本次已新增 `server/backtest_htr_v5_realdata_model.ts`。该脚本复用 V3 的真实行情信号引擎，但将交易池收敛到 BTC/ETH/BNB/XRP、EU-US 活跃时段，并提高最低评分门槛。脚本运行后生成独立 JSON 与 Markdown 结果，便于在新环境中重新验证。\n')
lines.append('| V5 可复现配置 | 交易数 | 胜率 | PF | 账户收益 | 最大回撤 |')
lines.append('|---|---:|---:|---:|---:|---:|')
for s in V5TS.get('summaries', []):
    lines.append(f'| `{s["config"]}` | {s["trades"]} | {f(s["winRate"])}% | {f(s["profitFactor"])} | {f(s["accountReturnPct"])}% | {f(s["maxDrawdownPct"])}% |')

lines.append('\n## 四、是否已经“改良胜率”\n')
lines.append('从全样本看，V5 探索过滤组合的胜率达到 **75.00%**，高于 V3 的 64.94%，同时 PF 提升到 3.10，最大回撤降至 1.57%。不过，这个组合是在训练合格集合中再观察测试段表现得到，严格来说仍有选择偏差。相比之下，V5 可复现脚本最高胜率为 **61.22%**，没有超过 V3 的 64.94%，但它提供了一套可以直接执行的真实行情升级基线。\n')
lines.append('因此，目前最稳健的结论是：**V3 继续作为主策略，V5 作为低频高质量候选池与 V5.1 的参数起点**。若要真正提高可实盘信任度，下一步不应继续在已有交易明细上筛选，而应引入更丰富的真实数据字段，例如资金费率、持仓量、主动买卖量、盘口深度或多空账户比，并把 TPV 的第三触线/支点识别改成真实 swing pivot 结构。\n')
lines.append('## 五、新环境继续运行命令\n')
lines.append('在新环境解压项目并安装依赖后，可用以下命令复现实验：\n')
lines.append('```bash\ncd btcusdt_dashboard_v6\npnpm install\npnpm exec tsx server/backtest_htr_v5_realdata_model.ts\npython3.11 reports/build_v5_real_data_meta_model.py\npython3.11 reports/build_v5_final_comparison_report.py\n```\n')
lines.append('## References\n')
lines.append('[1]: https://data.binance.vision/ "Binance Data Vision"\n')
OUT_MD.write_text('\n'.join(lines), encoding='utf-8')
print(OUT_MD)
print(OUT_PNG)
