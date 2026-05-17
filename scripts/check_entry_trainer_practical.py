#!/usr/bin/env python3
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = 'http://localhost:3001/api/trpc'

def trpc_get(proc, payload, timeout=90):
    encoded = urllib.parse.quote(json.dumps({'0': {'json': payload}}, separators=(',', ':')))
    url = f'{BASE}/{proc}?batch=1&input={encoded}'
    started = time.time()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            status = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', errors='replace')
        status = e.code
    elapsed = time.time() - started
    try:
        data = json.loads(raw)
    except Exception:
        data = raw[:1000]
    return {'status': status, 'elapsed_sec': round(elapsed, 2), 'raw': data}

def unwrap(result):
    data = result.get('raw')
    if isinstance(data, list) and data and 'result' in data[0]:
        return data[0]['result']['data']['json']
    return None

def summarize_entry_score(x):
    if not x:
        return None
    v = x.get('validationStats') or {}
    return {
        'action': x.get('action'),
        'score': x.get('score'),
        'confidence': x.get('confidence'),
        'direction': x.get('direction'),
        'similarCount': x.get('similarCount'),
        'similarWinRate': x.get('similarWinRate'),
        'avgRMultiple': x.get('avgRMultiple'),
        'marketRegime': x.get('marketRegime'),
        'thresholds': x.get('scoreThresholds'),
        'diagnostics_count': len(x.get('diagnostics') or []),
        'nearest_count': len(x.get('nearestSamples') or []),
        'validation': {
            'verdict': v.get('verdict'),
            'edgeScore': v.get('edgeScore'),
            'trainSampleCount': v.get('trainSampleCount'),
            'testSampleCount': v.get('testSampleCount'),
            'oosWinRate': v.get('oosWinRate'),
            'oosAvgRMultiple': v.get('oosAvgRMultiple'),
            'predictedTradeCount': v.get('predictedTradeCount'),
            'coverage': v.get('coverage'),
            'overfitRisk': v.get('overfitRisk'),
            'notes': (v.get('notes') or [])[:3],
        },
        'topFeatures': (x.get('topFeatures') or [])[:5],
    }

def summarize_reliability(x):
    if not x:
        return None
    rows = []
    for r in (x.get('leaderboard') or [])[:8]:
        v = r.get('validation') or {}
        rows.append({
            'rank': r.get('rank'),
            'strategy': r.get('strategy'),
            'reliabilityScore': r.get('reliabilityScore'),
            'recommendation': r.get('recommendation'),
            'regimeFit': r.get('regimeFit'),
            'sampleCount': r.get('sampleCount'),
            'oosWinRate': v.get('oosWinRate'),
            'oosAvgRMultiple': v.get('oosAvgRMultiple'),
            'edgeScore': v.get('edgeScore'),
            'overfitRisk': v.get('overfitRisk'),
            'verdict': v.get('verdict'),
        })
    return {
        'symbol': x.get('symbol'),
        'timeframe': x.get('timeframe'),
        'currentRegime': x.get('currentRegime'),
        'leaderboard_count': len(x.get('leaderboard') or []),
        'top': rows,
    }

def main():
    cases = [
        ('ai.entryTrainerStatus', {'symbol':'BTCUSDT','timeframe':'1h','strategy':'v8_hybrid'}),
        ('ai.entryScore', {'symbol':'BTCUSDT','timeframe':'1h','strategy':'v8_hybrid','limit':3000,'labelMode':'conservative','forceRetrain':False}),
        ('ai.entryStrategyReliability', {'symbol':'BTCUSDT','timeframe':'1h','limit':3000,'labelMode':'conservative'}),
    ]
    out = {}
    for proc, payload in cases:
        print(f'CALL {proc} ...', file=sys.stderr)
        res = trpc_get(proc, payload)
        body = unwrap(res)
        out[proc] = {'status': res['status'], 'elapsed_sec': res['elapsed_sec']}
        if proc.endswith('entryScore'):
            out[proc]['summary'] = summarize_entry_score(body)
        elif proc.endswith('entryStrategyReliability'):
            out[proc]['summary'] = summarize_reliability(body)
        else:
            out[proc]['summary'] = body
        if res['status'] != 200:
            out[proc]['error_body'] = res['raw']
    Path('/home/ubuntu/btcusdt_dashboard_v6/runtime/entry_trainer_practical_check.json').write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(json.dumps(out, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
