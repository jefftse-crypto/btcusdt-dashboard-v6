from pathlib import Path
p = Path('/home/ubuntu/btcusdt_dashboard_v6/server/backtest_htr_v5_realdata_model.ts')
s = p.read_text(encoding='utf-8')
old = """  const configs:Cfg[]=[\n    {name:'v3_core4_quality', symbols:core4, score:7.0, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'asia_eu_us', cooldownHours:0},\n    {name:'v3_core4_frequency', symbols:core4, score:6.5, minRr:1.8, minRiskPct:0.0014, maxRiskPct:0.009, session:'asia_eu_us', cooldownHours:0},\n    {name:'v3_core4_strict', symbols:core4, score:7.4, minRr:2.1, minRiskPct:0.0016, maxRiskPct:0.008, session:'eu_us', cooldownHours:4},\n    {name:'v3_pool8_quality', symbols:pool8, score:7.0, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'asia_eu_us', cooldownHours:0},\n    {name:'v3_pool8_frequency', symbols:pool8, score:6.5, minRr:1.8, minRiskPct:0.0014, maxRiskPct:0.009, session:'asia_eu_us', cooldownHours:0},\n    {name:'v3_pool8_strict', symbols:pool8, score:7.4, minRr:2.1, minRiskPct:0.0016, maxRiskPct:0.008, session:'eu_us', cooldownHours:4},\n  ];"""
new = """  const v5Top4=['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT'];\n  const configs:Cfg[]=[\n    // V5 real-data model: derived from walk-forward/meta-filter study.\n    // It keeps the original HTR signal engine but tightens symbol pool, score, risk and session.\n    {name:'v5_real_top4_euus_score75', symbols:v5Top4, score:7.5, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'eu_us', cooldownHours:0},\n    {name:'v5_real_top4_euus_score78', symbols:v5Top4, score:7.8, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'eu_us', cooldownHours:0},\n    {name:'v5_real_top4_euus_score75_cd4', symbols:v5Top4, score:7.5, minRr:2.0, minRiskPct:0.0016, maxRiskPct:0.009, session:'eu_us', cooldownHours:4},\n  ];"""
if old not in s:
    raise SystemExit('config block not found')
s = s.replace(old, new)
s = s.replace("htr_v3_multisymbol_backtest_1y.json", "htr_v5_realdata_model_backtest_1y.json")
s = s.replace("htr_v3_multisymbol_backtest_1y.md", "htr_v5_realdata_model_backtest_1y.md")
s = s.replace("# HTR V3 多币种趋势策略一年回测", "# HTR V5 真实数据升级模型一年回测")
s = s.replace("V3 使用 4H 定方向、1H 确认交易状态、15m 入场触发", "V5 复用 HTR 信号引擎，并基于真实数据走样本外研究，将交易池收敛到 BTC/ETH/BNB/XRP、EU-US 活跃时段、最低评分 7.5/7.8；原始引擎仍使用 4H 定方向、1H 确认交易状态、15m 入场触发")
s = s.replace("当前最佳为 **${best.config}**", "当前 V5 最佳为 **${best.config}**")
p.write_text(s, encoding='utf-8')
print('patched', p)
