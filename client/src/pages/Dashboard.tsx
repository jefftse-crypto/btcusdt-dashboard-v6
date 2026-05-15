import { useState, useMemo, lazy, Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { useLiveTicker } from "@/hooks/useDashboardWebSocket";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  TrendingUp, TrendingDown, BarChart2, Activity, Brain,
  Settings, Bell, Search, Info, Target,
  Zap, ChevronRight, List, History,
  Maximize2, Newspaper, PieChart, ChevronDown
} from "lucide-react";
import { SUPPORTED_SYMBOLS, type CryptoSnapshot } from "@shared/cryptoTypes";

// 懶加載面板
const KlinePanel = lazy(() => import("@/components/panels/KlinePanel").then(m => ({ default: m.KlinePanel })));
const ScreenerPanel = lazy(() => import("@/components/panels/ScreenerPanel"));
const UnifiedStrategyCenterPanel = lazy(() => import("@/components/panels/UnifiedStrategyCenterPanel").then(m => ({ default: m.UnifiedStrategyCenterPanel })));
const BacktestPanel = lazy(() => import("@/components/panels/BacktestPanel").then(m => ({ default: m.BacktestPanel })));
const IndicatorsPanel = lazy(() => import("@/components/panels/IndicatorsPanel").then(m => ({ default: m.IndicatorsPanel })));
const SmcPanel = lazy(() => import("@/components/panels/SmcPanel").then(m => ({ default: m.SmcPanel })));
const PaPanel = lazy(() => import("@/components/panels/PaPanel").then(m => ({ default: m.PaPanel })));
const ChanPanel = lazy(() => import("@/components/panels/ChanPanel").then(m => ({ default: m.ChanPanel })));
const NewsPanel = lazy(() => import("@/components/panels/NewsPanel").then(m => ({ default: m.NewsPanel })));

// 常用幣種（頂部快速切換）
const QUICK_SYMBOLS = [
  { value: "BTCUSDT",  label: "BTC",  color: "#f7931a" },
  { value: "ETHUSDT",  label: "ETH",  color: "#627eea" },
  { value: "SOLUSDT",  label: "SOL",  color: "#9945ff" },
  { value: "BNBUSDT",  label: "BNB",  color: "#f3ba2f" },
  { value: "XRPUSDT",  label: "XRP",  color: "#00aae4" },
  { value: "DOGEUSDT", label: "DOGE", color: "#c2a633" },
  { value: "ADAUSDT",  label: "ADA",  color: "#0033ad" },
  { value: "AVAXUSDT", label: "AVAX", color: "#e84142" },
];

export default function Dashboard() {
  const isMobile = useIsMobile();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [activeSidebarTab, setActiveSidebarTab] = useState("chart");
  const [rightPanelTab, setRightPanelTab] = useState("strategy");
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [symbolDropdownOpen, setSymbolDropdownOpen] = useState(false);

  const {
    livePrice,
    change24h,
    status: wsStatus,
    provider,
    marketDataConnected,
    lastUpdateTs,
    message: wsMessage,
  } = useLiveTicker(symbol);

  const { data: snapshotRaw, isLoading: isAnalyzing } = trpc.crypto.getSnapshot.useQuery(
    { symbol },
    { refetchInterval: 30000 }
  );
  // [改良] 使用嚴格的 CryptoSnapshot 型別，消除 as any 轉型
  const snapshot: CryptoSnapshot | undefined = snapshotRaw as CryptoSnapshot | undefined;

  const sidebarItems = [
    { id: "chart",    icon: <BarChart2 size={20} />,  label: "圖表" },
    { id: "screener", icon: <Search size={20} />,     label: "篩選" },
    { id: "strategy", icon: <Brain size={20} />,      label: "策略" },
    { id: "alerts",   icon: <Bell size={20} />,       label: "警報" },
    { id: "settings", icon: <Settings size={20} />,   label: "設定" },
  ];

  const mobileNavItems = [
    { id: "chart",     icon: <BarChart2 size={17} />,  label: "圖表" },
    { id: "indicators",icon: <Activity size={17} />,   label: "指標" },
    { id: "smc",       icon: <Target size={17} />,     label: "SMC" },
    { id: "pa",        icon: <List size={17} />,       label: "PA" },
    { id: "chan",      icon: <PieChart size={17} />,   label: "纏論" },
    { id: "strategy",  icon: <Brain size={17} />,      label: "策略" },
    { id: "backtest",  icon: <History size={17} />,    label: "回測" },
    { id: "news",      icon: <Newspaper size={17} />,  label: "新聞" },
  ];

  const [mobileActiveTab, setMobileActiveTab] = useState("chart");

  const marketStatusBanner = useMemo(() => {
    if (marketDataConnected && wsStatus === "connected") return null;
    const providerLabel = provider === "kraken_polling" ? "Kraken REST 輪詢" : "最近快照";
    const lastUpdateLabel = lastUpdateTs ? new Date(lastUpdateTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "尚無更新";
    if (wsStatus === "connecting") return `行情連線建立中，暫以 ${providerLabel} 或快照資料顯示。`;
    if (wsStatus === "disconnected" || wsStatus === "error") return wsMessage ?? `行情連線中斷，最後更新：${lastUpdateLabel}。`;
    return wsMessage ?? `行情資料來自 ${providerLabel}，非交易所即時串流；最後更新：${lastUpdateLabel}。`;
  }, [lastUpdateTs, marketDataConnected, provider, wsMessage, wsStatus]);

  const currentSymbolInfo = SUPPORTED_SYMBOLS.find(s => s.value === symbol);
  const isPositive = change24h !== null && change24h >= 0;

  // 幣種選擇器元件
  const SymbolSelector = () => (
    <div className="relative">
      <button
        onClick={() => setSymbolDropdownOpen(p => !p)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#252b3a] hover:bg-[#2d3448] border border-[#2e3548] transition-colors"
      >
        <span className="text-xs font-bold text-[#c8cdd8]">
          {currentSymbolInfo?.label ?? symbol.replace("USDT", "/USDT")}
        </span>
        <ChevronDown size={12} className={`text-[#6b7385] transition-transform ${symbolDropdownOpen ? "rotate-180" : ""}`} />
      </button>
      {symbolDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#1c2030] border border-[#252b3a] rounded-lg shadow-2xl overflow-hidden min-w-[200px]">
          {/* 快速切換 */}
          <div className="px-3 py-2 border-b border-[#252b3a]">
            <div className="text-[9px] text-[#6b7385] uppercase font-bold mb-1.5">常用幣種</div>
            <div className="grid grid-cols-4 gap-1">
              {QUICK_SYMBOLS.map(s => (
                <button
                  key={s.value}
                  onClick={() => { setSymbol(s.value); setSymbolDropdownOpen(false); }}
                  className={`text-[10px] font-bold py-1 px-1.5 rounded transition-all ${
                    symbol === s.value
                      ? "text-white"
                      : "text-[#9ba3b5] hover:text-white hover:bg-[#252b3a]"
                  }`}
                  style={symbol === s.value ? { backgroundColor: s.color + "30", color: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {/* 全部幣種 */}
          <div className="px-3 py-2 max-h-48 overflow-y-auto custom-scrollbar">
            <div className="text-[9px] text-[#6b7385] uppercase font-bold mb-1.5">全部幣種</div>
            {SUPPORTED_SYMBOLS.map(s => (
              <button
                key={s.value}
                onClick={() => { setSymbol(s.value); setSymbolDropdownOpen(false); }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                  symbol === s.value
                    ? "bg-[#4f7cff]/15 text-[#4f7cff]"
                    : "text-[#9ba3b5] hover:bg-[#252b3a] hover:text-[#c8cdd8]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">{s.icon}</span>
                  <span className="font-medium">{s.label}</span>
                </span>
                {symbol === s.value && <span className="text-[9px] text-[#4f7cff]">●</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden font-sans select-none"
      style={{ background: "#141820", color: "#c8cdd8" }}
      onClick={() => { if (symbolDropdownOpen) setSymbolDropdownOpen(false); }}
    >
      {/* ── Top Navigation Bar ── */}
      <header
        className="flex h-12 items-center justify-between px-3 sm:px-4 z-30 border-b"
        style={{ background: "#1c2030", borderColor: "#252b3a" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 font-bold">
            <div className="bg-[#4f7cff] p-1 rounded shadow-lg shadow-[#4f7cff]/20">
              <Zap size={15} className="text-white" />
            </div>
            <span className="tracking-tight hidden xs:inline text-sm text-[#c8cdd8]">MANUS PRO</span>
          </div>

          <div className="h-5 w-px bg-[#252b3a] hidden xs:block" />

          {/* 幣種選擇器 */}
          <SymbolSelector />

          {/* 價格顯示 */}
          <div className="flex flex-col items-end">
            <span className={`text-xs sm:text-sm font-mono font-bold leading-tight ${isPositive ? "text-[#2ecc8a]" : "text-[#e05c6a]"}`}>
              {livePrice?.toLocaleString() ?? "---"}
            </span>
            <span className={`text-[9px] sm:text-[10px] font-mono leading-tight ${isPositive ? "text-[#2ecc8a]" : "text-[#e05c6a]"}`}>
              {change24h !== null ? `${isPositive ? "+" : ""}${change24h.toFixed(2)}%` : "---"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* 時間框架選擇 */}
          <div className="flex items-center rounded p-0.5" style={{ background: "#252b3a" }}>
            {["5m", "15m", "1h", "4h"].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded transition-all ${
                  timeframe === tf
                    ? "text-[#4f7cff] shadow-sm"
                    : "text-[#6b7385] hover:text-[#c8cdd8]"
                }`}
                style={timeframe === tf ? { background: "#141820" } : {}}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          {!isMobile && (
            <button className="p-1.5 text-[#6b7385] hover:text-[#c8cdd8] transition-colors">
              <Maximize2 size={16} />
            </button>
          )}
        </div>
      </header>

      {/* 行情降級橫幅 */}
      {marketStatusBanner && (
        <div className="border-b px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs flex items-center gap-2 z-20"
          style={{ borderColor: "#3d4a2a", background: "#2a3020", color: "#a8b87a" }}>
          <Info size={13} className="shrink-0" style={{ color: "#8a9e5a" }} />
          <span>{marketStatusBanner}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Desktop Left Sidebar ── */}
        {!isMobile && (
          <aside className="flex w-12 flex-col items-center py-4 z-20 border-r" style={{ background: "#1c2030", borderColor: "#252b3a" }}>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSidebarTab(item.id)}
                className={`group relative flex h-12 w-12 items-center justify-center transition-colors ${
                  activeSidebarTab === item.id ? "text-[#4f7cff]" : "text-[#6b7385] hover:text-[#c8cdd8]"
                }`}
              >
                {item.icon}
                {activeSidebarTab === item.id && (
                  <div className="absolute right-0 h-full w-0.5 bg-[#4f7cff]" />
                )}
                <div className="absolute left-14 z-50 hidden group-hover:block whitespace-nowrap rounded px-2 py-1 text-[10px] text-[#c8cdd8] shadow-xl" style={{ background: "#2d3448" }}>
                  {item.label}
                </div>
              </button>
            ))}
            <div className="mt-auto flex flex-col items-center gap-4 pb-4">
              <button className="text-[#6b7385] hover:text-[#c8cdd8] transition-colors">
                <Settings size={20} />
              </button>
            </div>
          </aside>
        )}

        {/* ── Main Workspace ── */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {isMobile ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden relative">
                <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-[#6b7385]">載入中...</div>}>
                  {mobileActiveTab === "chart" && (
                    <div className="h-full w-full flex flex-col" style={{ background: "#141820" }}>
                      <KlinePanel symbol={symbol} timeframe={timeframe as "1h" | "4h" | "15m" | "5m"} livePrice={livePrice} height={window.innerHeight - 150} snapshot={snapshot} />
                    </div>
                  )}
                  {mobileActiveTab === "indicators" && (
                    <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "#1c2030" }}>
                      <IndicatorsPanel snap={snapshot} isAnalyzing={isAnalyzing} />
                    </div>
                  )}
                  {mobileActiveTab === "smc" && (
                    <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "#1c2030" }}>
                      <SmcPanel smc={snapshot?.smc} isLoading={isAnalyzing} currentPrice={livePrice ?? null} />
                    </div>
                  )}
                  {mobileActiveTab === "pa" && (
                    <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "#1c2030" }}>
                      <PaPanel pa={snapshot?.pa} isLoading={isAnalyzing} advanced={snapshot?.advanced as any ?? null} />
                    </div>
                  )}
                  {mobileActiveTab === "chan" && (
                    <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "#1c2030" }}>
                      <ChanPanel chanMtf={snapshot?.chan_mtf} chan={snapshot?.pa?.timeframes?.["4h"]?.chan} timeframe={timeframe} isLoading={isAnalyzing} advanced={snapshot?.advanced as any ?? null} />
                    </div>
                  )}
                  {mobileActiveTab === "strategy" && (
                    <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "#1c2030" }}>
                      <UnifiedStrategyCenterPanel snapshot={snapshot} symbol={symbol} isLoading={isAnalyzing} currentPrice={livePrice ?? null} wsStatus={wsStatus} lastPriceUpdateTs={lastUpdateTs ?? null} />
                    </div>
                  )}
                  {mobileActiveTab === "backtest" && (
                    <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "#1c2030" }}>
                      <BacktestPanel symbol={symbol} />
                    </div>
                  )}
                  {mobileActiveTab === "news" && (
                    <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "#1c2030" }}>
                      <NewsPanel symbol={symbol} />
                    </div>
                  )}
                </Suspense>
              </div>

              {/* 手機底部導覽列 */}
              <nav className="h-14 border-t flex items-center justify-around px-1 pb-safe" style={{ background: "#1c2030", borderColor: "#252b3a" }}>
                {mobileNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMobileActiveTab(item.id)}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all ${
                      mobileActiveTab === item.id ? "text-[#4f7cff]" : "text-[#6b7385]"
                    }`}
                  >
                    <div className={`p-1 rounded-md transition-colors ${mobileActiveTab === item.id ? "bg-[#4f7cff]/10" : ""}`}>
                      {item.icon}
                    </div>
                    <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-tighter">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          ) : (
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={75} minSize={30}>
                <ResizablePanelGroup direction="vertical">
                  <ResizablePanel defaultSize={70} minSize={20}>
                    <div className="h-full w-full relative" style={{ background: "#141820" }}>
                      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-[#6b7385]">圖表載入中...</div>}>
                        <KlinePanel symbol={symbol} timeframe={timeframe as "1h" | "4h" | "15m" | "5m"} livePrice={livePrice} height={window.innerHeight - 300} snapshot={snapshot} />
                      </Suspense>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle className="h-1 hover:bg-[#4f7cff]/20 transition-colors" style={{ background: "#252b3a" }} />

                  <ResizablePanel defaultSize={30} minSize={5}>
                    <div className="h-full w-full overflow-hidden flex flex-col" style={{ background: "#1c2030" }}>
                      <div className="flex h-8 items-center border-b px-4 justify-between" style={{ background: "#141820", borderColor: "#252b3a" }}>
                        <div className="flex gap-4 h-full">
                          <button className="text-[11px] font-bold h-full px-1 border-b-2 border-[#4f7cff] text-[#4f7cff]">策略回測器</button>
                          <button className="text-[11px] font-bold text-[#6b7385] hover:text-[#c8cdd8] h-full px-1 transition-colors">交易日誌</button>
                        </div>
                        <button onClick={() => setBottomPanelOpen(!bottomPanelOpen)} className="text-[#6b7385] hover:text-[#c8cdd8] transition-colors">
                          <ChevronRight size={14} className={bottomPanelOpen ? "rotate-90" : ""} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                        <Suspense fallback={<div className="text-xs text-[#6b7385]">回測模組加載中...</div>}>
                          <BacktestPanel symbol={symbol} />
                        </Suspense>
                      </div>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>

              <ResizableHandle withHandle className="w-1 hover:bg-[#4f7cff]/20 transition-colors" style={{ background: "#252b3a" }} />

              <ResizablePanel defaultSize={25} minSize={15}>
                <div className="h-full w-full border-l flex flex-col" style={{ background: "#1c2030", borderColor: "#252b3a" }}>
                  <div className="flex h-10 items-center border-b px-1 overflow-x-auto custom-scrollbar" style={{ background: "#141820", borderColor: "#252b3a" }}>
                    {["strategy", "indicators", "smc", "pa", "chan", "news"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setRightPanelTab(tab)}
                        className={`min-w-[52px] flex-1 text-[10px] font-bold uppercase tracking-wider h-full transition-all ${
                          rightPanelTab === tab
                            ? "text-[#c8cdd8] border-b-2 border-[#4f7cff]"
                            : "text-[#6b7385] hover:text-[#c8cdd8]"
                        }`}
                      >
                        {tab === "strategy" ? "策略" : tab === "indicators" ? "指標" : tab === "smc" ? "SMC" : tab === "pa" ? "PA" : tab === "chan" ? "纏論" : "新聞"}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    <Suspense fallback={<div className="p-4 text-xs text-[#6b7385]">加載中...</div>}>
                      {rightPanelTab === "strategy" && (
                        <UnifiedStrategyCenterPanel snapshot={snapshot} symbol={symbol} isLoading={isAnalyzing} currentPrice={livePrice ?? null} wsStatus={wsStatus} lastPriceUpdateTs={lastUpdateTs ?? null} />
                      )}
                      {rightPanelTab === "indicators" && (
                        <IndicatorsPanel snap={snapshot} isAnalyzing={isAnalyzing} />
                      )}
                      {rightPanelTab === "smc" && (
                        <SmcPanel smc={snapshot?.smc} isLoading={isAnalyzing} currentPrice={livePrice ?? null} />
                      )}
                      {rightPanelTab === "pa" && (
                        <PaPanel pa={snapshot?.pa} isLoading={isAnalyzing} advanced={snapshot?.advanced as any ?? null} />
                      )}
                      {rightPanelTab === "chan" && (
                        <ChanPanel chanMtf={snapshot?.chan_mtf} chan={snapshot?.pa?.timeframes?.["4h"]?.chan} timeframe={timeframe} isLoading={isAnalyzing} advanced={snapshot?.advanced as any ?? null} />
                      )}
                      {rightPanelTab === "news" && (
                        <NewsPanel symbol={symbol} />
                      )}
                    </Suspense>
                  </div>

                  {/* 底部狀態列 */}
                  <div className="h-8 border-t px-3 flex items-center justify-between" style={{ background: "#141820", borderColor: "#252b3a" }}>
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${marketDataConnected ? "bg-[#2ecc8a] animate-pulse" : "bg-[#e05c6a]"}`}
                        style={marketDataConnected ? { boxShadow: "0 0 5px #2ecc8a" } : {}} />
                      <span className="text-[10px] text-[#6b7385]">{marketDataConnected ? "行情即時" : "行情降級"}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#6b7385]">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </main>
      </div>
    </div>
  );
}
