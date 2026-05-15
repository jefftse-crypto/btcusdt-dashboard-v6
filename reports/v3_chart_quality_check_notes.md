# V3 图表质量检查记录

已检查 `/home/ubuntu/btcusdt_dashboard_v6/reports/htr_v3_vs_v2_equity_curve.png`。图表正常生成，V3 多币种 pool8 quality 权益曲线以绿色显示，明显高于 V2 BTC regime trend 蓝线；V3 曲线从 2025-08 后开始持续上行，至 2026-04 接近 119 初始权益单位，图例、标题、坐标轴均可读。

已检查 `/home/ubuntu/btcusdt_dashboard_v6/reports/htr_v3_config_comparison.png`。三栏对比图正常生成，分别展示 Account Return、Profit Factor 与 Trades per Year；pool8_quality 的账户收益与 PF 均为最高，pool8_frequency 交易数最多但 PF 明显低于 pool8_quality，符合报告结论。
