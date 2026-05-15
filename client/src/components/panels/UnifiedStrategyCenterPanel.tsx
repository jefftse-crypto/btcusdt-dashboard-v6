import { useMemo, useState, type ReactNode } from "react";
import { Layers, Target, ShieldCheck, Activity, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { StrategyPanel } from "./StrategyPanel";
import { ConsensusPanel } from "./ConsensusPanel";
import { ForecastPanel } from "./ForecastPanel";
import HighWinRatePanel from "./HighWinRatePanel";
import { CannonballPanel } from "./CannonballPanel";
import PandaPanel from "./PandaPanel";
import { ComboStrategyPanel } from "./ComboStrategyPanel";
import { SignalAlertPanel } from "./SignalAlertPanel";
import { ChampionAnalysisPanel } from "./ChampionAnalysisPanel";
import { BacktestPanel } from "./BacktestPanel";

interface Props {
  snapshot: any;
  symbol: string;
  isLoading: boolean;
  currentPrice?: number | null;
  lastPriceUpdateTs?: number | null;
  wsStatus?: "connecting" | "connected" | "disconnected" | "error" | "fallback";
}

function Section({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg overflow-hidden bg-[#1e222d] border border-[#2a2e39] mb-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors hover:bg-[#2a2e39]/50"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 bg-[#2962ff]/10 text-[#2962ff]">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#d1d4dc] uppercase tracking-wider">{title}</div>
            <div className="text-[10px] text-[#787b86] mt-0.5 truncate">{subtitle}</div>
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-[#787b86]" /> : <ChevronDown size={14} className="text-[#787b86]" />}
      </button>
      {open && <div className="p-3 md:p-4 space-y-4 border-t border-[#2a2e39] bg-[#131722]/30">{children}</div>}
    </section>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "long" | "short" | "wait" | "neutral" }) {
  const color = tone === "long" ? "#089981" : tone === "short" ? "#f23645" : tone === "wait" ? "#f59e0b" : "#d1d4dc";
  const bgColor = tone === "long" ? "rgba(8, 153, 129, 0.05)" : tone === "short" ? "rgba(242, 54, 69, 0.05)" : "rgba(120, 123, 134, 0.05)";
  const borderColor = tone === "long" ? "rgba(8, 153, 129, 0.2)" : tone === "short" ? "rgba(242, 54, 69, 0.2)" : "rgba(120, 123, 134, 0.2)";

  return (
    <div className="rounded border p-2.5 transition-all hover:border-[#2962ff]/30" style={{ background: bgColor, borderColor: borderColor }}>
      <div className="text-[9px] text-[#787b86] mb-1 uppercase font-bold tracking-tighter">{label}</div>
      <div className="text-xs font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  );
}

export function UnifiedStrategyCenterPanel({
  snapshot,
  symbol,
  isLoading,
  currentPrice = null,
  lastPriceUpdateTs = null,
  wsStatus = "disconnected",
}: Props) {
  const overview = useMemo(() => {
    const direction = snapshot?.strategy?.direction ?? "neutral";
    const tone = direction === "long" ? "long" : direction === "short" ? "short" : "wait";
    const directionLabel = direction === "long" ? "做多 (Long)" : direction === "short" ? "做空 (Short)" : "觀望 (Wait)";
    const consensusScore = snapshot?.consensus?.score ?? snapshot?.consensus?.consensus_score ?? null;
    const rr = snapshot?.strategy?.rr_ratio ?? null;
    return { tone, directionLabel, consensusScore, rr };
  }, [snapshot]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="rounded-lg p-4 bg-[#1e222d] border border-[#2a2e39] shadow-lg">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-[#2962ff] rounded shadow-lg shadow-[#2962ff]/20">
              <Zap size={14} className="text-white" />
            </div>
            <div className="text-sm font-bold text-white uppercase tracking-tight">統一策略中心</div>
          </div>
          <div className="text-[10px] text-[#787b86] leading-relaxed">
            整合策略建議、高勝率模型、CannonBall 與回測模組，提供全方位的交易決策支援。
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SummaryCard label="核心方向" value={overview.directionLabel} tone={overview.tone as any} />
          <SummaryCard label="共識評分" value={overview.consensusScore == null ? "—" : `${Math.round(Number(overview.consensusScore))}`} />
          <SummaryCard label="風險回報比" value={overview.rr == null ? "—" : Number(overview.rr).toFixed(2)} />
          <SummaryCard label="交易對" value={symbol} />
        </div>
      </div>

      <Section
        title="核心交易決策"
        subtitle="策略建議、入場風控、共識評分與預測情境。"
        icon={<Target size={16} />}
        defaultOpen={true}
      >
        <StrategyPanel
          strategy={snapshot?.strategy}
          symbol={symbol}
          isLoading={isLoading}
          currentPrice={currentPrice}
          lastPriceUpdateTs={lastPriceUpdateTs}
          wsStatus={wsStatus}
        />
        <div className="grid grid-cols-1 gap-4">
          <ConsensusPanel consensus={snapshot?.consensus as never} isLoading={isLoading} />
          <ForecastPanel forecast={snapshot?.forecast_4h} isLoading={isLoading} />
        </div>
      </Section>

      <Section
        title="專家模型與組合"
        subtitle="CannonBall、熊貓策略與組合信號對比。"
        icon={<Layers size={16} />}
        defaultOpen={false}
      >
        <HighWinRatePanel symbol={symbol} />
        <div className="space-y-4">
          <CannonballPanel symbol={symbol} />
          <ComboStrategyPanel symbol={symbol} />
          <PandaPanel symbol={symbol} />
          <ChampionAnalysisPanel snapshot={snapshot} currentPrice={currentPrice} isLoading={isLoading} symbol={symbol} />
        </div>
      </Section>

      <Section
        title="執行與驗證"
        subtitle="即時告警與歷史績效回測。"
        icon={<ShieldCheck size={16} />}
        defaultOpen={false}
      >
        <SignalAlertPanel symbol={symbol} />
        <BacktestPanel symbol={symbol} />
      </Section>

      <div className="rounded-lg p-3 text-[10px] flex items-start gap-2 bg-[#2962ff]/5 border border-[#2962ff]/20 text-[#787b86]">
        <Activity size={14} className="mt-0.5 shrink-0 text-[#2962ff]" />
        <div>
          策略數據已與 V8 引擎同步。所有分析均基於當前市場結構與多時間框架共識。
        </div>
      </div>
    </div>
  );
}
