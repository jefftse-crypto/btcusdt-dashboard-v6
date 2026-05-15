from pathlib import Path
import pandas as pd
import re

root = Path('/home/ubuntu/btcusdt_dashboard_v6')
data_root = root / 'data' / 'binance_um_15m_1y_multi'
rows = []

for sym_dir in sorted(data_root.glob('*')):
    if not sym_dir.is_dir():
        continue
    csvs = sorted(sym_dir.glob('*.csv'))
    if not csvs:
        continue
    total = 0
    first = None
    last = None
    months = []
    parse_errors = []
    for p in csvs:
        m = re.search(r'-(\d{4}-\d{2})\.csv$', p.name)
        if m:
            months.append(m.group(1))
        try:
            sample = pd.read_csv(p, nrows=3)
            if 'open_time' in sample.columns:
                df = pd.read_csv(p)
                tcol = 'open_time'
            else:
                df = pd.read_csv(p, header=None)
                tcol = 0
            # 防止误读到表头字符串
            df = df[pd.to_numeric(df[tcol], errors='coerce').notna()].copy()
            if df.empty:
                parse_errors.append(f'{p.name}: empty after numeric open_time filter')
                continue
            df[tcol] = pd.to_numeric(df[tcol], errors='coerce')
            total += len(df)
            t0 = pd.to_datetime(df[tcol].iloc[0], unit='ms', utc=True)
            t1 = pd.to_datetime(df[tcol].iloc[-1], unit='ms', utc=True)
            first = t0 if first is None or t0 < first else first
            last = t1 if last is None or t1 > last else last
        except Exception as e:
            parse_errors.append(f'{p.name}: {e}')
    rows.append({
        'symbol': sym_dir.name,
        'csv_files': len(csvs),
        'months': ','.join(months),
        'rows_15m': total,
        'first_utc': first.strftime('%Y-%m-%d %H:%M:%S') if first is not None else '',
        'last_utc': last.strftime('%Y-%m-%d %H:%M:%S') if last is not None else '',
        'parse_errors': '; '.join(parse_errors[:3]) + (f'; ... {len(parse_errors)} errors total' if len(parse_errors) > 3 else '')
    })

out = pd.DataFrame(rows)
out_path = root / 'reports' / 'v6_real_data_inventory.csv'
out.to_csv(out_path, index=False)

md = root / 'reports' / 'v6_data_gap_audit.md'
with md.open('w', encoding='utf-8') as f:
    f.write('# V6 实盘可信度数据盘点与缺口审计\n\n')
    f.write('本审计基于项目本地 `data/binance_um_15m_1y_multi/` 中已下载的 Binance USDS-M Futures 15m K 线 CSV。旧版 V3/V4/V5 回测已经使用真实 K 线，但仍缺少若干实盘成本与衍生品环境数据。\n\n')
    f.write('## 本地真实 K 线覆盖\n\n')
    f.write(out.to_markdown(index=False))
    f.write('\n\n## Binance 官方可补充数据目录\n\n')
    f.write('| 数据类别 | 官方公开目录 | V6 用途 | 建议优先级 |\n')
    f.write('|---|---|---|---:|\n')
    f.write('| fundingRate | `data/futures/um/monthly/fundingRate/` | 永续合约持仓期间资金费率扣减/增加 | P0 |\n')
    f.write('| markPriceKlines | `data/futures/um/monthly/markPriceKlines/` | 更接近强平与触发价格的风险模拟 | P1 |\n')
    f.write('| premiumIndexKlines | `data/futures/um/monthly/premiumIndexKlines/` | 溢价、基差与资金费率环境过滤 | P1 |\n')
    f.write('| bookTicker | `data/futures/um/monthly/bookTicker/` | 点差与滑点模型校准 | P1 |\n')
    f.write('| aggTrades/trades | `data/futures/um/monthly/aggTrades/`、`trades/` | 成交量微结构与冲击成本估计 | P2 |\n')
    f.write('\n## V6 必须修正的实盘可信度缺口\n\n')
    f.write('| 缺口 | 旧版状态 | V6 处理方式 |\n')
    f.write('|---|---|---|\n')
    f.write('| 手续费 | 旧版主要比较净值未显式扣除双边 maker/taker 成本 | 增加可配置 `fee_bps_per_side`，默认按保守 taker 成本计算 |\n')
    f.write('| 滑点 | 旧版以理想价格成交 | 增加 `slippage_bps_per_side` 与压力倍数 |\n')
    f.write('| 资金费率 | 旧版本地未纳入资金费率 | 先实现可下载/可缺省的 funding 模块；无 funding 文件时用 0 或压力参数 |\n')
    f.write('| 样本外验证 | V5 已有探索，但选择偏差仍高 | V6 固定参数后做滚动窗口与最后 3 个月纯样本外 |\n')
    f.write('| 订单成交假设 | 旧版未区分信号价、下一根开盘、止盈止损穿越顺序 | V6 记录保守触发规则与冲突处理 |\n')
    f.write('| 纸交易 | 尚无统一日志 | 输出纸交易验收清单与日志模板 |\n')

print(out.to_string(index=False))
print('WROTE', out_path)
print('WROTE', md)
