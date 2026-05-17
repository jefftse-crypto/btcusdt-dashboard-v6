from pathlib import Path

path = Path('/home/ubuntu/btcusdt_dashboard_v6/client/src/components/panels/AIPredictionPanel.tsx')
text = path.read_text()

# 1) 新增 AI 決策查詢
old_query = '''  const {
    data: prediction,
    isLoading,
    isFetching,
    error,
    refetch,
  } = trpc.ai.predict.useQuery(
    { symbol, timeframe: selectedTf, limit: 800, forceRetrain: forceRetrainOnce },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
      onSuccess: () => {
        if (forceRetrainOnce) setForceRetrainOnce(false);
        refetchStatus();
      }
    }
  );'''
new_query = '''  const {
    data: prediction,
    isLoading,
    isFetching,
    error,
    refetch,
  } = trpc.ai.predict.useQuery(
    { symbol, timeframe: selectedTf, limit: 800, forceRetrain: forceRetrainOnce },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
      onSuccess: () => {
        if (forceRetrainOnce) setForceRetrainOnce(false);
        refetchStatus();
        refetchDecision();
      }
    }
  );

  const {
    data: aiDecision,
    isLoading: isDecisionLoading,
    isFetching: isDecisionFetching,
    error: decisionError,
    refetch: refetchDecision,
  } = trpc.ai.decision.useQuery(
    { symbol, timeframe: selectedTf, limit: 800 },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
    }
  );'''
# Need to avoid use-before-declare? In JS const refetchDecision is declared after onSuccess callback creation, but callback executed later. TS ok? It may error 'Block-scoped variable used before declaration'. Better query order: decision before prediction? But decision triggers LSTM too. use before decl may TS error. We'll insert decision before prediction and remove onSuccess refetchDecision? For robustness, we use setTimeout? no.
new_query_ordered = '''  const {
    data: aiDecision,
    isLoading: isDecisionLoading,
    isFetching: isDecisionFetching,
    error: decisionError,
    refetch: refetchDecision,
  } = trpc.ai.decision.useQuery(
    { symbol, timeframe: selectedTf, limit: 800 },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
    }
  );

  const {
    data: prediction,
    isLoading,
    isFetching,
    error,
    refetch,
  } = trpc.ai.predict.useQuery(
    { symbol, timeframe: selectedTf, limit: 800, forceRetrain: forceRetrainOnce },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
      onSuccess: () => {
        if (forceRetrainOnce) setForceRetrainOnce(false);
        refetchStatus();
        refetchDecision();
      }
    }
  );'''
if old_query in text and 'trpc.ai.decision.useQuery' not in text:
    text = text.replace(old_query, new_query_ordered)

# 2) retrain 後同步刷新決策
text = text.replace('''      await refetch();
      await refetchStatus();''', '''      await refetch();
      await refetchStatus();
      await refetchDecision();''')
text = text.replace('''  }, [refetch]);''', '''  }, [refetch, refetchStatus, refetchDecision]);''')

# 3) refresh button 同時刷新 LSTM 和 AI 決策
text = text.replace('''          onClick={() => refetch()}''', '''          onClick={() => { refetch(); refetchDecision(); }}''')

# 4) 增加顏色設定
old_conf = '''  const confidenceLevel = prediction
    ? prediction.confidence >= 75 ? { label: "高信心", color: "#26d48a" }
    : prediction.confidence >= 55 ? { label: "中信心", color: "#f5a623" }
    : { label: "低信心", color: "#f04f5e" }
    : null;

  // ─── 準確率等級 ───────────────────────────────────────────────────────'''
new_conf = '''  const confidenceLevel = prediction
    ? prediction.confidence >= 75 ? { label: "高信心", color: "#26d48a" }
    : prediction.confidence >= 55 ? { label: "中信心", color: "#f5a623" }
    : { label: "低信心", color: "#f04f5e" }
    : null;

  const aiActionColor = aiDecision?.action === "long" ? "#26d48a" : aiDecision?.action === "short" ? "#f04f5e" : "#f5a623";
  const aiRiskColor = aiDecision?.riskLevel === "low" ? "#26d48a" : aiDecision?.riskLevel === "medium" ? "#f5a623" : "#f04f5e";
  const aiDecisionWorking = isDecisionLoading || isDecisionFetching;

  // ─── 準確率等級 ───────────────────────────────────────────────────────'''
if old_conf in text:
    text = text.replace(old_conf, new_conf)

# 5) 插入 AI 綜合判讀 UI，放在價格預測之後、模型資訊之前
marker = '''          {/* 模型資訊 */}
          <div className="flex items-center justify-between px-1">'''
ai_card = '''          {/* AI 綜合判讀與交易決策 */}
          <div className="p-4 rounded-xl border border-[#5b8af5]/25 bg-gradient-to-br from-[#141820] to-[#111827] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-[#5b8af5]" />
                <div>
                  <div className="text-[10px] text-[#8896b0] uppercase font-bold tracking-wider">AI 綜合判讀</div>
                  <div className="text-[9px] text-[#64748b]">LSTM + 技術指標 + 策略中心 + SMC/PA</div>
                </div>
              </div>
              <button
                onClick={() => refetchDecision()}
                disabled={aiDecisionWorking}
                className="text-[9px] font-bold text-[#5b8af5] hover:underline disabled:opacity-50"
              >
                {aiDecisionWorking ? "判讀中..." : "重新判讀"}
              </button>
            </div>

            {decisionError ? (
              <div className="text-[10px] text-[#f04f5e] leading-relaxed">AI 綜合判讀暫時不可用：{decisionError.message}</div>
            ) : aiDecision ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[9px] text-[#8896b0]">決策</div>
                    <div className="mt-1 text-xs font-black" style={{ color: aiActionColor }}>{aiDecision.actionLabel}</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[9px] text-[#8896b0]">信心</div>
                    <div className="mt-1 text-xs font-black text-[#e2e8f0]">{aiDecision.confidence}%</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[9px] text-[#8896b0]">風險</div>
                    <div className="mt-1 text-xs font-black" style={{ color: aiRiskColor }}>{aiDecision.riskLevel === "low" ? "低" : aiDecision.riskLevel === "medium" ? "中" : "高"}</div>
                  </div>
                </div>

                <div className="rounded-lg bg-[#1c2030] p-3 text-[10px] leading-relaxed text-[#cbd5e1]">
                  {aiDecision.summary}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">進場 / 失效</div>
                    <div className="mt-1 font-mono text-[#e2e8f0]">{aiDecision.tradePlan?.entry ? `$${aiDecision.tradePlan.entry.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "等待"}</div>
                    <div className="mt-0.5 text-[9px] text-[#8896b0]">SL {aiDecision.tradePlan?.sl ? `$${aiDecision.tradePlan.sl.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}</div>
                  </div>
                  <div className="rounded-lg bg-[#1c2030] p-2">
                    <div className="text-[#8896b0]">目標 / RR</div>
                    <div className="mt-1 font-mono text-[#e2e8f0]">TP1 {aiDecision.tradePlan?.tp1 ? `$${aiDecision.tradePlan.tp1.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}</div>
                    <div className="mt-0.5 text-[9px] text-[#8896b0]">RR {aiDecision.tradePlan?.rrRatio ?? "--"}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[9px] text-[#8896b0] uppercase font-bold tracking-wider">主要理由</div>
                  {(aiDecision.reasons ?? []).slice(0, 3).map((reason: string, idx: number) => (
                    <div key={idx} className="text-[10px] text-[#cbd5e1] leading-relaxed flex gap-1.5">
                      <span className="text-[#5b8af5]">{idx + 1}.</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>

                {(aiDecision.warnings?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-[#f5a623]/20 bg-[#f5a623]/5 p-2 space-y-1">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-[#f5a623]"><AlertCircle size={11} />風控提醒</div>
                    <div className="text-[10px] text-[#cbd5e1] leading-relaxed">{aiDecision.warnings[0]}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-[#8896b0]">正在整合模型、指標與策略訊號...</div>
            )}
          </div>

          {/* 模型資訊 */}
          <div className="flex items-center justify-between px-1">'''
if marker in text and 'AI 綜合判讀與交易決策' not in text:
    text = text.replace(marker, ai_card)

path.write_text(text)
print('frontend ai decision panel upgrade applied')
