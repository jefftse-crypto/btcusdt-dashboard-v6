# BTCUSDT Dashboard v6.4.2 Entry Trainer AI 訓練改良方案

本輪評估結論是：不建議讓大型語言模型直接決定交易分數或放行結果，因為延遲、成本、可重現性與風控責任都會變差。較適合的做法是把「AI」放在訓練層與解釋層：用資料驅動方式計算特徵重要性、模型校準、regime 分類與訓練品質診斷，並保留原本可重現的 TypeScript 評分引擎作為交易決策核心。

## 優先實作項目

| 項目 | 實作方式 | 對交易決策的價值 |
|---|---|---|
| 特徵重要性 | 以歷史樣本的 outcome target 與 R multiple 計算每個特徵的相關性，轉成 KNN 加權距離 | 避免 21 個特徵等權，讓真正能分辨勝敗的特徵影響近鄰搜尋 |
| Timeout 標籤修正 | timeout 不再固定以 0.45 計入 win，而是依 timeout 的實際 R 倍數轉成 0.15–0.85 的連續 outcome credit | 降低高估勝率問題，讓未達 TP/SL 但已明顯有利或不利的樣本更合理 |
| 市場 regime | 依 ATR 百分位、ADX、EMA gap 判斷 trend/range/high_volatility/low_volatility | 前端能看目前訊號處於哪一類市場，並顯示該 regime 的歷史勝率與 R |
| 動態門檻 | 根據樣本量、勝率、平均 R、regime 優勢與訓練品質自動調整 enter/small/wait 門檻 | 避免固定 78/62/42 在不同策略與市場條件下失真 |
| 訓練品質 | 建立 qualityGrade、separation、featureConcentration、resolvedRatio 等指標 | 前端可解釋模型是否樣本不足、標籤偏斜、特徵訊號弱或 regime 不利 |

## 不優先實作項目

大型語言模型可以作為「自然語言總結」或「風控提醒」，但不應直接修改分數、SL/TP 或 verdict。若未來要加 LLM，建議只把 Entry Trainer 的結構化輸出送入 prompt，回傳 summary/warnings，不讓其覆寫核心交易欄位。
