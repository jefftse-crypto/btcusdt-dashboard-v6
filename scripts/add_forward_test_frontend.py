#!/usr/bin/env python3.11
"""
把 forward test 統計卡片加入 AI 預測面板
"""
import re

PANEL_FILE = "/home/ubuntu/btcusdt_dashboard_v6/client/src/components/panels/AIPredictionPanel.tsx"

# 1. 在查詢宣告區加入 forward test stats query
QUERY_INSERT = '''
  const {
    data: forwardTestStats,
    isFetching: isForwardTestFetching,
    refetch: refetchForwardTestStats,
  } = trpc.ai.entryForwardTestStats.useQuery(
    { symbol, timeframe: selectedTf },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
    }
  );
'''

# 2. 在 useEffect 中加入 refetch forward test stats
EFFECT_INSERT = '''
  useEffect(() => {
    if (!entryScore) return;
    if (forceEntryRetrainOnce) setForceEntryRetrainOnce(false);
    refetchEntryStatus();
    refetchEntryReliability();
    refetchForwardTestStats();
  }, [entryScore, forceEntryRetrainOnce, refetchEntryStatus, refetchEntryReliability, refetchForwardTestStats]);
'''

# 3. 在 handleRetrain 中加入 refetch forward test stats
RETRAIN_INSERT = '''
  const handleRetrain = useCallback(async () => {
    setIsRetraining(true);
    setForceRetrainOnce(true);
    try {
      await refetch();
      await refetchStatus();
      await refetchDecision();
      await refetchEntryScore();
      await refetchEntryStatus();
      await refetchEntryReliability();
      await refetchForwardTestStats();
    } finally {
      setIsRetraining(false);
    }
  }, [refetch, refetchStatus, refetchDecision, refetchEntryScore, refetchEntryStatus, refetchEntryReliability, refetchForwardTestStats]);
'''

# 4. 在重新預測按鈕中加入 refetch forward test stats
BUTTON_INSERT = '''
        <button
          onClick={() => { refetch(); refetchDecision(); refetchEntryScore(); refetchEntryStatus(); refetchEntryReliability(); refetchForwardTestStats(); }}
          disabled={isWorking}
          className="p-1.5 rounded-lg transition-colors hover:bg-[#252b3a] disabled:opacity-50"
          title="重新預測"
        >
          <RefreshCw size={14} className={`text-[#8896b0] ${isWorking ? "animate-spin" : ""}`} />
        </button>
'''

# 5. 在 Entry Trainer 卡片末尾加入 forward test 統計卡片
FORWARD_TEST_CARD = '''
                {forwardTestStats && (
                  <div className="rounded-lg border border-[#5b8af5]/20 bg-[#5b8af5]/5 p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[9px] text-[#5b8af5] uppercase font-bold tracking-wider">Forward Test 紙上交易</div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#5b8af5]/10 text-[#5b8af5]">
                        {forwardTestStats.enabled ? "進行中" : "已停止"}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">總筆數</div><div className="font-mono font-bold text-[#e2e8f0]">{forwardTestStats.total}</div></div>
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">已結案</div><div className="font-mono font-bold text-[#e2e8f0]">{forwardTestStats.closed}</div></div>
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">勝率</div><div className="font-mono font-bold" style={{ color: forwardTestStats.winRate >= 0.5 ? "#26d48a" : "#f04f5e" }}>{Math.round(forwardTestStats.winRate * 100)}%</div></div>
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">平均 R</div><div className="font-mono font-bold" style={{ color: forwardTestStats.avgR > 0 ? "#26d48a" : "#f04f5e" }}>{forwardTestStats.avgR.toFixed(2)}</div></div>
                    </div>
                    {forwardTestStats.openTrades.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[9px] text-[#64748b]">進行中交易 ({forwardTestStats.openTrades.length})</div>
                        {forwardTestStats.openTrades.slice(0, 3).map((trade) => (
                          <div key={trade.id} className="text-[9px] text-[#cbd5e1] flex justify-between">
                            <span>{trade.strategy} {trade.direction === "long" ? "做多" : "做空"}</span>
                            <span style={{ color: trade.direction === "long" ? "#26d48a" : "#f04f5e" }}>${trade.entry.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {forwardTestStats.lastRunError && (
                      <div className="text-[9px] text-[#f04f5e] leading-relaxed">{forwardTestStats.lastRunError}</div>
                    )}
                  </div>
                )}
'''

with open(PANEL_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# 替換查詢宣告區
content = content.replace(
    '''  const {
    data: entryStrategyReliability,
    isFetching: isEntryReliabilityFetching,
    refetch: refetchEntryReliability,
  } = trpc.ai.entryStrategyReliability.useQuery(
    { symbol, timeframe: selectedTf, limit: 3000, labelMode: entryLabelMode },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
    }
  );''',
    '''  const {
    data: entryStrategyReliability,
    isFetching: isEntryReliabilityFetching,
    refetch: refetchEntryReliability,
  } = trpc.ai.entryStrategyReliability.useQuery(
    { symbol, timeframe: selectedTf, limit: 3000, labelMode: entryLabelMode },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
    }
  );

  const {
    data: forwardTestStats,
    isFetching: isForwardTestFetching,
    refetch: refetchForwardTestStats,
  } = trpc.ai.entryForwardTestStats.useQuery(
    { symbol, timeframe: selectedTf },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
    }
  );'''
)

# 替換第一個 useEffect
content = content.replace(
    '''  useEffect(() => {
    if (!entryScore) return;
    if (forceEntryRetrainOnce) setForceEntryRetrainOnce(false);
    refetchEntryStatus();
    refetchEntryReliability();
  }, [entryScore, forceEntryRetrainOnce, refetchEntryStatus, refetchEntryReliability]);''',
    '''  useEffect(() => {
    if (!entryScore) return;
    if (forceEntryRetrainOnce) setForceEntryRetrainOnce(false);
    refetchEntryStatus();
    refetchEntryReliability();
    refetchForwardTestStats();
  }, [entryScore, forceEntryRetrainOnce, refetchEntryStatus, refetchEntryReliability, refetchForwardTestStats]);'''
)

# 替換 handleRetrain
content = content.replace(
    '''  const handleRetrain = useCallback(async () => {
    setIsRetraining(true);
    setForceRetrainOnce(true);
    try {
      await refetch();
      await refetchStatus();
      await refetchDecision();
      await refetchEntryScore();
      await refetchEntryStatus();
      await refetchEntryReliability();
    } finally {
      setIsRetraining(false);
    }
  }, [refetch, refetchStatus, refetchDecision, refetchEntryScore, refetchEntryStatus, refetchEntryReliability]);''',
    '''  const handleRetrain = useCallback(async () => {
    setIsRetraining(true);
    setForceRetrainOnce(true);
    try {
      await refetch();
      await refetchStatus();
      await refetchDecision();
      await refetchEntryScore();
      await refetchEntryStatus();
      await refetchEntryReliability();
      await refetchForwardTestStats();
    } finally {
      setIsRetraining(false);
    }
  }, [refetch, refetchStatus, refetchDecision, refetchEntryScore, refetchEntryStatus, refetchEntryReliability, refetchForwardTestStats]);'''
)

# 替換重新預測按鈕
content = content.replace(
    '''        <button
          onClick={() => { refetch(); refetchDecision(); refetchEntryScore(); refetchEntryStatus(); refetchEntryReliability(); }}
          disabled={isWorking}
          className="p-1.5 rounded-lg transition-colors hover:bg-[#252b3a] disabled:opacity-50"
          title="重新預測"
        >
          <RefreshCw size={14} className={`text-[#8896b0] ${isWorking ? "animate-spin" : ""}`} />
        </button>''',
    '''        <button
          onClick={() => { refetch(); refetchDecision(); refetchEntryScore(); refetchEntryStatus(); refetchEntryReliability(); refetchForwardTestStats(); }}
          disabled={isWorking}
          className="p-1.5 rounded-lg transition-colors hover:bg-[#252b3a] disabled:opacity-50"
          title="重新預測"
        >
          <RefreshCw size={14} className={`text-[#8896b0] ${isWorking ? "animate-spin" : ""}`} />
        </button>'''
)

# 在 Entry Trainer 卡片末尾加入 forward test 統計卡片
# 找到最後一個 </div> 之前插入
pattern = r'(\s+\}\)\s*\}\s*</div>\s*</div>\s*</div>\s*</div>\s*</div>)'
match = re.search(pattern, content)
if match:
    insert_pos = match.start(1)
    content = content[:insert_pos] + FORWARD_TEST_CARD + content[insert_pos:]

with open(PANEL_FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Forward test 統計卡片已加入前端 AI 預測面板")
