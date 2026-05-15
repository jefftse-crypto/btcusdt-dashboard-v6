import type { Candle, CryptoSnapshot, IndicatorData } from "@shared/cryptoTypes";

interface Props {
  snap: CryptoSnapshot | null | undefined;
  isAnalyzing: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function rsiColor(rsi: number) {
  if (rsi >= 70) return "#ef5350";
  if (rsi >= 60) return "#ffd740";
  if (rsi <= 30) return "#4caf50";
  if (rsi <= 40) return "#81c784";
  return "#aaa";
}

function macdColor(hist: number) {
  return hist > 0 ? "#4caf50" : "#ef5350";
}

function adxStrength(adx: number) {
  if (adx >= 40) return { label: "極強趨勢", color: "#ef5350" };
  if (adx >= 25) return { label: "強趨勢", color: "#ffd740" };
  if (adx >= 15) return { label: "弱趨勢", color: "#888" };
  return { label: "無趨勢", color: "#555" };
}

function trendLabel(trend: string) {
  if (trend === "bullish") return { label: "多頭", color: "#4caf50" };
  if (trend === "bearish") return { label: "空頭", color: "#ef5350" };
  return { label: "中性", color: "#ffd740" };
}

function momentumLabel(m: string) {
  if (m === "strong_bullish") return { label: "強烈看多", color: "#00e676" };
  if (m === "bullish")        return { label: "看多", color: "#4caf50" };
  if (m === "bearish")        return { label: "看空", color: "#ef5350" };
  if (m === "strong_bearish") return { label: "強烈看空", color: "#f44336" };
  return { label: "中性", color: "#ffd740" };
}

function bbPositionLabel(pctB: number) {
  if (pctB > 0.9) return { label: "超買區", color: "#ef5350" };
  if (pctB > 0.6) return { label: "上軌附近", color: "#ffd740" };
  if (pctB > 0.4) return { label: "中軌附近", color: "#aaa" };
  if (pctB > 0.1) return { label: "下軌附近", color: "#81c784" };
  return { label: "超賣區", color: "#4caf50" };
}
function formatCompact(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: digits }).format(value);
}
function formatPercent(value: number | null | undefined, digits = 3) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}
function formatPrice(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function formatSignedCompact(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const abs = formatCompact(Math.abs(value), digits);
  return `${value >= 0 ? "+" : "-"}${abs}`;
}

function cvdTone(cvd: IndicatorData["cvd"] | null | undefined) {
  if (!cvd) return { label: "無資料", color: "#888" };
  if (cvd.trend === "rising") return { label: "買盤推升", color: "#4caf50" };
  if (cvd.trend === "falling") return { label: "賣盤主導", color: "#ef5350" };
  return { label: "多空均衡", color: "#ffd740" };
}

function buildTpoProfile(candles: Candle[] | undefined, bins = 24) {
  const source = (candles ?? []).slice(-160).filter(c => Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close));
  if (source.length < 10) return null;

  const low = Math.min(...source.map(c => c.low));
  const high = Math.max(...source.map(c => c.high));
  const span = high - low;
  if (!Number.isFinite(span) || span <= 0) return null;

  const counts = Array.from({ length: bins }, () => 0);
  for (const c of source) {
    const typical = (c.high + c.low + c.close) / 3;
    const idx = Math.max(0, Math.min(bins - 1, Math.floor(((typical - low) / span) * bins)));
    counts[idx] += 1;
  }

  const total = counts.reduce((sum, n) => sum + n, 0);
  const pocIdx = counts.reduce((best, n, idx) => n > counts[best] ? idx : best, 0);
  const sorted = counts.map((count, idx) => ({ count, idx })).sort((a, b) => b.count - a.count);
  const selected = new Set<number>();
  let acc = 0;
  for (const item of sorted) {
    selected.add(item.idx);
    acc += item.count;
    if (acc >= total * 0.7) break;
  }
  const selectedIdx = [...selected].sort((a, b) => a - b);
  const priceAt = (idx: number) => low + span * ((idx + 0.5) / bins);
  const vah = priceAt(selectedIdx[selectedIdx.length - 1]);
  const val = priceAt(selectedIdx[0]);
  const poc = priceAt(pocIdx);
  const current = source[source.length - 1]?.close ?? poc;
  const zone = current > vah ? "價值區上方" : current < val ? "價值區下方" : "價值區內";

  return { poc, vah, val, zone, balance: total ? counts[pocIdx] / total : 0 };
}


// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MetricRow({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
      <span className="text-[11px] text-[#888]">{label}</span>
      <div className="text-right">
        <span className="text-[11px] font-mono font-semibold" style={{ color: color ?? "#ccc" }}>{value}</span>
        {sub && <div className="text-[10px] text-[#555]">{sub}</div>}
      </div>
    </div>
  );
}

function TagBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded"
      style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
      <div className="px-3 py-2 border-b text-[11px] font-semibold text-[#888] uppercase tracking-wider"
           style={{ borderColor: "#1e1e1e", background: "#0d0d0d" }}>
        {title}
      </div>
      <div className="px-3 py-1">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeframe column
// ─────────────────────────────────────────────────────────────────────────────

function TfColumn({ tf, ind }: { tf: string; ind: IndicatorData }) {
  const adxObj = ind.adx as unknown as { adx: number; plus_di: number; minus_di: number };
  const adxVal = typeof adxObj?.adx === "number" ? adxObj.adx : (typeof ind.adx === "number" ? ind.adx : 20);
  const plusDi = typeof adxObj?.plus_di === "number" ? adxObj.plus_di : null;
  const minusDi = typeof adxObj?.minus_di === "number" ? adxObj.minus_di : null;
  const { label: adxLbl, color: adxColor } = adxStrength(adxVal);
  const { label: trendLbl, color: trendColor } = trendLabel(ind.trend);
  const { label: momLbl, color: momColor } = momentumLabel(ind.momentum);
  const bbPctB = (ind.bollinger as { percent_b?: number })?.percent_b ?? 0.5;
  const { label: bbLbl, color: bbColor } = bbPositionLabel(bbPctB);
  const macdObj = ind.macd as { macd?: number; signal?: number; histogram?: number };
  const macdHist = macdObj?.histogram ?? 0;

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
      {/* TF header */}
      <div className="px-3 py-2 border-b flex items-center justify-between"
           style={{ borderColor: "#1e1e1e", background: "#0d0d0d" }}>
        <span className="text-xs font-bold text-[#ccc]">{tf}</span>
        <TagBadge label={trendLbl} color={trendColor} />
      </div>

      <div className="px-3 py-1">
        {/* RSI */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">RSI</span>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "#1e1e1e" }}>
              <div className="h-full rounded-full" style={{ width: `${ind.rsi}%`, background: rsiColor(ind.rsi) }} />
            </div>
            <span className="text-[11px] font-mono font-semibold w-10 text-right" style={{ color: rsiColor(ind.rsi ?? 50) }}>
              {(ind.rsi ?? 50).toFixed(1)}
            </span>
          </div>
        </div>

        {/* MACD with mini bar */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">MACD 柱</span>
          <div className="flex items-center gap-2">
            {/* mini bar visualisation */}
            <div className="flex items-end gap-px h-4">
              {[0.3, 0.5, 0.7, 1.0, 0.8, 0.6].map((h, i) => (
                <div key={i} className="w-1 rounded-sm" style={{
                  height: `${h * 100}%`,
                  background: macdHist > 0 ? `rgba(76,175,80,${0.4 + h * 0.5})` : `rgba(239,83,80,${0.4 + h * 0.5})`
                }} />
              ))}
            </div>
            <span className="text-[11px] font-mono font-semibold" style={{ color: macdColor(macdHist) }}>
              {macdHist > 0 ? "+" : ""}{macdHist.toFixed(4)}
            </span>
          </div>
        </div>

        {/* ADX */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">ADX</span>
          <div className="text-right">
            <span className="text-[11px] font-mono font-semibold" style={{ color: adxColor }}>
              {typeof adxVal === "number" ? adxVal.toFixed(1) : "—"}
            </span>
            <div className="text-[10px]" style={{ color: adxColor }}>{adxLbl}</div>
          </div>
        </div>

        {/* DI */}
        {plusDi != null && minusDi != null && (
          <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
            <span className="text-[11px] text-[#888]">+DI / -DI</span>
            <span className="text-[11px] font-mono">
              <span className="text-[#4caf50]">{plusDi.toFixed(1)}</span>
              <span className="text-[#555]"> / </span>
              <span className="text-[#ef5350]">{minusDi.toFixed(1)}</span>
            </span>
          </div>
        )}

        {/* EMA */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">EMA 20</span>
          <span className="text-[11px] font-mono text-[#3b82f6]">
            {ind.ema.ema20.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">EMA 50</span>
          <span className="text-[11px] font-mono text-[#a855f7]">
            {ind.ema.ema50.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">EMA 200</span>
          <span className="text-[11px] font-mono text-[#ef4444]">
            {ind.ema.ema200.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Bollinger */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">布林帶位置</span>
          <TagBadge label={bbLbl} color={bbColor} />
        </div>
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">帶寬</span>
          <span className="text-[11px] font-mono text-[#aaa]">{((ind.bollinger as { bandwidth?: number })?.bandwidth ?? 0).toFixed(2)}%</span>
        </div>

        {/* VWAP */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">VWAP</span>
          <span className="text-[11px] font-mono text-[#ffd740]">
            {formatPrice(ind.vwap)}
          </span>
        </div>

        {/* CVD */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">CVD</span>
          <div className="text-right">
            <span className="text-[11px] font-mono font-semibold" style={{ color: cvdTone(ind.cvd).color }}>
              {formatSignedCompact(ind.cvd?.change)}
            </span>
            <div className="text-[10px]" style={{ color: cvdTone(ind.cvd).color }}>{cvdTone(ind.cvd).label}</div>
          </div>
        </div>

        {/* Stochastic with cross indicator */}
        {(() => {
          const stK = (ind.stochastic as { k?: number })?.k ?? 50;
          const stD = (ind.stochastic as { d?: number })?.d ?? 50;
          const cross = stK > stD ? "金叉" : stK < stD ? "死叉" : "";
          const crossColor = stK > stD ? "#4caf50" : "#ef5350";
          const stColor = stK > 80 ? "#ef5350" : stK < 20 ? "#4caf50" : "#aaa";
          return (
            <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
              <span className="text-[11px] text-[#888]">Stoch K/D</span>
              <div className="flex items-center gap-1.5">
                {cross && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ color: crossColor, background: `${crossColor}20` }}>{cross}</span>}
                <span className="text-[11px] font-mono">
                  <span style={{ color: stColor }}>{stK.toFixed(1)}</span>
                  <span className="text-[#555]"> / </span>
                  <span className="text-[#888]">{stD.toFixed(1)}</span>
                </span>
              </div>
            </div>
          );
        })()}

        {/* ATR */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
          <span className="text-[11px] text-[#888]">ATR</span>
          <span className="text-[11px] font-mono text-[#aaa]">{(ind.atr ?? 0).toFixed(2)}</span>
        </div>

        {/* Momentum */}
        <div className="flex items-center justify-between py-2">
          <span className="text-[11px] text-[#888]">動量</span>
          <TagBadge label={momLbl} color={momColor} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Four-timeframe comparison matrix
// ─────────────────────────────────────────────────────────────────────────────

function IndicatorComparisonMatrix({ frames }: { frames: Array<{ tf: string; ind: IndicatorData }> }) {
  const cellClass = "min-w-[88px] px-2 py-2 text-right text-[11px] font-mono border-l";
  const labelClass = "sticky left-0 z-10 min-w-[92px] px-3 py-2 text-[11px] text-[#888] font-semibold";
  const rowBorder = { borderColor: "#1e1e1e" };

  const rows = [
    {
      label: "趨勢",
      value: (ind: IndicatorData) => trendLabel(ind.trend).label,
      color: (ind: IndicatorData) => trendLabel(ind.trend).color,
    },
    {
      label: "動量",
      value: (ind: IndicatorData) => momentumLabel(ind.momentum).label,
      color: (ind: IndicatorData) => momentumLabel(ind.momentum).color,
    },
    {
      label: "RSI",
      value: (ind: IndicatorData) => (ind.rsi ?? 50).toFixed(1),
      color: (ind: IndicatorData) => rsiColor(ind.rsi ?? 50),
    },
    {
      label: "MACD 柱",
      value: (ind: IndicatorData) => {
        const hist = (ind.macd as { histogram?: number })?.histogram ?? 0;
        return `${hist > 0 ? "+" : ""}${hist.toFixed(4)}`;
      },
      color: (ind: IndicatorData) => macdColor((ind.macd as { histogram?: number })?.histogram ?? 0),
    },
    {
      label: "ADX",
      value: (ind: IndicatorData) => {
        const adxObj = ind.adx as unknown as { adx?: number };
        const adxVal = typeof adxObj?.adx === "number" ? adxObj.adx : (typeof ind.adx === "number" ? ind.adx : null);
        return adxVal == null ? "—" : adxVal.toFixed(1);
      },
      color: (ind: IndicatorData) => {
        const adxObj = ind.adx as unknown as { adx?: number };
        const adxVal = typeof adxObj?.adx === "number" ? adxObj.adx : (typeof ind.adx === "number" ? ind.adx : 20);
        return adxStrength(adxVal).color;
      },
    },
    {
      label: "+DI / -DI",
      value: (ind: IndicatorData) => {
        const adxObj = ind.adx as unknown as { plus_di?: number; minus_di?: number };
        return typeof adxObj?.plus_di === "number" && typeof adxObj?.minus_di === "number"
          ? `${adxObj.plus_di.toFixed(1)} / ${adxObj.minus_di.toFixed(1)}`
          : "—";
      },
      color: () => "#aaa",
    },
    {
      label: "EMA20",
      value: (ind: IndicatorData) => formatPrice(ind.ema?.ema20),
      color: () => "#3b82f6",
    },
    {
      label: "EMA50",
      value: (ind: IndicatorData) => formatPrice(ind.ema?.ema50),
      color: () => "#a855f7",
    },
    {
      label: "EMA200",
      value: (ind: IndicatorData) => formatPrice(ind.ema?.ema200),
      color: () => "#ef4444",
    },
    {
      label: "VWAP",
      value: (ind: IndicatorData) => formatPrice(ind.vwap),
      color: () => "#ffd740",
    },
    {
      label: "CVD",
      value: (ind: IndicatorData) => formatSignedCompact(ind.cvd?.change),
      color: (ind: IndicatorData) => cvdTone(ind.cvd).color,
    },
    {
      label: "布林 %B",
      value: (ind: IndicatorData) => ((ind.bollinger as { percent_b?: number })?.percent_b ?? 0.5).toFixed(3),
      color: (ind: IndicatorData) => bbPositionLabel((ind.bollinger as { percent_b?: number })?.percent_b ?? 0.5).color,
    },
    {
      label: "ATR",
      value: (ind: IndicatorData) => (ind.atr ?? 0).toFixed(2),
      color: () => "#aaa",
    },
  ];

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "#1e1e1e", background: "#0d0d0d" }}>
        <div>
          <div className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">四時區並排比較</div>
          <div className="text-[10px] text-[#555] mt-0.5">同一列橫向比較 4H / 1H / 15m / 5M，手機可左右滑動。</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="border-b" style={rowBorder}>
              <th className={labelClass} style={{ background: "#0d0d0d" }}>指標</th>
              {frames.map(({ tf }) => (
                <th key={tf} className={cellClass} style={{ borderColor: "#1e1e1e", color: "#ccc", background: "#0d0d0d" }}>{tf}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b last:border-b-0" style={rowBorder}>
                <td className={labelClass} style={{ background: "#111" }}>{row.label}</td>
                {frames.map(({ tf, ind }) => (
                  <td key={`${row.label}-${tf}`} className={cellClass} style={{ borderColor: "#1e1e1e", color: row.color(ind) }}>
                    {row.value(ind)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function IndicatorsPanel({ snap, isAnalyzing }: Props) {
  if (isAnalyzing && !snap) {
    return (
      <div className="flex items-center justify-center py-16 text-[#555] text-sm">
        正在計算技術指標...
      </div>
    );
  }
  if (!snap?.indicators) return null;

  const ind = snap.indicators;
  const primaryPa = snap.pa?.timeframes?.["1h"] ?? snap.pa?.timeframes?.["15m"] ?? snap.pa?.timeframes?.["5m"];
  const tpo = buildTpoProfile(snap.klines?.["1h"] ?? snap.klines?.["15m"] ?? snap.klines?.["5m"]);
  const cvd = ind.cvd ?? snap.mtf_indicators?.["15m"]?.cvd ?? snap.mtf_indicators?.["5m"]?.cvd;
  const cvdInfo = cvdTone(cvd);
  const oi = snap.onchain?.open_interest?.open_interest;
  const funding = snap.onchain?.funding_rate?.rate;
  const longShort = snap.onchain?.long_short_ratio?.ls_ratio;
  const currentPrice = snap.live_price ?? ind.close;
  const vwapDistance = ind.vwap > 0 && currentPrice > 0 ? (currentPrice - ind.vwap) / ind.vwap : null;
  const support = primaryPa?.support ?? snap.smc?.recent_swing_low;
  const resistance = primaryPa?.resistance ?? snap.smc?.recent_swing_high;
  const trendlineBias = resistance && support
    ? currentPrice >= resistance ? { label: "接近/突破下降壓力線", color: "#ffd740" }
      : currentPrice <= support ? { label: "接近/回測上升支撐線", color: "#ffd740" }
      : trendLabel(ind.trend)
    : trendLabel(ind.trend);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SectionCard title="趨勢判斷">
          <MetricRow
            label="整體趨勢"
            value={trendLabel(ind.trend).label}
            color={trendLabel(ind.trend).color}
          />
          <MetricRow
            label="動量"
            value={momentumLabel(ind.momentum).label}
            color={momentumLabel(ind.momentum).color}
          />
          <MetricRow
            label="RSI"
            value={(ind.rsi ?? 50).toFixed(1)}
            color={rsiColor(ind.rsi ?? 50)}
            sub={(ind.rsi ?? 50) >= 70 ? "超買" : (ind.rsi ?? 50) <= 30 ? "超賣" : "正常"}
          />
        </SectionCard>

        <SectionCard title="MACD">
          <MetricRow
            label="MACD"
            value={((ind.macd as { macd?: number })?.macd ?? 0).toFixed(4)}
            color={((ind.macd as { macd?: number })?.macd ?? 0) > 0 ? "#4caf50" : "#ef5350"}
          />
          <MetricRow
            label="訊號線"
            value={((ind.macd as { signal?: number })?.signal ?? 0).toFixed(4)}
            color="#888"
          />
          <MetricRow
            label="柱狀圖"
            value={`${((ind.macd as { histogram?: number })?.histogram ?? 0) > 0 ? "+" : ""}${((ind.macd as { histogram?: number })?.histogram ?? 0).toFixed(4)}`}
            color={macdColor((ind.macd as { histogram?: number })?.histogram ?? 0)}
          />
        </SectionCard>

        <SectionCard title="布林帶">
          <MetricRow
            label="上軌"
            value={((ind.bollinger as { upper?: number })?.upper ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
            color="#ef5350"
          />
          <MetricRow
            label="中軌"
            value={((ind.bollinger as { middle?: number })?.middle ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
            color="#888"
          />
          <MetricRow
            label="下軌"
            value={((ind.bollinger as { lower?: number })?.lower ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
            color="#4caf50"
          />
          <MetricRow
            label="%B"
            value={((ind.bollinger as { percent_b?: number })?.percent_b ?? 0.5).toFixed(3)}
            color={bbPositionLabel((ind.bollinger as { percent_b?: number })?.percent_b ?? 0.5).color}
            sub={bbPositionLabel((ind.bollinger as { percent_b?: number })?.percent_b ?? 0.5).label}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SectionCard title="Order Flow / OI">
          <MetricRow label="CVD 變化" value={formatSignedCompact(cvd?.change)} color={cvdInfo.color} sub={cvdInfo.label} />
          <MetricRow label="CVD 累積" value={formatSignedCompact(cvd?.current)} color={cvdInfo.color} />
          <MetricRow label="Open Interest" value={formatCompact(oi, 2)} color="#38bdf8" sub="Binance Futures OI" />
          <MetricRow label="Funding" value={formatPercent(funding, 4)} color={(funding ?? 0) >= 0 ? "#4caf50" : "#ef5350"} />
          <MetricRow label="Long / Short" value={typeof longShort === "number" ? longShort.toFixed(2) : "—"} color={(longShort ?? 1) >= 1 ? "#4caf50" : "#ef5350"} />
        </SectionCard>

        <SectionCard title="VWAP / TPO">
          <MetricRow label="VWAP" value={formatPrice(ind.vwap)} color="#ffd740" sub={vwapDistance == null ? undefined : `現價 ${formatPercent(vwapDistance, 2)}`} />
          <MetricRow label="TPO POC" value={formatPrice(tpo?.poc)} color="#a855f7" sub="時間價格機會 POC" />
          <MetricRow label="TPO VAH" value={formatPrice(tpo?.vah)} color="#ef5350" />
          <MetricRow label="TPO VAL" value={formatPrice(tpo?.val)} color="#4caf50" />
          <MetricRow label="目前位置" value={tpo?.zone ?? "—"} color={tpo?.zone === "價值區上方" ? "#ef5350" : tpo?.zone === "價值區下方" ? "#4caf50" : "#ffd740"} />
        </SectionCard>

        <SectionCard title="趨勢線 / 關鍵水位">
          <MetricRow label="趨勢線偏向" value={trendlineBias.label} color={trendlineBias.color} />
          <MetricRow label="支撐線 / SSL" value={formatPrice(support)} color="#4caf50" sub={primaryPa?.price_vs_vwap ? `VWAP: ${primaryPa.price_vs_vwap}` : undefined} />
          <MetricRow label="壓力線 / BSL" value={formatPrice(resistance)} color="#ef5350" />
          <MetricRow label="近期 Swing High" value={formatPrice(snap.smc?.recent_swing_high)} color="#ef5350" />
          <MetricRow label="近期 Swing Low" value={formatPrice(snap.smc?.recent_swing_low)} color="#4caf50" />
        </SectionCard>
      </div>

      {/* ── 新增指標區塊 ── */}
      <div className="text-[11px] text-[#555] font-semibold uppercase tracking-wider">進階指標</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Supertrend */}
        <SectionCard title="Supertrend (10, 3)">
          {(() => {
            const st = (ind as Record<string, unknown>).supertrend as { value?: number; signal?: string; direction?: number } | undefined;
            const stVal = st?.value ?? 0;
            const stSignal = st?.signal ?? "bullish";
            const stColor = stSignal === "bullish" ? "#4caf50" : "#ef5350";
            return (
              <>
                <MetricRow label="方向" value={stSignal === "bullish" ? "▲ 多頭" : "▼ 空頭"} color={stColor} />
                <MetricRow label="支撐/壓力線" value={formatPrice(stVal)} color={stColor} sub={stSignal === "bullish" ? "動態支撐" : "動態壓力"} />
                <MetricRow label="現價距離" value={currentPrice > 0 && stVal > 0 ? `${((currentPrice - stVal) / stVal * 100).toFixed(2)}%` : "—"} color={stColor} />
              </>
            );
          })()}
        </SectionCard>

        {/* Ichimoku */}
        <SectionCard title="一目均衡表 (9/26/52)">
          {(() => {
            const ichi = (ind as Record<string, unknown>).ichimoku as { tenkan?: number; kijun?: number; senkou_a?: number; senkou_b?: number; cloud_color?: string; price_vs_cloud?: string } | undefined;
            const cloudColor = ichi?.cloud_color === "green" ? "#4caf50" : "#ef5350";
            const posLabel = ichi?.price_vs_cloud === "above" ? "雲上（多頭）" : ichi?.price_vs_cloud === "below" ? "雲下（空頭）" : "雲中（震盪）";
            const posColor = ichi?.price_vs_cloud === "above" ? "#4caf50" : ichi?.price_vs_cloud === "below" ? "#ef5350" : "#ffd740";
            return (
              <>
                <MetricRow label="現價位置" value={posLabel} color={posColor} />
                <MetricRow label="轉換線" value={formatPrice(ichi?.tenkan)} color="#f59e0b" />
                <MetricRow label="基準線" value={formatPrice(ichi?.kijun)} color="#3b82f6" />
                <MetricRow label="先行帶 A" value={formatPrice(ichi?.senkou_a)} color="#4caf50" />
                <MetricRow label="先行帶 B" value={formatPrice(ichi?.senkou_b)} color="#ef5350" />
                <MetricRow label="雲顏色" value={ichi?.cloud_color === "green" ? "多頭雲（綠）" : "空頭雲（紅）"} color={cloudColor} />
              </>
            );
          })()}
        </SectionCard>

        {/* Pivot Points */}
        <SectionCard title="樞軸點 (Pivot Points)">
          {(() => {
            const pv = (ind as Record<string, unknown>).pivots as { pp?: number; r1?: number; r2?: number; r3?: number; s1?: number; s2?: number; s3?: number } | undefined;
            return (
              <>
                <MetricRow label="PP（樞軸）" value={formatPrice(pv?.pp)} color="#ffd740" />
                <MetricRow label="R1" value={formatPrice(pv?.r1)} color="#ef5350" />
                <MetricRow label="R2" value={formatPrice(pv?.r2)} color="#f87171" />
                <MetricRow label="R3" value={formatPrice(pv?.r3)} color="#fca5a5" />
                <MetricRow label="S1" value={formatPrice(pv?.s1)} color="#4caf50" />
                <MetricRow label="S2" value={formatPrice(pv?.s2)} color="#86efac" />
                <MetricRow label="S3" value={formatPrice(pv?.s3)} color="#bbf7d0" />
              </>
            );
          })()}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* DEMA / TEMA / HMA */}
        <SectionCard title="DEMA / TEMA / HMA">
          {(() => {
            const dema = (ind as Record<string, unknown>).dema as { dema20?: number; dema50?: number } | undefined;
            const tema = (ind as Record<string, unknown>).tema as { tema20?: number } | undefined;
            const hma  = (ind as Record<string, unknown>).hma  as { hma20?: number } | undefined;
            const d20 = dema?.dema20 ?? 0;
            const d50 = dema?.dema50 ?? 0;
            const t20 = tema?.tema20 ?? 0;
            const h20 = hma?.hma20 ?? 0;
            return (
              <>
                <MetricRow label="DEMA 20" value={formatPrice(d20)} color={currentPrice > d20 ? "#4caf50" : "#ef5350"} sub={currentPrice > d20 ? "現價在上" : "現價在下"} />
                <MetricRow label="DEMA 50" value={formatPrice(d50)} color={currentPrice > d50 ? "#4caf50" : "#ef5350"} />
                <MetricRow label="TEMA 20" value={formatPrice(t20)} color={currentPrice > t20 ? "#4caf50" : "#ef5350"} sub="反應更靈敏" />
                <MetricRow label="HMA 20" value={formatPrice(h20)} color={currentPrice > h20 ? "#4caf50" : "#ef5350"} sub="Hull MA（低延遲）" />
              </>
            );
          })()}
        </SectionCard>

        {/* Donchian Channel */}
        <SectionCard title="唐奇安通道 (20)">
          {(() => {
            const dc = (ind as Record<string, unknown>).donchian as { upper?: number; lower?: number; mid?: number } | undefined;
            const dcUpper = dc?.upper ?? 0;
            const dcLower = dc?.lower ?? 0;
            const dcMid   = dc?.mid   ?? 0;
            const dcRange = dcUpper - dcLower;
            const pctInRange = dcRange > 0 ? ((currentPrice - dcLower) / dcRange * 100).toFixed(1) : "—";
            return (
              <>
                <MetricRow label="上軌（20 期高）" value={formatPrice(dcUpper)} color="#ef5350" />
                <MetricRow label="中軌" value={formatPrice(dcMid)} color="#ffd740" />
                <MetricRow label="下軌（20 期低）" value={formatPrice(dcLower)} color="#4caf50" />
                <MetricRow label="通道寬度" value={formatPrice(dcRange)} color="#888" />
                <MetricRow label="現價位置" value={`${pctInRange}%`} color={Number(pctInRange) > 80 ? "#ef5350" : Number(pctInRange) < 20 ? "#4caf50" : "#ffd740"} sub="0%=下軌 100%=上軌" />
              </>
            );
          })()}
        </SectionCard>

        {/* CMF + RSI Divergence */}
        <SectionCard title="CMF / RSI 背離">
          {(() => {
            const cmfVal = typeof (ind as Record<string, unknown>).cmf === "number" ? (ind as Record<string, unknown>).cmf as number : 0;
            const div = (ind as Record<string, unknown>).rsi_divergence as { type?: string | null; description?: string; strength?: string | null } | undefined;
            const cmfColor = cmfVal > 0.05 ? "#4caf50" : cmfVal < -0.05 ? "#ef5350" : "#ffd740";
            const cmfLabel = cmfVal > 0.1 ? "強烈買盤" : cmfVal > 0.05 ? "買盤偏強" : cmfVal < -0.1 ? "強烈賣盤" : cmfVal < -0.05 ? "賣盤偏強" : "多空均衡";
            const divColor = div?.type === "bullish" ? "#4caf50" : div?.type === "bearish" ? "#ef5350" : "#888";
            const divLabel = div?.type === "bullish" ? "底背離（看多）" : div?.type === "bearish" ? "頂背離（看空）" : "無背離";
            const strengthLabel = div?.strength === "strong" ? "強" : div?.strength === "moderate" ? "中" : div?.strength === "weak" ? "弱" : "";
            return (
              <>
                <MetricRow label="CMF (20)" value={cmfVal.toFixed(4)} color={cmfColor} sub={cmfLabel} />
                <MetricRow label="CMF 趨勢" value={cmfVal > 0 ? "資金流入" : cmfVal < 0 ? "資金流出" : "中性"} color={cmfColor} />
                <MetricRow label="RSI 背離" value={divLabel} color={divColor} sub={div?.description} />
                {div?.type && <MetricRow label="背離強度" value={strengthLabel} color={divColor} />}
              </>
            );
          })()}
        </SectionCard>
      </div>

      {/* Multi-TF comparison - 各時間框架使用各自的指標數值 */}
      <IndicatorComparisonMatrix
        frames={[
          { tf: "4H", ind: snap.mtf_indicators?.["4h"] ?? ind },
          { tf: "1H", ind: snap.mtf_indicators?.["1h"] ?? ind },
          { tf: "15m", ind: snap.mtf_indicators?.["15m"] ?? ind },
          { tf: "5M", ind: snap.mtf_indicators?.["5m"] ?? ind },
        ]}
      />

      <div className="text-[11px] text-[#555] font-semibold uppercase tracking-wider">各時區詳細卡片</div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
        <TfColumn tf="4H" ind={snap.mtf_indicators?.["4h"] ?? ind} />
        <TfColumn tf="1H" ind={snap.mtf_indicators?.["1h"] ?? ind} />
        <TfColumn tf="15m" ind={snap.mtf_indicators?.["15m"] ?? ind} />
        <TfColumn tf="5M" ind={snap.mtf_indicators?.["5m"] ?? ind} />
      </div>
    </div>
  );
}
