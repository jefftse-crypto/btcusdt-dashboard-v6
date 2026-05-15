/**
 * SmcUnifiedPanel.tsx
 * SMC 統一面板 — 將 SmcPanel + SmcUltimatePanel + SmcConfirmPanel 完整融合
 * 結構：頂部摘要列 → 七個 Tab（概覽 / 流動性 / FVG / OB / 結構 / 確認模型 / 多時段）
 */
import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, AlertTriangle, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SmcData } from "@shared/cryptoTypes";

// ─── 型別 ────────────────────────────────────────────────────────────────────

interface SmcConfirmationSetup {
  id: string;
  direction: "bullish" | "bearish";
  sweep: { type: "SSL" | "BSL"; swept_level: number; sweep_time: number; sweep_candle_idx: number };
  fvg: { type: "bullish" | "bearish"; top: number; bottom: number; mid: number; time: number; filled: boolean; size: number; idx: number };
  ob: { type: "bullish" | "bearish"; top: number; bottom: number; mid: number; time: number; tested: boolean; strength: "strong" | "normal"; idx: number };
  confluence_score: number;
  htf_aligned: boolean;
  entry_zone: { top: number; bottom: number };
  sl: number;
  tp1: number;
  tp2: number;
  rr_ratio: number;
  status: "active" | "waiting" | "completed";
  formed_at: number;
}

interface AdvancedData {
  smc_confirmations?: SmcConfirmationSetup[];
  [key: string]: unknown;
}

interface Props {
  smc: SmcData | undefined;
  advanced?: AdvancedData | null;
  isLoading: boolean;
  currentPrice?: number | null;
}

// ─── 工具函數 ────────────────────────────────────────────────────────────────

const fmt = (v: number | undefined | null, d = 2) =>
  v == null || isNaN(v) ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

// ─── 子元件 ──────────────────────────────────────────────────────────────────

function ConfirmCheck({ label, passed, detail, warning }: {
  label: string; passed: boolean | null; detail?: string; warning?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${
      warning ? "border-yellow-500/40 bg-yellow-500/5" :
      passed === true ? "border-emerald-500/30 bg-emerald-500/5" :
      passed === false ? "border-red-500/30 bg-red-500/5" :
      "border-border bg-muted/20"
    }`}>
      {warning ? <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" /> :
       passed === true ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /> :
       passed === false ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /> :
       <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
      <div>
        <div className={`text-xs font-semibold ${
          warning ? "text-yellow-400" :
          passed === true ? "text-emerald-400" : passed === false ? "text-red-400" : "text-muted-foreground"
        }`}>{label}</div>
        {detail && <div className="text-[11px] text-muted-foreground mt-0.5">{detail}</div>}
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#00e676" : score >= 65 ? "#ffd740" : "#ff9800";
  return (
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ background: `conic-gradient(${color} ${score * 3.6}deg, #222 0deg)`, boxShadow: `0 0 8px ${color}40` }}>
        <div className="w-9 h-9 rounded-full bg-[#0d0d0d] flex items-center justify-center">
          <span style={{ color }}>{score}</span>
        </div>
      </div>
      <div className="text-[9px] text-[#555] mt-1">評分</div>
    </div>
  );
}

function SetupCard({ setup }: { setup: SmcConfirmationSetup }) {
  const isBull = setup.direction === "bullish";
  const color = isBull ? "#00e676" : "#f44336";
  return (
    <div className="rounded-xl p-4 space-y-3"
      style={{ background: isBull ? "rgba(0,230,118,0.04)" : "rgba(244,67,54,0.04)", border: `1px solid ${isBull ? "rgba(0,230,118,0.2)" : "rgba(244,67,54,0.2)"}` }}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color }}>{isBull ? "↑ 看多確認模型" : "↓ 看空確認模型"}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                color: setup.status === "active" ? "#00e676" : setup.status === "waiting" ? "#ffd740" : "#888",
                background: setup.status === "active" ? "rgba(0,230,118,0.15)" : setup.status === "waiting" ? "rgba(255,215,64,0.1)" : "rgba(136,136,136,0.1)"
              }}>
              {setup.status === "active" ? "● 進場中" : setup.status === "waiting" ? "◐ 等待" : "✓ 已完成"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#666]">
            {setup.htf_aligned && <span className="text-[#4fc3f7]">✓ 高時框對齊</span>}
            <span>RR: 1:{setup.rr_ratio}</span>
          </div>
        </div>
        <ScoreRing score={setup.confluence_score} />
      </div>

      {/* 三步確認流程 */}
      <div className="space-y-2">
        <div className="text-[10px] text-[#666] font-semibold">三步確認流程（清掃 → FVG → OB）</div>
        {[
          {
            step: 1,
            title: `流動性清掃 (${setup.sweep.type})`,
            desc: `清掃 ${setup.sweep.type === "SSL" ? "賣方止損流動性（SSL）" : "買方止損流動性（BSL）"} @ ${setup.sweep.swept_level.toFixed(2)}`,
            note: setup.ob.tested ? "⚠️ OB 已測試 — 注意 Inducement 風險" : "✓ OB 未測試 — 清掃品質良好",
            noteColor: setup.ob.tested ? "#ffd740" : "#00e676",
            done: true,
          },
          {
            step: 2,
            title: `FVG 位移 (${setup.fvg.type === "bullish" ? "看多" : "看空"})`,
            desc: `${setup.fvg.bottom.toFixed(2)} – ${setup.fvg.top.toFixed(2)}${setup.fvg.filled ? " (已填補)" : ` (大小 ${(setup.fvg.size * 100).toFixed(2)}%)`}`,
            done: true,
          },
          {
            step: 3,
            title: `OB 回踩 (${setup.ob.strength === "strong" ? "強" : "普通"} OB)`,
            desc: `${setup.ob.bottom.toFixed(2)} – ${setup.ob.top.toFixed(2)}${setup.ob.tested ? " ✓ 已測試" : " ◐ 等待回踩"}`,
            done: setup.ob.tested,
          },
        ].map(({ step, title, desc, note, noteColor, done }) => (
          <div key={step} className="flex items-start gap-2 rounded p-2" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
            <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: done ? "rgba(0,230,118,0.2)" : "rgba(79,195,247,0.2)", color: done ? "#00e676" : "#4fc3f7" }}>
              {step}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#ccc]">{title}</div>
              <div className="text-[10px] text-[#777] mt-0.5">{desc}</div>
              {note && <div className="text-[9px] mt-1" style={{ color: noteColor }}>{note}</div>}
            </div>
            <span className={`text-[10px] flex-shrink-0 ${done ? "text-[#00e676]" : "text-[#ffd740]"}`}>{done ? "✓" : "◐"}</span>
          </div>
        ))}
      </div>

      {setup.ob.tested && (
        <div className="rounded p-2" style={{ background: "rgba(255,215,64,0.05)", border: "1px solid rgba(255,215,64,0.2)" }}>
          <div className="text-[10px] text-[#ffd740] font-semibold">⚠️ LIT Inducement 注意</div>
          <div className="text-[9px] text-[#888] mt-0.5">此 OB 已被測試，強度降低。根據 Waqar Asim LIT 理論，已測試的 OB 可能是機構誘騙散戶的 Inducement 陷阱。建議搭配更高時間框架確認後再入場。</div>
        </div>
      )}

      <div className="rounded-lg p-3" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
        <div className="text-[10px] text-[#666] mb-2 font-semibold">進場參數</div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {[
            { label: "進場區間", val: `${setup.entry_zone.bottom.toFixed(2)} – ${setup.entry_zone.top.toFixed(2)}`, color: "#ccc" },
            { label: "止損", val: setup.sl.toFixed(2), color: "#f44336" },
            { label: "目標 1", val: setup.tp1.toFixed(2), color: "#00e676" },
            { label: "目標 2", val: setup.tp2.toFixed(2), color: "#4fc3f7" },
          ].map(({ label, val, color: c }) => (
            <div key={label}>
              <div className="text-[#555]">{label}</div>
              <div className="font-mono" style={{ color: c }}>{val}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-[#1a1a1a] flex items-center justify-between">
          <span className="text-[10px] text-[#555]">風報比</span>
          <span className="text-xs font-bold text-[#ffd740]">1:{setup.rr_ratio}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 主元件 ──────────────────────────────────────────────────────────────────

export function SmcUnifiedPanel({ smc, advanced, isLoading, currentPrice }: Props) {
  const [activeTab, setActiveTab] = useState("overview");

  const ext = smc as (SmcData & {
    premium_discount?: { equilibrium: number; current_zone: string; percent_position: number };
    ote_zone?: { direction: string; fib_618: number; fib_705: number; fib_786: number; swing_high: number; swing_low: number; in_zone: boolean } | null;
    liquidity_levels?: Array<{ price: number; type: string; swept: boolean; strength: string }>;
    recent_swing_high?: number;
    recent_swing_low?: number;
  }) | undefined;

  const pd = ext?.premium_discount;
  const ote = ext?.ote_zone;
  const liqLevels = ext?.liquidity_levels ?? [];
  const swingHigh = ext?.recent_swing_high ?? 0;
  const swingLow  = ext?.recent_swing_low ?? 0;
  const close = smc ? (smc.liquidity.nearest_sell + smc.liquidity.nearest_buy) / 2 : 0;

  // 確認模型（來自 advanced.smc_confirmations）
  const setups = (advanced?.smc_confirmations ?? []) as SmcConfirmationSetup[];
  const activeSetups  = setups.filter(s => s.status === "active");
  const waitingSetups = setups.filter(s => s.status === "waiting");

  // 三重確認邏輯（來自 SmcConfirmPanel）
  const confirmChecks = useMemo(() => {
    if (!smc || !currentPrice) return null;
    const price = currentPrice;
    const hasSweep = liqLevels.some(l => l.swept);
    const hasFvg = !!(smc.nearest_bull_fvg || smc.nearest_bear_fvg);
    const hasOb  = !!(smc.nearest_bull_ob  || smc.nearest_bear_ob);
    const inDiscount = pd ? pd.current_zone === "discount" : null;
    const inOte = ote?.in_zone ?? false;
    const isBull = smc.structure === "bullish";
    const isBear = smc.structure === "bearish";

    return {
      structure: { passed: isBull || isBear, label: `市場結構：${isBull ? "多頭" : isBear ? "空頭" : "震盪"}`, detail: isBull ? "HH/HL 結構確認，偏多操作" : isBear ? "LH/LL 結構確認，偏空操作" : "結構不明，等待突破" },
      sweep: { passed: hasSweep, label: "流動性清掃", detail: hasSweep ? "已偵測到流動性清掃事件" : "尚未偵測到清掃，等待清掃後再入場" },
      fvg: { passed: hasFvg, label: "FVG 位移確認", detail: hasFvg ? `多頭 FVG: ${fmt(smc.nearest_bull_fvg?.bottom)}–${fmt(smc.nearest_bull_fvg?.top)}` : "無有效 FVG" },
      ob: { passed: hasOb, label: "OB 訂單區塊", detail: hasOb ? `最近 OB 區域已識別` : "無有效 OB" },
      pd: pd ? { passed: isBull ? inDiscount === true : inDiscount === false, label: `Premium/Discount：${pd.current_zone === "premium" ? "Premium 區" : pd.current_zone === "discount" ? "Discount 區" : "均衡區"}`, detail: `位置 ${pd.percent_position.toFixed(1)}%，均衡點 ${fmt(pd.equilibrium)}` } : null,
      ote: { passed: inOte, label: `OTE 最佳入場區${inOte ? "（當前在區間內）" : ""}`, detail: ote ? `Fib 0.618–0.786：${fmt(ote.fib_618)} – ${fmt(ote.fib_786)}` : "無法識別有效擺動區間", warning: !inOte && ote != null },
    };
  }, [smc, currentPrice, liqLevels, pd, ote]);

  if (isLoading && !smc) {
    return (
      <div className="crypto-panel">
        <div className="crypto-panel-header">SMC 市場結構</div>
        <div className="p-3 space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-secondary/50 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!smc) {
    return (
      <div className="crypto-panel p-6 text-center">
        <div className="text-muted-foreground text-sm">請點擊「分析」按鈕取得 SMC 結構數據</div>
      </div>
    );
  }

  const structureLabel = smc.structure === "bullish" ? "多頭結構" : smc.structure === "bearish" ? "空頭結構" : "震盪結構";
  const structureCls = smc.structure === "bullish" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : smc.structure === "bearish" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

  return (
    <div className="space-y-3">
      {/* ── 頂部摘要列 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${structureCls}`}>{structureLabel}</span>
        {pd && (
          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
            pd.current_zone === "premium" ? "bg-red-500/20 text-red-400 border-red-500/30"
            : pd.current_zone === "discount" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
          }`}>
            {pd.current_zone === "premium" ? "Premium 區" : pd.current_zone === "discount" ? "Discount 區" : "均衡區"} ({pd.percent_position.toFixed(0)}%)
          </span>
        )}
        {ote?.in_zone && <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">⚡ OTE 區間</span>}
        {activeSetups.length > 0 && <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">● {activeSetups.length} 個進場中</span>}
        <span className="text-xs text-muted-foreground ml-auto">
          高 <span className="text-red-400 font-mono">{fmt(swingHigh)}</span>
          {" · "}
          低 <span className="text-emerald-400 font-mono">{fmt(swingLow)}</span>
        </span>
      </div>

      {/* ── 七個 Tab ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 h-8 flex flex-wrap gap-0">
          {[
            { id: "overview",   label: "概覽" },
            { id: "confirm",    label: "三重確認" },
            { id: "setups",     label: `確認模型${setups.length > 0 ? ` (${setups.length})` : ""}` },
            { id: "liquidity",  label: "流動性" },
            { id: "fvg",        label: "FVG" },
            { id: "ob",         label: "OB" },
            { id: "structure",  label: "結構事件" },
          ].map(t => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-2.5 h-7">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* ── 概覽 ── */}
        <TabsContent value="overview" className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {pd && (
              <div className="crypto-panel col-span-2 sm:col-span-1">
                <div className="crypto-panel-header">ICT Premium / Discount 區間</div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>SSL（低位）</span>
                    <span>均衡 {fmt(pd.equilibrium)}</span>
                    <span>BSL（高位）</span>
                  </div>
                  <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                    <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${pd.current_zone === "premium" ? "bg-red-500" : pd.current_zone === "discount" ? "bg-emerald-500" : "bg-yellow-500"}`}
                      style={{ width: `${Math.min(100, Math.max(0, pd.percent_position))}%` }} />
                    <div className="absolute top-0 left-1/2 h-full w-0.5 bg-yellow-400/80 -translate-x-1/2" />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-400">Discount（有利買入）</span>
                    <span className={`font-bold ${pd.current_zone === "premium" ? "text-red-400" : pd.current_zone === "discount" ? "text-emerald-400" : "text-yellow-400"}`}>{pd.percent_position.toFixed(1)}%</span>
                    <span className="text-red-400">Premium（有利賣出）</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pd.current_zone === "premium" ? "⚠️ 處於 Premium 區間，ICT 理論不建議追多，等待回調至 Discount"
                      : pd.current_zone === "discount" ? "✅ 處於 Discount 區間，ICT 理論有利於尋找做多機會"
                      : "⚖️ 接近均衡位，等待突破後再入場"}
                  </p>
                </div>
              </div>
            )}
            <div className="crypto-panel col-span-2 sm:col-span-1">
              <div className="crypto-panel-header">ICT 最佳交易入場（OTE）</div>
              <div className="p-3 space-y-2">
                {ote ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${ote.direction === "bullish" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        {ote.direction === "bullish" ? "看多 OTE" : "看空 OTE"}
                      </span>
                      {ote.in_zone && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-400">⚡ 當前在 OTE 區間</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      {[{ label: "0.618", val: ote.fib_618 }, { label: "0.705", val: ote.fib_705 }, { label: "0.786", val: ote.fib_786 }].map(({ label, val }) => (
                        <div key={label} className="bg-secondary/50 rounded p-1.5 text-center">
                          <div className="text-muted-foreground text-xs">{label}</div>
                          <div className="font-mono text-foreground text-xs">{fmt(val)}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">擺動範圍：{fmt(ote.swing_low)} – {fmt(ote.swing_high)}{ote.in_zone ? "，當前在 OTE 最佳入場區" : "，等待回調至 61.8%–78.6%"}</p>
                  </>
                ) : <p className="text-xs text-muted-foreground">無法識別有效擺動區間</p>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "多頭 FVG", val: smc.nearest_bull_fvg ? `${fmt(smc.nearest_bull_fvg.bottom)}–${fmt(smc.nearest_bull_fvg.top)}` : "—", cls: "text-emerald-400" },
              { label: "空頭 FVG", val: smc.nearest_bear_fvg ? `${fmt(smc.nearest_bear_fvg.bottom)}–${fmt(smc.nearest_bear_fvg.top)}` : "—", cls: "text-red-400" },
              { label: "多頭 OB",  val: smc.nearest_bull_ob  ? `${fmt(smc.nearest_bull_ob.bottom)}–${fmt(smc.nearest_bull_ob.top)}` : "—", cls: "text-emerald-400" },
              { label: "空頭 OB",  val: smc.nearest_bear_ob  ? `${fmt(smc.nearest_bear_ob.bottom)}–${fmt(smc.nearest_bear_ob.top)}` : "—", cls: "text-red-400" },
            ].map(({ label, val, cls }) => (
              <div key={label} className="crypto-panel p-2">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className={`text-xs font-mono font-bold ${cls}`}>{val}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── 三重確認（來自 SmcConfirmPanel 邏輯）── */}
        <TabsContent value="confirm" className="mt-3 space-y-3">
          {confirmChecks ? (
            <>
              <div className="space-y-2">
                <ConfirmCheck {...confirmChecks.structure} />
                <ConfirmCheck {...confirmChecks.sweep} />
                <ConfirmCheck {...confirmChecks.fvg} />
                <ConfirmCheck {...confirmChecks.ob} />
                {confirmChecks.pd && <ConfirmCheck {...confirmChecks.pd} />}
                <ConfirmCheck {...confirmChecks.ote} />
              </div>
              {/* 進場建議摘要 */}
              {(() => {
                const checks = [confirmChecks.structure.passed, confirmChecks.sweep.passed, confirmChecks.fvg.passed, confirmChecks.ob.passed];
                const passCount = checks.filter(Boolean).length;
                const allPass = passCount >= 3;
                return (
                  <div className={`p-3 rounded-lg border ${allPass ? "border-emerald-500/30 bg-emerald-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                    <div className={`text-sm font-bold ${allPass ? "text-emerald-400" : "text-yellow-400"}`}>
                      {allPass ? "✅ 三重確認通過，可考慮入場" : `⚠️ 確認條件 ${passCount}/4，繼續等待`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {allPass
                        ? "結構、清掃、FVG、OB 條件均已滿足，可在 OTE 區間尋找精確入場點"
                        : "尚未達到三重確認標準，建議等待更多確認信號後再入場"}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-6">請先分析取得數據</div>
          )}
        </TabsContent>

        {/* ── 確認模型（來自 SmcUltimatePanel）── */}
        <TabsContent value="setups" className="mt-3 space-y-3">
          {setups.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="text-2xl">🔍</div>
              <div className="text-sm text-[#888]">暫無確認模型</div>
              <div className="text-xs text-[#555]">需要：流動性清掃 → FVG 位移 → OB 回踩 三步同時成立</div>
            </div>
          ) : (
            <>
              {activeSetups.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-emerald-400">● 進場中 ({activeSetups.length})</div>
                  {activeSetups.map(s => <SetupCard key={s.id} setup={s} />)}
                </div>
              )}
              {waitingSetups.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-yellow-400">◐ 等待中 ({waitingSetups.length})</div>
                  {waitingSetups.map(s => <SetupCard key={s.id} setup={s} />)}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── 流動性 ── */}
        <TabsContent value="liquidity" className="mt-3 space-y-3">
          <div className="crypto-panel">
            <div className="crypto-panel-header">ICT 流動性層級（BSL / SSL）</div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground mb-3">
                <span className="text-blue-400 font-semibold">BSL（買方流動性）</span>：擺動高點上方，空頭止損聚集。
                <span className="text-orange-400 font-semibold"> SSL（賣方流動性）</span>：擺動低點下方，多頭止損聚集。
              </p>
              <div className="space-y-2">
                {liqLevels.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">未識別到流動性層級</p>
                ) : (
                  liqLevels.slice().sort((a, b) => b.price - a.price).map((level, i) => {
                    const isBsl = level.type === "BSL";
                    const dist = close > 0 ? ((level.price - close) / close * 100) : 0;
                    return (
                      <div key={i} className={`flex items-center justify-between p-2 rounded border text-xs ${level.swept ? "opacity-40 border-border" : isBsl ? "border-blue-500/30 bg-blue-500/5" : "border-orange-500/30 bg-orange-500/5"}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${isBsl ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"}`}>{level.type}</span>
                          {level.strength === "strong" && <span className="text-yellow-400">★</span>}
                          {level.swept && <span className="text-muted-foreground text-xs">已掃</span>}
                        </div>
                        <span className="font-mono font-bold text-foreground">{fmt(level.price)}</span>
                        <span className={`font-mono ${dist >= 0 ? "text-blue-400" : "text-orange-400"}`}>{pct(dist)}</span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-secondary/40 rounded p-2">
                  <div className="text-xs text-muted-foreground mb-1">最近 BSL 目標</div>
                  <div className="font-mono text-blue-400 font-bold text-sm">{fmt(smc.liquidity.nearest_sell)}</div>
                </div>
                <div className="bg-secondary/40 rounded p-2">
                  <div className="text-xs text-muted-foreground mb-1">最近 SSL 目標</div>
                  <div className="font-mono text-orange-400 font-bold text-sm">{fmt(smc.liquidity.nearest_buy)}</div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── FVG ── */}
        <TabsContent value="fvg" className="mt-3 space-y-3">
          <div className="crypto-panel">
            <div className="crypto-panel-header">公平價值缺口（FVG）— 共 {smc.fvg_count} 個</div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground mb-3">三根K線之間的價格缺口，代表快速移動留下的未成交區域。<span className="text-emerald-400"> 多頭 FVG</span> 通常作為支撐；<span className="text-red-400"> 空頭 FVG</span> 通常作為阻力。</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "最近多頭 FVG（支撑）", fvg: smc.nearest_bull_fvg, cls: "emerald" },
                  { label: "最近空頭 FVG（阻力）", fvg: smc.nearest_bear_fvg, cls: "red" },
                ].map(({ label, fvg, cls }) => (
                  <div key={label}>
                    <div className={`text-xs text-${cls}-400 font-semibold mb-2`}>{label}</div>
                    {fvg ? (() => {
                      const distPct = close > 0 ? ((fvg.mid - close) / close * 100) : 0;
                      return (
                        <div className={`space-y-1.5 bg-${cls}-500/5 rounded p-2 border border-${cls}-500/20`}>
                          {[{ k: "頂部", v: fvg.top }, { k: "底部", v: fvg.bottom }, { k: "中點", v: fvg.mid }, { k: "大小", v: Math.abs(fvg.top - fvg.bottom) }].map(({ k, v }) => (
                            <div key={k} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{k}</span>
                              <span className={`font-mono text-${cls}-400`}>{fmt(v)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">距離</span>
                            <span className="font-mono font-bold text-blue-400">{pct(distPct)}</span>
                          </div>
                          <div className={`text-xs text-${cls}-400`}>{fvg.filled ? "已填補" : "✓ 未填補"}</div>
                        </div>
                      );
                    })() : <p className="text-xs text-muted-foreground">無</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── OB ── */}
        <TabsContent value="ob" className="mt-3 space-y-3">
          <div className="crypto-panel">
            <div className="crypto-panel-header">訂單區塊（Order Block）— 共 {smc.ob_count} 個</div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground mb-3">機構在此區域大量下單後引發強勁衝動走勢的K線。<span className="text-emerald-400"> 多頭 OB</span> 通常作為支撐；<span className="text-red-400"> 空頭 OB</span> 通常作為阻力。</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "最近多頭 OB（支撑）", ob: smc.nearest_bull_ob, cls: "emerald" },
                  { label: "最近空頭 OB（阻力）", ob: smc.nearest_bear_ob, cls: "red" },
                ].map(({ label, ob, cls }) => (
                  <div key={label}>
                    <div className={`text-xs text-${cls}-400 font-semibold mb-2`}>{label}</div>
                    {ob ? (() => {
                      const distPct = close > 0 ? ((ob.mid - close) / close * 100) : 0;
                      return (
                        <div className={`space-y-1.5 bg-${cls}-500/5 rounded p-2 border border-${cls}-500/20`}>
                          {[{ k: "頂部", v: ob.top }, { k: "底部", v: ob.bottom }, { k: "中點", v: ob.mid }].map(({ k, v }) => (
                            <div key={k} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{k}</span>
                              <span className={`font-mono text-${cls}-400`}>{fmt(v)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">距離</span>
                            <span className="font-mono font-bold text-blue-400">{pct(distPct)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">強度</span>
                            <span className={ob.strength === "strong" ? "text-yellow-400" : "text-muted-foreground"}>{ob.strength === "strong" ? "★ 強力" : "一般"}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">測試狀態</span>
                            <span className={ob.tested ? "text-yellow-400" : `text-${cls}-400`}>{ob.tested ? "已測試（強度降低）" : "未測試（強度完整）"}</span>
                          </div>
                        </div>
                      );
                    })() : <p className="text-xs text-muted-foreground">無</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── 結構事件 ── */}
        <TabsContent value="structure" className="mt-3 space-y-3">
          <div className="crypto-panel">
            <div className="crypto-panel-header">BOS / CHoCH / MSS 市場結構事件</div>
            <div className="p-3">
              <div className="text-xs text-muted-foreground mb-3 space-y-1">
                <p><span className="text-blue-400 font-semibold">BOS（結構突破）</span>：延續現有趨勢的突破，確認趨勢方向。</p>
                <p><span className="text-orange-400 font-semibold">CHoCH（結構轉換）</span>：反向突破前一個擺動點，暗示趨勢可能反轉。</p>
                <p><span className="text-purple-400 font-semibold">MSS（市場結構轉移）</span>：趨勢從一個方向轉向另一個方向的關鍵點。</p>
              </div>
              <div className="space-y-2">
                {(!smc.bos_choch || smc.bos_choch.length === 0) ? (
                  <p className="text-xs text-muted-foreground text-center py-3">暫無結構事件</p>
                ) : (
                  smc.bos_choch.slice().reverse().map((item, i) => {
                    const extItem = item as typeof item & { description?: string; time?: number };
                    const timeStr = extItem.time ? new Date(extItem.time).toLocaleString("zh-HK", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
                    return (
                      <div key={i} className={`p-2.5 rounded border ${item.direction === "bullish" ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${item.type === "BOS" ? "bg-blue-500/20 text-blue-400" : item.type === "CHoCH" ? "bg-orange-500/20 text-orange-400" : "bg-purple-500/20 text-purple-400"}`}>{item.type}</span>
                          <span className={`text-xs font-bold ${item.direction === "bullish" ? "text-emerald-400" : "text-red-400"}`}>{item.direction === "bullish" ? "↑ 看多" : "↓ 看空"}</span>
                          <span className="text-xs font-mono text-muted-foreground ml-auto">{fmt(item.level)}</span>
                          {timeStr && <span className="text-[10px] text-muted-foreground/60">{timeStr}</span>}
                        </div>
                        {extItem.description && <p className="text-xs text-muted-foreground">{extItem.description}</p>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
