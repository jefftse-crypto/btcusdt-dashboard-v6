from pathlib import Path

p = Path('/home/ubuntu/btcusdt_dashboard_v6/client/src/components/panels/AIPredictionPanel.tsx')
text = p.read_text(errors='replace')

# Add leaderboard query after entryScore query.
old = '''  const {
    data: entryScore,
    isLoading: isEntryScoreLoading,
    isFetching: isEntryScoreFetching,
    error: entryScoreError,
    refetch: refetchEntryScore,
  } = trpc.ai.entryScore.useQuery(
    { symbol, timeframe: selectedTf, strategy: entryStrategy, limit: 3000, labelMode: entryLabelMode, forceRetrain: forceEntryRetrainOnce },
    {
      staleTime: 2 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
      retry: 1,
    }
  );
'''
new = old + '''
  const {
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
'''
if 'entryStrategyReliability' not in text:
    text = text.replace(old, new)

text = text.replace('    refetchEntryStatus();\n  }, [entryScore, forceEntryRetrainOnce, refetchEntryStatus]);', '    refetchEntryStatus();\n    refetchEntryReliability();\n  }, [entryScore, forceEntryRetrainOnce, refetchEntryStatus, refetchEntryReliability]);')
text = text.replace('      await refetchEntryStatus();\n    } finally {', '      await refetchEntryStatus();\n      await refetchEntryReliability();\n    } finally {')
text = text.replace('  }, [refetch, refetchStatus, refetchDecision, refetchEntryScore, refetchEntryStatus]);', '  }, [refetch, refetchStatus, refetchDecision, refetchEntryScore, refetchEntryStatus, refetchEntryReliability]);')
text = text.replace('  const entryScoreWorking = isEntryScoreLoading || isEntryScoreFetching;', '  const entryScoreWorking = isEntryScoreLoading || isEntryScoreFetching || isEntryReliabilityFetching;')
text = text.replace('  const topEntryFeatures = entryScore?.topFeatures ?? entryTrainerStatus?.topFeatures ?? [];', '  const topEntryFeatures = entryScore?.topFeatures ?? entryTrainerStatus?.topFeatures ?? [];\n  const entryValidation = entryScore?.validationStats ?? entryTrainerStatus?.validationStats;\n  const entryValidationVerdictLabel = entryValidation?.verdict === "robust" ? "穩健" : entryValidation?.verdict === "acceptable" ? "可接受" : entryValidation?.verdict === "fragile" ? "脆弱" : "未驗證";\n  const entryValidationColor = entryValidation?.verdict === "robust" ? "#26d48a" : entryValidation?.verdict === "acceptable" ? "#5b8af5" : entryValidation?.verdict === "fragile" ? "#f5a623" : "#f04f5e";\n  const strategyTopRows = entryStrategyReliability?.leaderboard?.slice(0, 5) ?? [];')
text = text.replace('onClick={() => { refetch(); refetchDecision(); refetchEntryScore(); refetchEntryStatus(); }}', 'onClick={() => { refetch(); refetchDecision(); refetchEntryScore(); refetchEntryStatus(); refetchEntryReliability(); }}')

# Add OOS validation block before nearest similar samples.
anchor = '''                {(entryScore.nearestSamples?.length ?? 0) > 0 && (
                  <div className="rounded-lg bg-[#1c2030] p-2 space-y-1.5">
                    <div className="text-[9px] text-[#8896b0] uppercase font-bold tracking-wider">最近相似樣本</div>
'''
oos_block = '''                {entryValidation && (
                  <div className="rounded-lg border border-[#5b8af5]/20 bg-[#5b8af5]/5 p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[9px] text-[#5b8af5] uppercase font-bold tracking-wider">OOS 泛化驗證</div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ color: entryValidationColor, background: `${entryValidationColor}1A` }}>
                        {entryValidationVerdictLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">Edge</div><div className="font-mono font-bold text-[#e2e8f0]">{entryValidation.edgeScore}</div></div>
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">OOS 勝率</div><div className="font-mono font-bold text-[#e2e8f0]">{Math.round((entryValidation.oosWinRate ?? 0) * 100)}%</div></div>
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">平均 R</div><div className="font-mono font-bold text-[#e2e8f0]">{entryValidation.oosAvgRMultiple?.toFixed?.(2) ?? "--"}</div></div>
                      <div className="rounded bg-[#111827] p-1.5"><div className="text-[#64748b]">過擬合</div><div className="font-mono font-bold" style={{ color: (entryValidation.overfitRisk ?? 100) <= 40 ? "#26d48a" : (entryValidation.overfitRisk ?? 100) <= 65 ? "#f5a623" : "#f04f5e" }}>{entryValidation.overfitRisk}</div></div>
                    </div>
                    <div className="text-[9px] text-[#8896b0] leading-relaxed">
                      訓練 {entryValidation.trainSampleCount} 筆 / 驗證 {entryValidation.testSampleCount} 筆；驗證段放行 {entryValidation.predictedTradeCount} 筆，覆蓋率 {Math.round((entryValidation.coverage ?? 0) * 100)}%。
                    </div>
                    {(entryValidation.notes ?? []).slice(0, 2).map((note: string, idx: number) => (
                      <div key={idx} className="text-[9px] text-[#cbd5e1] leading-relaxed">{note}</div>
                    ))}
                  </div>
                )}

                {strategyTopRows.length > 0 && (
                  <div className="rounded-lg border border-[#252b3a] bg-[#0f1520] p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[9px] text-[#8896b0] uppercase font-bold tracking-wider">目前 Regime 策略可靠度</div>
                      <span className="text-[9px] text-[#64748b]">{entryStrategyReliability?.currentRegime ?? "--"}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1 text-[9px] text-[#64748b] font-bold">
                      <span>#</span><span className="col-span-2">策略</span><span>分數</span><span>OOS</span><span>建議</span>
                    </div>
                    {strategyTopRows.map((row) => {
                      const strategyLabel = ENTRY_STRATEGIES.find(s => s.value === row.strategy)?.label ?? row.strategy;
                      const recColor = row.recommendation === "優先" ? "#26d48a" : row.recommendation === "可觀察" ? "#5b8af5" : row.recommendation === "保守" ? "#f5a623" : "#f04f5e";
                      return (
                        <div key={row.strategy} className="grid grid-cols-6 gap-1 text-[9px] text-[#cbd5e1] items-center">
                          <span className="font-mono">{row.rank}</span>
                          <span className="col-span-2 truncate">{strategyLabel}</span>
                          <span className="font-mono font-bold text-[#e2e8f0]">{row.reliabilityScore}</span>
                          <span className="font-mono">{Math.round((row.validation?.oosWinRate ?? 0) * 100)}%</span>
                          <span style={{ color: recColor }}>{row.recommendation}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

'''
if 'OOS 泛化驗證' not in text:
    text = text.replace(anchor, oos_block + anchor)

p.write_text(text)
print('applied v6.4.3 frontend patch')
