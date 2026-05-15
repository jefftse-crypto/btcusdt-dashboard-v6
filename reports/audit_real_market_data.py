import csv
from pathlib import Path
from datetime import datetime, timezone

root = Path('/home/ubuntu/btcusdt_dashboard_v6')
base = root / 'data' / 'binance_um_15m_1y_multi'
out = root / 'reports' / 'real_market_data_audit.md'

symbols = sorted([p.name for p in base.iterdir() if p.is_dir()])
lines = []
lines.append('# 真实行情数据盘点\n')
lines.append('本文件盘点当前项目中可用于升级回测的 Binance USDT-M Futures 15m 月度 K 线 CSV。\n')
lines.append('| 币种 | 文件数 | 有效K线数 | 起始时间 UTC | 结束时间 UTC | 样本字段数 |')
lines.append('|---|---:|---:|---|---|---:|')
for sym in symbols:
    files = sorted((base / sym).glob('*.csv'))
    rows = 0
    first = None
    last = None
    sample_len = 0
    for f in files:
        with f.open(newline='') as fh:
            reader = csv.reader(fh)
            for row in reader:
                if len(row) < 6:
                    continue
                try:
                    t = int(float(row[0]))
                    float(row[1]); float(row[2]); float(row[3]); float(row[4]); float(row[5])
                except Exception:
                    continue
                rows += 1
                if first is None:
                    first = t
                    sample_len = len(row)
                last = t
    def fmt(ms):
        if ms is None:
            return 'NA'
        return datetime.fromtimestamp(ms/1000, tz=timezone.utc).isoformat().replace('+00:00','Z')
    lines.append(f'| {sym} | {len(files)} | {rows} | {fmt(first)} | {fmt(last)} | {sample_len} |')

lines.append('\n这些 CSV 是当前 V3/V4 回测脚本已使用的真实历史 K 线基础。下一步升级模型将继续使用这些文件，必要时加入可下载的真实资金费率、OI 或更高周期聚合数据。\n')
out.write_text('\n'.join(lines), encoding='utf-8')
print(out)
