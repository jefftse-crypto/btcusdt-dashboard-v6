# V5 系統勝率與收益提升優化方案

## 一、 現狀瓶頸分析 (Bottleneck Analysis)

基於 V5 報告與代碼邏輯，目前的瓶頸主要在於：

1.  **樣本外過擬合 (OOS Overfitting)**：
    *   V5 在 2025 年表現極佳（勝率 81%），但在 2026 年樣本外下降至 50%。
    *   **原因**：元過濾規則過於細碎（如特定時段、特定關鍵字），導致模型捕捉的是「過去特定市場環境下的噪音」而非「普適性邏輯」。

2.  **評分權重線性且靜態**：
    *   `nurseNeilSignalScorer.ts` 使用固定加分制（結構 25、RR 25 等）。
    *   **問題**：在不同波動率環境下，結構的重要性可能遠大於流動性，靜態權重無法適應市場切換。

3.  **缺乏動態出場機制**：
    *   目前依賴固定 TP/SL。在勝率 50% 的情況下，若盈虧比不足，帳戶將陷入橫盤或陰跌。

---

## 二、 勝率提升方案 (Win Rate Optimization)

### 1. 引入「市場環境過濾器」(Regime Filter)
*   **建議**：不要只在交易層面過濾，要在市場層面過濾。
*   **實施**：增加一個 `MarketRegime` 指標。若 4H 級別處於高波動震盪（ATR 飆升但無趨向），則提高 `min_score` 門檻（從 7.5 提升至 8.5）。

### 2. 結構評分優化 (Structure Scoring)
*   **代碼優化建議**：
    ```typescript
    // 修改 nurseNeilSignalScorer.ts
    if (input.marketStructureShift && input.trendlineBreak) {
        score += 15; // 組合信號權重應大於單一信號相加，體現共振
    }
    ```

---

## 三、 收益提升方案 (Profit Maximization)

### 1. 動態倉位管理 (Dynamic Sizing)
*   **邏輯**：目前根據 `totalScore` 分級（1.0%, 0.75% 等）。
*   **優化**：引入「連損保護」。若最近 3 筆交易均為虧損，則強制將下一筆倉位減半，直到出現一筆盈利交易，以此保護回撤期間的本金。

### 2. 分批止盈與保本損 (Partial TP & Break-even SL)
*   **優化**：當價格達到 TP1（通常為 1:1 RR）時，自動將剩餘倉位的 SL 移動至 Entry。
*   **目標**：將 50% 的勝率轉化為「高勝率 + 零風險博取高收益」的結構。

---

## 四、 具體實施建議 (Actionable Steps)

1.  **參數降維**：在 `build_v5_real_data_meta_model.py` 中，剔除「關鍵字過濾」，改為強化「R:R 門檻」與「波動率門檻」。
2.  **增加 BTC 共振校驗**：在 `NurseNeilSignalInput` 中強化 `btc4hRisk` 的權重。若 BTC 處於 `bearish_breakdown`，山寨多單應直接 `reject` 而非僅減倉。
3.  **回測 V5.1**：使用 V5 的真實數據基礎，跑一套「保本損」邏輯的回測，觀察在 2026 年樣本外的表現提升。
