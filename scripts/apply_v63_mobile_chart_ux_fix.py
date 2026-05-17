from pathlib import Path

root = Path('/home/ubuntu/btcusdt_dashboard_v6')

# --- Dashboard mobile shell and banner fixes ---
dash = root / 'client/src/pages/Dashboard.tsx'
s = dash.read_text()

s = s.replace(
'''  const marketStatusBanner = useMemo(() => {
    if (marketDataConnected && wsStatus === "connected") return null;
    const providerLabel = provider === "kraken_polling" ? "Kraken REST 輪詢" : "最近快照";
    const lastUpdateLabel = lastUpdateTs ? new Date(lastUpdateTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "尚無更新";
    if (wsStatus === "connecting") return `行情連線建立中，暫以 ${providerLabel} 或快照資料顯示。`;
    if (wsStatus === "disconnected" || wsStatus === "error") return wsMessage ?? `行情連線中斷，最後更新：${lastUpdateLabel}。`;
    return wsMessage ?? `行情資料來自 ${providerLabel}，非交易所即時串流；最後更新：${lastUpdateLabel}。`;
  }, [lastUpdateTs, marketDataConnected, provider, wsMessage, wsStatus]);''',
'''  const marketStatusBanner = useMemo(() => {
    if (marketDataConnected && wsStatus === "connected") return null;

    // 手機版優先保留圖表可視區：若仍有最近報價，就不顯示整條橫幅，避免壓縮主圖高度。
    if (isMobile && livePrice !== null && ["fallback", "disconnected", "error"].includes(wsStatus)) return null;

    const providerLabel = provider === "kraken_polling" ? "Kraken REST 輪詢" : "最近快照";
    const lastUpdateLabel = lastUpdateTs ? new Date(lastUpdateTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "尚無更新";
    if (wsStatus === "connecting") return `行情連線建立中，暫以 ${providerLabel} 或快照資料顯示。`;
    if (wsStatus === "disconnected" || wsStatus === "error") return wsMessage ?? `行情重連中，暫用最近資料；最後更新：${lastUpdateLabel}。`;
    return wsMessage ?? `行情資料來自 ${providerLabel}，非交易所即時串流；最後更新：${lastUpdateLabel}。`;
  }, [isMobile, lastUpdateTs, livePrice, marketDataConnected, provider, wsMessage, wsStatus]);'''
)

s = s.replace(
'className="flex h-screen w-screen flex-col overflow-hidden font-sans select-none"',
'className="flex h-[100dvh] min-h-[100svh] w-screen flex-col overflow-hidden font-sans select-none app-mobile-shell"'
)

s = s.replace(
'<KlinePanel symbol={symbol} timeframe={timeframe as "1h" | "4h" | "15m" | "5m"} livePrice={livePrice} height={window.innerHeight - 150} snapshot={snapshot} />',
'<KlinePanel symbol={symbol} timeframe={timeframe as "1h" | "4h" | "15m" | "5m"} livePrice={livePrice} snapshot={snapshot} />'
)

s = s.replace(
'<nav className="h-14 border-t flex items-center justify-around px-1 pb-safe" style={{ background: "#1c2030", borderColor: "#252b3a" }}>',
'<nav className="min-h-14 border-t flex items-center justify-around px-1 pb-safe shrink-0 mobile-bottom-nav" style={{ background: "#1c2030", borderColor: "#252b3a" }}>'
)

dash.write_text(s)

# --- WebSocket state softening ---
hook = root / 'client/src/hooks/useDashboardWebSocket.ts'
s = hook.read_text()
s = s.replace(
'''      ws.onerror = () => {
        if (!mountedRef.current) return;
        setState((prev) => ({
          ...prev,
          status: "error",
          isLive: false,
          marketDataConnected: false,
          message: fallbackToBinance
            ? "即時連線異常，已停用第三方直連回退以避免受限環境反覆失敗。"
            : "即時連線異常，系統將自動重試。",
        }));
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        setState((prev) => ({
          ...prev,
          status: "disconnected",
          isLive: false,
          marketDataConnected: false,
          message: prev.message ?? "即時連線已中斷，系統正在重連。",
        }));''',
'''      ws.onerror = () => {
        if (!mountedRef.current) return;
        setState((prev) => {
          const hasRecentData = prev.lastUpdateTs !== null && Date.now() - prev.lastUpdateTs < 120_000;
          return {
            ...prev,
            status: hasRecentData ? "fallback" : "error",
            isLive: hasRecentData ? prev.isLive : false,
            marketDataConnected: hasRecentData ? prev.marketDataConnected : false,
            message: fallbackToBinance
              ? "即時連線暫時受限，已保留最近行情資料。"
              : "行情重連中，暫用最近資料。",
          };
        });
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        setState((prev) => {
          const hasRecentData = prev.lastUpdateTs !== null && Date.now() - prev.lastUpdateTs < 120_000;
          return {
            ...prev,
            status: hasRecentData ? "fallback" : "disconnected",
            isLive: hasRecentData ? prev.isLive : false,
            marketDataConnected: hasRecentData ? prev.marketDataConnected : false,
            message: prev.message ?? (hasRecentData ? "行情重連中，暫用最近資料。" : "即時連線已中斷，系統正在重連。"),
          };
        });'''
)
hook.write_text(s)

# --- KlinePanel responsive chart sizing and empty state ---
kline = root / 'client/src/components/panels/KlinePanel.tsx'
s = kline.read_text()

s = s.replace(
'''  const { data: candlesRaw } = trpc.crypto.getKlines.useQuery(
    { symbol, timeframe, limit: klineLimit, withIndicators: true },
    { refetchInterval: 60_000 }
  );''',
'''  const { data: candlesRaw, isLoading: candlesLoading, error: candlesError } = trpc.crypto.getKlines.useQuery(
    { symbol, timeframe, limit: klineLimit, withIndicators: true },
    { refetchInterval: 60_000, retry: 2 }
  );'''
)

s = s.replace(
'''  // ── 主圖建立 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; candleSeriesRef.current = null; overlaySeriesRefs.current.clear(); }
    const chart = createChart(container, {
      width: container.clientWidth,
      height: isMobile ? height - 60 : height,''',
'''  const getChartContainerSize = (container: HTMLDivElement, fallbackHeight: number) => {
    const rect = container.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width || container.clientWidth || window.innerWidth || 360));
    const measuredHeight = Math.floor(rect.height || container.clientHeight || fallbackHeight);
    const minHeight = isMobile ? 260 : 240;
    return { width, height: Math.max(minHeight, measuredHeight) };
  };

  // ── 主圖建立 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; candleSeriesRef.current = null; overlaySeriesRefs.current.clear(); }
    const initialSize = getChartContainerSize(container, isMobile ? Math.max(320, height - 90) : height);
    const chart = createChart(container, {
      width: initialSize.width,
      height: initialSize.height,'''
)

s = s.replace(
'''    const ro = new ResizeObserver(() => { if (container && chartRef.current) chartRef.current.applyOptions({ width: container.clientWidth }); });
    ro.observe(container);''',
'''    const ro = new ResizeObserver(() => {
      if (container && chartRef.current) {
        const size = getChartContainerSize(container, isMobile ? Math.max(320, height - 90) : height);
        chartRef.current.applyOptions({ width: size.width, height: size.height });
      }
    });
    ro.observe(container);'''
)

s = s.replace(
'''    const ro = new ResizeObserver(() => { if (container && subChartRef.current) subChartRef.current.applyOptions({ width: container.clientWidth }); });
    ro.observe(container);''',
'''    const ro = new ResizeObserver(() => {
      if (container && subChartRef.current) {
        const rect = container.getBoundingClientRect();
        subChartRef.current.applyOptions({
          width: Math.max(280, Math.floor(rect.width || container.clientWidth || window.innerWidth || 360)),
          height: Math.max(isMobile ? 72 : 86, Math.floor(rect.height || container.clientHeight || (isMobile ? 78 : 90))),
        });
      }
    });
    ro.observe(container);'''
)

s = s.replace(
'''  }, [subChart, activeIndicators, sortedCandles, chartCandles]);''',
'''  }, [subChart, activeIndicators, sortedCandles, chartCandles, isMobile]);'''
)

s = s.replace(
'''      {/* ── 主圖 ── */}
      <div className="flex-1 relative">
        <div ref={chartContainerRef} className="w-full h-full" />
        {isMobile && !hoveredOhlcv && (''',
'''      {/* ── 主圖 ── */}
      <div className="flex-1 relative min-h-[260px]">
        <div ref={chartContainerRef} className="w-full h-full min-h-[260px]" />
        {!chartCandles.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0e1117]/85 z-10 px-6 text-center">
            <div className="space-y-2">
              <BarChart2 size={24} className="mx-auto text-[#5b8af5]" />
              <div className="text-xs font-bold text-[#e2e8f0]">
                {candlesError ? "K 線資料暫時無法載入" : candlesLoading ? "K 線資料載入中" : "尚無可顯示的 K 線資料"}
              </div>
              <div className="text-[10px] text-[#8896b0]">系統會自動重試；你也可以切換週期或降低 K 線數量。</div>
            </div>
          </div>
        )}
        {isMobile && !hoveredOhlcv && chartCandles.length > 0 && ('''
)

s = s.replace(
'''          <div ref={subChartContainerRef} className="w-full" style={{ height: 90 }} />''',
'''          <div ref={subChartContainerRef} className="w-full" style={{ height: isMobile ? 78 : 90 }} />'''
)

kline.write_text(s)

# --- Global CSS safe area and mobile viewport helpers ---
css = root / 'client/src/index.css'
s = css.read_text()
addition = r'''

/* v6.3 手機版視窗與安全區修正 */
html, #root {
  width: 100%;
  height: 100%;
  min-height: 100%;
  background: #0e1117;
}

@supports (height: 100dvh) {
  .app-mobile-shell {
    height: 100dvh;
  }
}

.pb-safe {
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 0px);
}

.mobile-bottom-nav {
  min-height: calc(3.5rem + max(env(safe-area-inset-bottom, 0px), 0px));
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 0px);
}

@media (max-width: 768px) {
  .app-mobile-shell {
    height: 100dvh;
    min-height: 100svh;
  }
}
'''
if 'v6.3 手機版視窗與安全區修正' not in s:
    s = s.rstrip() + addition + '\n'
css.write_text(s)

print('v6.3 mobile chart UX fixes applied')
