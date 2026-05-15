import json
import math
from pathlib import Path
from datetime import datetime, timezone
from itertools import combinations

ROOT = Path('/home/ubuntu/btcusdt_dashboard_v6')
REPORTS = ROOT / 'reports'
V3_PATH = REPORTS / 'htr_v3_multisymbol_backtest_1y.json'
V4_PATH = REPORTS / 'htr_v4_tpv_multisymbol_backtest_1y.json'
OUT_JSON = REPORTS / 'htr_v5_real_data_meta_model.json'
OUT_MD = REPORTS / 'htr_v5_real_data_meta_model_report.md'

TRAIN_END = datetime(2025, 12, 31, 23, 59, 59, tzinfo=timezone.utc).timestamp()
TEST_START = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc).timestamp()


def load_trades(path: Path, version: str):
    data = json.loads(path.read_text(encoding='utf-8'))
    rows = []
    detail = data.get('detail', {})
    for cfg_name, node in detail.items():
        config_name = node.get('config', {}).get('summary', {}).get('config') or cfg_name
        for t in node.get('trades', []):
            x = dict(t)
            x['version'] = version
            x['config'] = config_name
            x['dt'] = datetime.fromtimestamp(x['time'], tz=timezone.utc)
            x['hour'] = x['dt'].hour
            x['month'] = x['dt'].strftime('%Y-%m')
            x['win'] = 1 if x.get('r', 0) > 0 else 0
            x['notes_text'] = ' | '.join(x.get('notes', []))
            rows.append(x)
    return rows


def metrics(trades):
    trades = sorted(trades, key=lambda x: x['time'])
    n = len(trades)
    if n == 0:
        return {'trades': 0, 'winRate': 0, 'profitFactor': 0, 'totalR': 0, 'accountReturnPct': 0, 'maxDrawdownPct': 0, 'expectancyR': 0, 'avgRiskPct': 0, 'wins': 0, 'losses': 0}
    wins = [x['r'] for x in trades if x['r'] > 0]
    losses = [x['r'] for x in trades if x['r'] <= 0]
    gross_win = sum(wins)
    gross_loss = -sum(losses)
    equity = 0.0
    peak = 0.0
    maxdd = 0.0
    for x in trades:
        equity += x.get('accountPct', 0)
        peak = max(peak, equity)
        maxdd = max(maxdd, peak - equity)
    return {
        'trades': n,
        'winRate': len(wins) / n * 100,
        'profitFactor': gross_win / gross_loss if gross_loss > 1e-12 else 999.0,
        'totalR': sum(x['r'] for x in trades),
        'accountReturnPct': sum(x.get('accountPct', 0) for x in trades),
        'maxDrawdownPct': maxdd,
        'expectancyR': sum(x['r'] for x in trades) / n,
        'avgRiskPct': sum(x.get('riskPct', 0) for x in trades) / n * 100,
        'wins': len(wins),
        'losses': len(losses),
    }


def fmt(x, nd=2):
    if isinstance(x, (int,)):
        return str(x)
    if not isinstance(x, (float, int)) or math.isnan(x):
        return 'NA'
    if abs(x) >= 900:
        return '∞'
    return f'{x:.{nd}f}'


def pass_session(hour, session):
    if session == 'all':
        return True
    if session == 'eu_us':
        return 7 <= hour <= 18
    if session == 'asia_eu_us':
        return (2 <= hour <= 5) or (7 <= hour <= 11) or (13 <= hour <= 19)
    if session == 'us_only':
        return 13 <= hour <= 19
    if session == 'low_noise':
        return hour in {2,3,7,8,9,10,13,14,15,16}
    return True


def make_rule(config, symbols, dirs, min_score, max_risk_pct, session, keyword_mode, keyword):
    return {
        'config': config,
        'symbols': sorted(symbols),
        'dirs': sorted(dirs),
        'min_score': min_score,
        'max_risk_pct': max_risk_pct,
        'session': session,
        'keyword_mode': keyword_mode,
        'keyword': keyword,
    }


def apply_rule(trades, rule):
    out = []
    for x in trades:
        if x['config'] != rule['config']:
            continue
        if x['symbol'] not in rule['symbols']:
            continue
        if x['dir'] not in rule['dirs']:
            continue
        if x.get('score', 0) < rule['min_score']:
            continue
        if x.get('riskPct', 999) * 100 > rule['max_risk_pct']:
            continue
        if not pass_session(x['hour'], rule['session']):
            continue
        kw = rule['keyword']
        txt = x.get('notes_text', '')
        if rule['keyword_mode'] == 'require' and kw and kw not in txt:
            continue
        if rule['keyword_mode'] == 'exclude' and kw and kw in txt:
            continue
        out.append(x)
    return sorted(out, key=lambda z: z['time'])


def symbol_candidates(train_trades):
    symbols = sorted(set(x['symbol'] for x in train_trades))
    perf = []
    for s in symbols:
        ms = metrics([x for x in train_trades if x['symbol'] == s])
        if ms['trades'] >= 8:
            perf.append((s, ms['winRate'], ms['profitFactor'], ms['totalR'], ms['trades']))
    perf.sort(key=lambda z: (z[1], z[2], z[3]), reverse=True)
    top = [x[0] for x in perf[:5]]
    out = []
    out.append(tuple(symbols))
    for k in range(1, min(5, len(top)) + 1):
        out.append(tuple(sorted(top[:k])))
    for k in [2, 3, 4]:
        for comb in combinations(top, min(k, len(top))):
            out.append(tuple(sorted(comb)))
    return sorted(set(out), key=lambda z: (len(z), z))


def main():
    all_trades = load_trades(V3_PATH, 'v3') + load_trades(V4_PATH, 'v4_tpv')
    train = [x for x in all_trades if x['time'] <= TRAIN_END]
    test = [x for x in all_trades if x['time'] >= TEST_START]
    configs = sorted(set(x['config'] for x in all_trades))
    candidates = []
    score_grid = [6.8, 7.0, 7.2, 7.5, 7.8, 8.0, 8.2, 8.5, 8.8]
    risk_grid = [0.45, 0.55, 0.65, 0.75, 0.9, 1.1]
    sessions = ['all', 'asia_eu_us', 'eu_us', 'us_only', 'low_noise']
    dir_sets = [('long',), ('short',), ('long','short')]
    keyword_filters = [('none',''), ('require','CVD'), ('require','VWAP'), ('require','量能'), ('require','回踩'), ('require','TPV第三触点'), ('require','TPV收线验证'), ('exclude','反弹无力'), ('exclude','抛压')]

    for cfg in configs:
        cfg_train = [x for x in train if x['config'] == cfg]
        if len(cfg_train) < 30:
            continue
        sym_sets = symbol_candidates(cfg_train)
        for syms in sym_sets:
            for dirs in dir_sets:
                for min_score in score_grid:
                    for max_risk_pct in risk_grid:
                        for session in sessions:
                            for kmode, kw in keyword_filters:
                                rule = make_rule(cfg, syms, dirs, min_score, max_risk_pct, session, kmode, kw)
                                tr = apply_rule(train, rule)
                                mt = metrics(tr)
                                if mt['trades'] < 25:
                                    continue
                                if mt['profitFactor'] < 1.25 or mt['winRate'] < 58:
                                    continue
                                te = apply_rule(test, rule)
                                me = metrics(te)
                                full = apply_rule(all_trades, rule)
                                mf = metrics(full)
                                rule_score = mt['expectancyR'] * min(1.0, mt['trades']/70) + mt['profitFactor']*0.05 + mt['winRate']*0.003 - mt['maxDrawdownPct']*0.02
                                candidates.append({'rule': rule, 'train': mt, 'test': me, 'full': mf, 'trainScore': rule_score})

    candidates.sort(key=lambda z: z['trainScore'], reverse=True)
    top_train = candidates[:20]
    oos_valid = [c for c in candidates if c['test']['trades'] >= 12 and c['test']['profitFactor'] >= 1.2 and c['test']['winRate'] >= 58]
    oos_valid.sort(key=lambda z: (z['test']['profitFactor'], z['test']['winRate'], z['test']['accountReturnPct']), reverse=True)
    selected = top_train[0] if top_train else None
    exploratory_best_oos = oos_valid[0] if oos_valid else None

    baselines = []
    for cfg in configs:
        pool = [x for x in all_trades if x['config'] == cfg]
        if pool:
            baselines.append({'config': cfg, 'full': metrics(pool), 'train': metrics([x for x in pool if x['time'] <= TRAIN_END]), 'test': metrics([x for x in pool if x['time'] >= TEST_START])})
    baselines.sort(key=lambda z: z['full']['accountReturnPct'], reverse=True)

    result = {
        'data_basis': 'Binance Data Vision USDT-M Futures monthly klines 15m, local CSV, 2025-05-01 to 2026-04-30, 8 symbols',
        'train_period_utc': '2025-05-01 to 2025-12-31',
        'test_period_utc': '2026-01-01 to 2026-04-30',
        'candidate_count': len(candidates),
        'selected_by_train_only': selected,
        'exploratory_best_oos_among_train_passed': exploratory_best_oos,
        'top_train': top_train[:10],
        'top_oos_valid': oos_valid[:10],
        'baselines': baselines,
    }
    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')

    lines = []
    lines.append('# V5 真实数据模型升级回测报告\n')
    lines.append('作者：**Manus AI**\n')
    lines.append('本报告基于本地保存的 Binance USDT-M Futures 15m 真实 K 线数据与 V3/V4 TPV 已执行交易明细，建立一个可解释的 **V5 数据驱动元过滤模型**。训练段为 2025-05-01 至 2025-12-31，测试段为 2026-01-01 至 2026-04-30。\n')
    lines.append('> 重要说明：V5 没有使用随机数据或模拟行情；它使用的基础交易全部来自现有真实 K 线回测结果。当前版本属于“元过滤升级”，主要目标是提高胜率与降低回撤，而不是盲目增加交易次数。\n')
    lines.append('## 一、基线表现\n')
    lines.append('| 基线配置 | 全样本交易 | 全样本胜率 | 全样本PF | 全样本收益% | 全样本最大回撤% | 测试段交易 | 测试段胜率 | 测试段PF |')
    lines.append('|---|---:|---:|---:|---:|---:|---:|---:|---:|')
    for b in baselines[:12]:
        f, te = b['full'], b['test']
        lines.append(f"| {b['config']} | {f['trades']} | {fmt(f['winRate'])} | {fmt(f['profitFactor'])} | {fmt(f['accountReturnPct'])} | {fmt(f['maxDrawdownPct'])} | {te['trades']} | {fmt(te['winRate'])} | {fmt(te['profitFactor'])} |")

    def describe_rule(rule):
        return f"配置={rule['config']}；币种={','.join(rule['symbols'])}；方向={','.join(rule['dirs'])}；最低分={rule['min_score']}；最大风险距离={rule['max_risk_pct']}%；时段={rule['session']}；关键词={rule['keyword_mode']} {rule['keyword']}".strip()

    lines.append('\n## 二、训练段选出的 V5 规则\n')
    if selected:
        r = selected['rule']
        lines.append(f"训练段纯规则选择结果为：**{describe_rule(r)}**。\n")
        lines.append('| 区间 | 交易数 | 胜率 | PF | 账户收益% | 最大回撤% | 期望R |')
        lines.append('|---|---:|---:|---:|---:|---:|---:|')
        for name, obj in [('训练段', selected['train']), ('测试段', selected['test']), ('全样本', selected['full'])]:
            lines.append(f"| {name} | {obj['trades']} | {fmt(obj['winRate'])} | {fmt(obj['profitFactor'])} | {fmt(obj['accountReturnPct'])} | {fmt(obj['maxDrawdownPct'])} | {fmt(obj['expectancyR'],3)} |")
    else:
        lines.append('没有找到满足训练段最低交易数、胜率与 PF 约束的规则。\n')

    lines.append('\n## 三、探索性样本外最佳规则\n')
    if exploratory_best_oos:
        r = exploratory_best_oos['rule']
        lines.append('下表展示“训练段合格规则集合中，测试段表现最佳”的探索性结果。该结果可作为下一轮 V5.1 参数候选，但不应被视为无偏估计。\n')
        lines.append(f"规则：**{describe_rule(r)}**。\n")
        lines.append('| 区间 | 交易数 | 胜率 | PF | 账户收益% | 最大回撤% | 期望R |')
        lines.append('|---|---:|---:|---:|---:|---:|---:|')
        for name, obj in [('训练段', exploratory_best_oos['train']), ('测试段', exploratory_best_oos['test']), ('全样本', exploratory_best_oos['full'])]:
            lines.append(f"| {name} | {obj['trades']} | {fmt(obj['winRate'])} | {fmt(obj['profitFactor'])} | {fmt(obj['accountReturnPct'])} | {fmt(obj['maxDrawdownPct'])} | {fmt(obj['expectancyR'],3)} |")
    else:
        lines.append('训练段合格规则中，没有任何规则在测试段同时满足交易数、胜率和 PF 的最低验证标准。\n')

    lines.append('\n## 四、结论\n')
    if selected:
        s_test = selected['test']
        best_base = baselines[0]
        lines.append(f"以严格训练段选择为准，V5 在测试段产生 {s_test['trades']} 笔交易，胜率 {fmt(s_test['winRate'])}%，PF {fmt(s_test['profitFactor'])}，账户收益 {fmt(s_test['accountReturnPct'])}%。这能检验升级规则是否离开训练段后仍有效。\n")
        lines.append(f"当前全样本收益最高的旧版基线是 `{best_base['config']}`，全样本交易 {best_base['full']['trades']} 笔、胜率 {fmt(best_base['full']['winRate'])}%、PF {fmt(best_base['full']['profitFactor'])}、收益 {fmt(best_base['full']['accountReturnPct'])}%。V5 的价值要从测试段稳定性、回撤下降与胜率改善综合判断，而不是只看全样本收益。\n")
    lines.append('下一步建议升级到 **V5.1 真实数据增强版**：下载真实资金费率、持仓量 OI、多空比与更高周期 1H/4H 原始 K 线，并把 TPV 的“第三触线/支点”改成 swing pivot 结构识别，而不是只从已成交交易做元过滤。\n')

    OUT_MD.write_text('\n'.join(lines), encoding='utf-8')
    print(OUT_JSON)
    print(OUT_MD)

if __name__ == '__main__':
    main()
