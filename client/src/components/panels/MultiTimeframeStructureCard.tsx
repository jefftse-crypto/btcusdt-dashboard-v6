/**
 * MultiTimeframeStructureCard.tsx
 * 多週期結構分析卡片 — 每個時區（4H / 1H / 15M / 5M）獨立一張卡片
 *
 * 整合：K 線結構（HH/HL/LH/LL、BOS/CHoCH）、關鍵支撐阻力、流動性位、
 *       成交量/CVD 分析、OI/Funding Rate、交易劇本（如果A則B）
 */
import type { CryptoSnapshot, IndicatorData } from "@shared/cryptoTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fp(v: number | null | undefined, d = 2) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: d });
}
function pct(v: number | null | undefined, d = 3) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;
}
function signed(v: number | null | undefined, d = 2) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const s = abs >= 1e9 ? `${(abs / 1e9).toFixed(1)}B` : abs >= 1e6 ? `${(abs / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(abs / 1e3).toFixed(1)}K` : abs.toFixed(d);
  return `${v >= 0 ? "+" : "-"}${s}`;
}

function Row({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between py-1 border-b" style={{ borderColor: "#1a2035" }}>
      <span className="text-[11px] text-[#8896b0] leading-tight">{label}</span>
      <div className="text-right ml-2">
        <span className="text-[11px] font-mono font-semibold leading-tight" style={{ color: color ?? "#b0bcd4" }}>{value}</span>
        {sub && <div className="text-[10px] leading-tight" style={{ color: color ?? "#6b7a99" }}>{sub}</div>}
      </div>
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color, background: bg ?? `${color}22` }}>{label}</span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#4a5568] mb-1 mt-2">{title}</div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure analysis helpers
// ─────────────────────────────────────────────────────────────────────────────

/** 從 BOS/CHoCH 事件陣列推斷 HH/HL/LH/LL 結構 */
function inferStructureLabel(
  structure: "bullish" | "bearish" | "ranging" | string | undefined,
  bosChoch: Array<{ type: string; direction: string; confirmed: boolean }> | undefined,
): { label: string; color: string; detail: string } {
  const recent = (bosChoch ?? []).filter(e => e.confirmed).slice(-3);
  const bullCount = recent.filter(e => e.direction === "bullish").length;
  const bearCount = recent.filter(e => e.direction === "bearish").length;

  if (structure === "bullish") {
    if (bullCount >= 2) return { label: "多頭延續", color: "#4caf50", detail: "HH + HL 結構，BOS 確認" };
    return { label: "偏多", color: "#81c784", detail: "多頭結構，等待 HL 確認" };
  }
  if (structure === "bearish") {
    if (bearCount >= 2) return { label: "空頭延續", color: "#ef5350", detail: "LH + LL 結構，BOS 確認" };
    return { label: "偏空", color: "#ef9a9a", detail: "空頭結構，等待 LH 確認" };
  }
  return { label: "震盪", color: "#ffd740", detail: "無明確方向，區間整理" };
}

/** 判斷最近 BOS/CHoCH 事件的意義 */
function latestBosChochLabel(
  events: Array<{ type: string; direction: string; price: number; confirmed: boolean }> | undefined,
): { label: string; color: string; price: string } | null {
  if (!events || events.length === 0) return null;
  const last = [...events].reverse().find(e => e.confirmed);
  if (!last) return null;
  const isBos = last.type === "BOS";
  const isBull = last.direction === "bullish";
  return {
    label: isBos
      ? (isBull ? "BOS ↑ 多頭延續" : "BOS ↓ 空頭延續")
      : (isBull ? "CHoCH ↑ 趨勢轉多" : "CHoCH ↓ 趨勢轉空"),
    color: isBull ? "#4caf50" : "#ef5350",
    price: fp(last.price),
  };
}

/** CVD 背離判斷 */
function cvdDivergenceLabel(
  ind: IndicatorData,
): { label: string; color: string } {
  const cvd = ind.cvd;
  if (!cvd) return { label: "無資料", color: "#555" };
  const close = ind.close;
  const vwap = ind.vwap;
  if (cvd.trend === "rising" && close < vwap) return { label: "CVD 買盤↑ 但價格在 VWAP 下 — 謹慎", color: "#ffd740" };
  if (cvd.trend === "falling" && close > vwap) return { label: "CVD 賣盤↓ 但價格在 VWAP 上 — 謹慎", color: "#ffd740" };
  if (cvd.trend === "rising") return { label: "CVD 買盤推升，與價格同步", color: "#4caf50" };
  if (cvd.trend === "falling") return { label: "CVD 賣盤主導，與價格同步", color: "#ef5350" };
  return { label: "CVD 多空均衡", color: "#888" };
}

/** 自動生成交易劇本 */
function buildScenarios(
  tf: string,
  ind: IndicatorData,
  smc: CryptoSnapshot["smc"] | undefined,
  onchain: CryptoSnapshot["onchain"] | undefined,
): Array<{ name: string; color: string; conditions: string[]; conclusion: string; target?: string; sl?: string }> {
  const close = ind.close;
  const structure = smc?.structure ?? "ranging";
  const recentHigh = smc?.recent_swing_high;
  const recentLow = smc?.recent_swing_low;
  const nearBullFvg = smc?.nearest_bull_fvg;
  const nearBearFvg = smc?.nearest_bear_fvg;
  const funding = onchain?.funding_rate?.rate;
  const atr = ind.atr ?? 0;

  const scenarios: Array<{ name: string; color: string; conditions: string[]; conclusion: string; target?: string; sl?: string }> = [];

  // 劇本一：突破走強（多頭）
  if (recentHigh && close > recentHigh * 0.995) {
    scenarios.push({
      name: "劇本一：突破走強",
      color: "#4caf50",
      conditions: [
        `${tf} 收線站穩 ${fp(recentHigh)} 上方`,
        "CVD 持續買盤推升",
        "成交量放大確認",
        nearBullFvg ? `回踩 FVG ${fp(nearBullFvg.bottom)}–${fp(nearBullFvg.top)} 不跌穿` : "回踩不破支撐",
      ],
      conclusion: "短線偏多，可考慮做多",
      target: recentHigh ? fp(recentHigh * 1.01) : undefined,
      sl: recentHigh ? fp(recentHigh * 0.995) : undefined,
    });
  }

  // 劇本二：反彈失敗（空頭）
  if (recentHigh && close < recentHigh * 1.005) {
    scenarios.push({
      name: "劇本二：反彈失敗",
      color: "#ef5350",
      conditions: [
        `衝到 ${fp(recentHigh)} 附近出現長上影`,
        "CVD 轉弱或賣盤主導",
        `${tf} K/D 死叉`,
        recentLow ? `跌回 ${fp(recentLow)} 下方` : "跌破近期低點",
      ],
      conclusion: "反彈失敗，可考慮做空",
      target: recentLow ? fp(recentLow * 0.99) : undefined,
      sl: recentHigh ? fp(recentHigh * 1.005) : undefined,
    });
  }

  // 劇本三：跌穿支撐（空頭延續）
  if (recentLow && close > recentLow * 0.99 && structure === "bearish") {
    scenarios.push({
      name: "劇本三：跌穿支撐",
      color: "#f44336",
      conditions: [
        `跌穿 ${fp(recentLow)}`,
        `${tf} 收線在下方`,
        "反抽不上支撐位",
        "CVD 轉賣盤主導",
      ],
      conclusion: "空頭延續，目標下方流動性",
      target: recentLow ? fp(recentLow * 0.985) : undefined,
      sl: recentLow ? fp(recentLow * 1.003) : undefined,
    });
  }

  // 劇本四：震盪區間（中性）
  if (scenarios.length === 0 || structure === "ranging") {
    scenarios.push({
      name: "劇本四：震盪等待",
      color: "#ffd740",
      conditions: [
        "等待明確方向突破",
        recentHigh ? `上方阻力 ${fp(recentHigh)}` : "觀察近期高點",
        recentLow ? `下方支撐 ${fp(recentLow)}` : "觀察近期低點",
        "等待 BOS/CHoCH 確認",
      ],
      conclusion: "區間震盪，等待訊號",
    });
  }

  return scenarios.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Card Component
// ─────────────────────────────────────────────────────────────────────────────
interface CardProps {
  tf: string;
  tfKey: "4h" | "1h" | "15m" | "5m";
  ind: IndicatorData;
  snap: CryptoSnapshot;
  isHigherTf?: boolean; // 4H 是最高時區，用於定大方向
}

function MultiTimeframeStructureCard({ tf, tfKey, ind, snap, isHigherTf }: CardProps) {
  const smc = snap.smc;
  const onchain = snap.onchain;
  const pa = snap.pa?.timeframes?.[tfKey];
  const close = ind.close;
  const vwap = ind.vwap;

  // 結構判斷
  const structInfo = inferStructureLabel(smc?.structure, smc?.bos_choch);
  const latestEvent = latestBosChochLabel(smc?.bos_choch);
  const cvdDiv = cvdDivergenceLabel(ind);
  const scenarios = buildScenarios(tf, ind, smc, onchain);

  // 支撐阻力
  const support = pa?.support ?? smc?.recent_swing_low;
  const resistance = pa?.resistance ?? smc?.recent_swing_high;
  const nearBullFvg = smc?.nearest_bull_fvg;
  const nearBearFvg = smc?.nearest_bear_fvg;

  // 流動性
  const liquidityLevels = smc?.liquidity_levels ?? [];
  const buySideLiq = liquidityLevels.filter(l => l.type === "buy_side" && !l.swept).slice(0, 3);
  const sellSideLiq = liquidityLevels.filter(l => l.type === "sell_side" && !l.swept).slice(0, 3);

  // OI & Funding（只在 1H 卡片顯示，避免重複）
  const funding = onchain?.funding_rate?.rate;
  const lsRatio = onchain?.long_short_ratio?.ls_ratio;
  const fearGreed = onchain?.fear_greed?.value;
  const fearGreedClass = onchain?.fear_greed?.classification;

  // 方向顏色
  const dirColor = smc?.structure === "bullish" ? "#4caf50" : smc?.structure === "bearish" ? "#ef5350" : "#ffd740";

  return (
    <div
      className="rounded-xl p-3 space-y-0.5"
      style={{
        background: "#0d1117",
        border: `1px solid ${dirColor}44`,
        boxShadow: isHigherTf ? `0 0 12px ${dirColor}22` : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-white">{tf}</span>
          {isHigherTf && <Badge label="主方向" color="#ffd740" />}
          <Badge label={structInfo.label} color={structInfo.color} />
        </div>
        <span className="text-[11px] font-mono text-[#6b7a99]">{fp(close)}</span>
      </div>

      {/* ① K 線結構 */}
      <Section title="K 線結構">
        <Row label="市場結構" value={structInfo.label} color={structInfo.color} sub={structInfo.detail} />
        {latestEvent && (
          <Row label="最近事件" value={latestEvent.label} color={latestEvent.color} sub={`@ ${latestEvent.price}`} />
        )}
        <Row
          label="趨勢"
          value={ind.trend === "bullish" ? "多頭 ▲" : ind.trend === "bearish" ? "空頭 ▼" : "中性 —"}
          color={ind.trend === "bullish" ? "#4caf50" : ind.trend === "bearish" ? "#ef5350" : "#ffd740"}
        />
        <Row
          label="動量"
          value={
            ind.momentum === "strong_bullish" ? "強烈看多" :
            ind.momentum === "bullish" ? "看多" :
            ind.momentum === "strong_bearish" ? "強烈看空" :
            ind.momentum === "bearish" ? "看空" : "中性"
          }
          color={
            ind.momentum?.includes("bullish") ? "#4caf50" :
            ind.momentum?.includes("bearish") ? "#ef5350" : "#ffd740"
          }
        />
        <Row label="ADX" value={(ind.adx as { adx?: number })?.adx?.toFixed(1) ?? "—"} color={(ind.adx as { adx?: number })?.adx ?? 0 >= 25 ? "#ffd740" : "#888"} sub={(ind.adx as { adx?: number })?.adx ?? 0 >= 40 ? "極強趨勢" : (ind.adx as { adx?: number })?.adx ?? 0 >= 25 ? "強趨勢" : "弱/無趨勢"} />
      </Section>

      {/* ② 關鍵支撐阻力 */}
      <Section title="關鍵支撐阻力">
        <Row label="近期 Swing High" value={fp(resistance)} color="#ef5350"
          sub={resistance && close ? (close >= resistance ? "⚠ 接近/突破阻力" : `距 ${((resistance - close) / close * 100).toFixed(2)}%`) : undefined}
        />
        <Row label="近期 Swing Low" value={fp(support)} color="#4caf50"
          sub={support && close ? (close <= support ? "⚠ 接近/跌破支撐" : `距 ${((close - support) / close * 100).toFixed(2)}%`) : undefined}
        />
        <Row label="VWAP" value={fp(vwap)} color="#ffd740"
          sub={vwap && close ? (close > vwap ? `價格在 VWAP 上 +${((close - vwap) / vwap * 100).toFixed(2)}%` : `價格在 VWAP 下 ${((close - vwap) / vwap * 100).toFixed(2)}%`) : undefined}
        />
        <Row label="EMA 20" value={fp((ind.ema as { ema20?: number })?.ema20)} color="#3b82f6" />
        <Row label="EMA 50" value={fp((ind.ema as { ema50?: number })?.ema50)} color="#a855f7" />
        <Row label="EMA 200" value={fp((ind.ema as { ema200?: number })?.ema200)} color="#ef4444" />
        {nearBullFvg && (
          <Row label="多頭 FVG" value={`${fp(nearBullFvg.bottom)} – ${fp(nearBullFvg.top)}`} color="#4caf50" sub="看多缺口支撐" />
        )}
        {nearBearFvg && (
          <Row label="空頭 FVG" value={`${fp(nearBearFvg.bottom)} – ${fp(nearBearFvg.top)}`} color="#ef5350" sub="看空缺口阻力" />
        )}
        {(ind.pivots as { pp?: number })?.pp && (
          <>
            <Row label="Pivot PP" value={fp((ind.pivots as { pp?: number })?.pp)} color="#888" />
            <Row label="R1 / R2" value={`${fp((ind.pivots as { r1?: number })?.r1)} / ${fp((ind.pivots as { r2?: number })?.r2)}`} color="#ef9a9a" />
            <Row label="S1 / S2" value={`${fp((ind.pivots as { s1?: number })?.s1)} / ${fp((ind.pivots as { s2?: number })?.s2)}`} color="#81c784" />
          </>
        )}
      </Section>

      {/* ③ 流動性位置 */}
      <Section title="流動性位置（未掃）">
        {buySideLiq.length > 0 ? (
          buySideLiq.map((l, i) => (
            <Row key={i} label={`買方流動性 ${i + 1}`} value={fp(l.price)} color="#ef5350" sub="上方止損聚集（空單止損）" />
          ))
        ) : (
          <Row label="買方流動性" value="無明顯位置" color="#555" />
        )}
        {sellSideLiq.length > 0 ? (
          sellSideLiq.map((l, i) => (
            <Row key={i} label={`賣方流動性 ${i + 1}`} value={fp(l.price)} color="#4caf50" sub="下方止損聚集（多單止損）" />
          ))
        ) : (
          <Row label="賣方流動性" value="無明顯位置" color="#555" />
        )}
        {smc?.liquidity?.nearest_buy && (
          <Row label="最近 BSL" value={fp(smc.liquidity.nearest_buy)} color="#ef5350" sub="Buyside Liquidity" />
        )}
        {smc?.liquidity?.nearest_sell && (
          <Row label="最近 SSL" value={fp(smc.liquidity.nearest_sell)} color="#4caf50" sub="Sellside Liquidity" />
        )}
      </Section>

      {/* ④ 成交量 / CVD */}
      <Section title="成交量 / CVD">
        <Row label="CVD 變化" value={signed(ind.cvd?.change)} color={ind.cvd?.trend === "rising" ? "#4caf50" : ind.cvd?.trend === "falling" ? "#ef5350" : "#ffd740"} />
        <Row label="CVD 趨勢" value={ind.cvd?.trend === "rising" ? "買盤推升 ▲" : ind.cvd?.trend === "falling" ? "賣盤主導 ▼" : "多空均衡"} color={ind.cvd?.trend === "rising" ? "#4caf50" : ind.cvd?.trend === "falling" ? "#ef5350" : "#ffd740"} />
        <Row label="CVD 背離" value={cvdDiv.label} color={cvdDiv.color} />
        <Row label="CMF" value={typeof ind.cmf === "number" ? ind.cmf.toFixed(4) : "—"} color={typeof ind.cmf === "number" && ind.cmf > 0.05 ? "#4caf50" : typeof ind.cmf === "number" && ind.cmf < -0.05 ? "#ef5350" : "#ffd740"} sub={typeof ind.cmf === "number" ? (ind.cmf > 0.1 ? "強烈買盤" : ind.cmf > 0.05 ? "買盤偏強" : ind.cmf < -0.1 ? "強烈賣盤" : ind.cmf < -0.05 ? "賣盤偏強" : "多空均衡") : undefined} />
        <Row label="RSI 背離" value={ind.rsi_divergence?.type === "bullish" ? "底背離 ↑" : ind.rsi_divergence?.type === "bearish" ? "頂背離 ↓" : "無背離"} color={ind.rsi_divergence?.type === "bullish" ? "#4caf50" : ind.rsi_divergence?.type === "bearish" ? "#ef5350" : "#888"} sub={ind.rsi_divergence?.description} />
      </Section>

      {/* ⑤ 訂單流（只在 1H 顯示，因為 onchain 資料是全域的） */}
      {tfKey === "1h" && (
        <Section title="訂單流 / 衍生品">
          <Row
            label="資金費率"
            value={typeof funding === "number" ? pct(funding, 4) : "—"}
            color={typeof funding === "number" ? (funding > 0.001 ? "#ef5350" : funding < -0.001 ? "#4caf50" : "#ffd740") : "#555"}
            sub={typeof funding === "number" ? (funding > 0.001 ? "多頭付費（偏空）" : funding < -0.001 ? "空頭付費（偏多）" : "資金費率中性") : undefined}
          />
          <Row
            label="多空比"
            value={typeof lsRatio === "number" ? lsRatio.toFixed(3) : "—"}
            color={typeof lsRatio === "number" ? (lsRatio > 1.1 ? "#ef5350" : lsRatio < 0.9 ? "#4caf50" : "#ffd740") : "#555"}
            sub={typeof lsRatio === "number" ? (lsRatio > 1.2 ? "多頭過多（謹慎）" : lsRatio < 0.8 ? "空頭過多（偏多）" : "多空均衡") : undefined}
          />
          <Row
            label="恐懼貪婪"
            value={typeof fearGreed === "number" ? `${fearGreed} — ${fearGreedClass ?? ""}` : "—"}
            color={typeof fearGreed === "number" ? (fearGreed >= 75 ? "#ef5350" : fearGreed <= 25 ? "#4caf50" : "#ffd740") : "#555"}
          />
        </Section>
      )}

      {/* ⑥ 技術指標快覽 */}
      <Section title="技術指標">
        <Row label="RSI (14)" value={(ind.rsi ?? 50).toFixed(1)} color={ind.rsi >= 70 ? "#ef5350" : ind.rsi <= 30 ? "#4caf50" : "#aaa"} sub={ind.rsi >= 70 ? "超買" : ind.rsi <= 30 ? "超賣" : "正常"} />
        <Row label="布林帶位置" value={`${((ind.bollinger as { percent_b?: number })?.percent_b ?? 0.5 * 100).toFixed(1)}%`} color={(ind.bollinger as { percent_b?: number })?.percent_b ?? 0.5 > 0.8 ? "#ef5350" : (ind.bollinger as { percent_b?: number })?.percent_b ?? 0.5 < 0.2 ? "#4caf50" : "#aaa"} />
        <Row label="Supertrend" value={(ind.supertrend as { signal?: string })?.signal === "bullish" ? "多頭 ▲" : "空頭 ▼"} color={(ind.supertrend as { signal?: string })?.signal === "bullish" ? "#4caf50" : "#ef5350"} />
        <Row label="一目均衡表" value={(ind.ichimoku as { price_vs_cloud?: string })?.price_vs_cloud === "above" ? "雲上 ▲" : (ind.ichimoku as { price_vs_cloud?: string })?.price_vs_cloud === "below" ? "雲下 ▼" : "雲中"} color={(ind.ichimoku as { price_vs_cloud?: string })?.price_vs_cloud === "above" ? "#4caf50" : (ind.ichimoku as { price_vs_cloud?: string })?.price_vs_cloud === "below" ? "#ef5350" : "#ffd740"} />
      </Section>

      {/* ⑦ 交易劇本 */}
      <Section title="交易劇本（如果A則B）">
        {scenarios.map((s, i) => (
          <div key={i} className="mb-2 rounded-lg p-2" style={{ background: `${s.color}11`, border: `1px solid ${s.color}33` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.name}</span>
            </div>
            <div className="space-y-0.5 mb-1">
              {s.conditions.map((c, j) => (
                <div key={j} className="text-[10px] text-[#8896b0]">• {c}</div>
              ))}
            </div>
            <div className="text-[10px] font-semibold" style={{ color: s.color }}>→ {s.conclusion}</div>
            {(s.target || s.sl) && (
              <div className="flex gap-3 mt-1">
                {s.target && <span className="text-[9px] text-[#4caf50]">目標 {s.target}</span>}
                {s.sl && <span className="text-[9px] text-[#ef5350]">止損 {s.sl}</span>}
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* ⑧ 入場前檢查清單 */}
      <Section title="入場前檢查">
        {[
          { label: "大週期方向明確", pass: smc?.structure !== "ranging" },
          { label: "現價在支撐/阻力附近", pass: support && resistance ? (Math.abs(close - support) / close < 0.005 || Math.abs(close - resistance) / close < 0.005) : false },
          { label: "BOS/CHoCH 已確認", pass: (smc?.bos_choch ?? []).some(e => e.confirmed) },
          { label: "CVD 與方向同步", pass: (smc?.structure === "bullish" && ind.cvd?.trend === "rising") || (smc?.structure === "bearish" && ind.cvd?.trend === "falling") },
          { label: "RSI 非超買/超賣極端", pass: ind.rsi > 30 && ind.rsi < 70 },
          { label: "ADX 趨勢強度足夠", pass: ((ind.adx as { adx?: number })?.adx ?? 0) >= 20 },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between py-0.5">
            <span className="text-[10px] text-[#8896b0]">{item.label}</span>
            <span className="text-[11px]" style={{ color: item.pass ? "#4caf50" : "#ef5350" }}>
              {item.pass ? "✓" : "✗"}
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel: 四個時區卡片並排
// ─────────────────────────────────────────────────────────────────────────────
interface PanelProps {
  snap: CryptoSnapshot | null | undefined;
}

export function MultiTimeframeStructurePanel({ snap }: PanelProps) {
  if (!snap?.mtf_indicators) return null;

  const mtf = snap.mtf_indicators;
  const ind = snap.indicators;

  const frames: Array<{ tf: string; tfKey: "4h" | "1h" | "15m" | "5m"; ind: IndicatorData; isHigherTf?: boolean }> = [
    { tf: "4H", tfKey: "4h", ind: mtf["4h"] ?? ind, isHigherTf: true },
    { tf: "1H", tfKey: "1h", ind: mtf["1h"] ?? ind },
    { tf: "15M", tfKey: "15m", ind: mtf["15m"] ?? ind },
    { tf: "5M", tfKey: "5m", ind: mtf["5m"] ?? ind },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#4a5568]">多週期結構分析</span>
        <span className="text-[10px] text-[#4a5568]">— 大週期定方向 · 小週期找入場</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
        {frames.map(f => (
          <MultiTimeframeStructureCard
            key={f.tf}
            tf={f.tf}
            tfKey={f.tfKey}
            ind={f.ind}
            snap={snap}
            isHigherTf={f.isHigherTf}
          />
        ))}
      </div>
    </div>
  );
}
