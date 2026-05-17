# Nurse Neil 訊號評分模組接入報告

本報告由 `reports/build_nurse_neil_signal_scoring.py` 產生，目標是把 Nurse Neil 類型的主觀圖形訊號轉換為可重複、可審計、可接入 V6 紙交易流程的 **0–100 分量化評分**。目前版本適合做候選信號源與跟單風控層，不應直接作為自動實盤下單依據。

> 來源資料：`/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_signal_input_template.csv`。輸出資料：`/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_signal_scored.csv`、`/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_signal_scoring_results.json`。

| 指標 | 數值 |
|---|---:|
| 訊號數 | 4 |
| 平均分 | 68.00 |
| 可交易訊號數 | 2 |
| 正常倉 | 1 |
| 半倉 | 0 |
| 四分之一倉 | 1 |
| 拒絕 | 2 |

## 評分結果

| symbol    | timeframe   |   weighted_rr |   stop_distance_pct |   total_score | grade   | decision     |   suggested_account_risk_pct |   position_notional_per_10000_usdt | warnings       | hard_rejects     |
|:----------|:------------|--------------:|--------------------:|--------------:|:--------|:-------------|-----------------------------:|-----------------------------------:|:---------------|:-----------------|
| XRPUSDT   | 4H          |        4.7456 |              2.8834 |            96 | A+      | normal_size  |                         1    |                            3468.17 |                |                  |
| CETUSUSDT | 4H          |       12.0714 |              2.7668 |            68 | C       | quarter_size |                         0.25 |                             903.57 |                |                  |
| AVNTUSDT  | 4H          |        8.4714 |              8.1081 |            59 | D       | reject       |                         0    |                               0    |                | 止損距離 8.11% 超過 6% |
| INITUSDT  | 1H          |        6.4074 |              2.967  |            49 | D       | reject       |                         0    |                               0    | 1H scalp 訊號需降倉 |                  |

## 接入判斷

此模組可以加進現有分析系統，但建議以 **外部信號評分層** 方式接入，而不是直接併入 HTR/V6 的自動策略核心。原因是 Nurse Neil 的原始訊號包含人工畫線、SR flip、DCA、TP 顏色標註等主觀元素；這些元素在未建立完整圖形識別與歷史訊號資料庫前，難以做到完全機械化。因此，第一階段應將它作為人工輸入或半自動 OCR 後的訊號評分表，再交給 V6 成本、滑點、紙交易驗收框架驗證。

## 建議接入方式

| 接入層級 | 做法 | 是否建議 |
|---|---|---|
| 獨立信號源 | Telegram/截圖訊號整理成 CSV，使用本模組打分後輸出跟單決策 | 建議，作為第一階段 |
| V6 過濾器 | 只允許 Score ≥ 70、RR ≥ 2、止損距離 ≤ 6%、無 hard reject 的外部訊號進入紙交易 | 建議 |
| 倉位管理層 | 用分數映射每單帳戶風險：90+ 為 1%，70–89 為 0.5%–0.75%，60–69 為 0.25% | 建議 |
| 自動實盤策略 | 直接按 Nurse Neil 訊號自動下單 | 暫不建議 |

## 下一步

下一步若要真正接進前端儀表板，可以新增一個 `NurseNeilPanel` 或併入 `SignalAlertPanel`，後端調用 `server/services/nurseNeilSignalScorer.ts`。若要做回測，則需要至少 100–200 筆歷史訊號，欄位包括訊號時間、入場價、止損、全部 TP、實際觸發結果、最大有利/不利波動、是否因 BTC 4H 風險被過濾，以及扣除 taker fee/slippage 後的結果。
