# Nurse Neil 理論多幣種回測最終報告

## 1. 概述

本報告旨在對 Nurse Neil 交易理論進行多幣種批量回測，評估其在真實市場數據與 V6 成本壓力模型下的績效表現。回測範圍涵蓋 8 個主流幣種（AVAXUSDT, BNBUSDT, BTCUSDT, DOGEUSDT, ETHUSDT, LINKUSDT, SOLUSDT, XRPUSDT），時間週期為 2025 年 5 月至 2026 年 5 月，使用 Binance 期貨 15m K 線數據轉換為 4H K 線進行分析。

## 2. 回測規則與假設

本回測將 Nurse Neil 理論抽象為以下機械化規則：

- **入場條件**：基於 4H K 線，尋找價格從下跌趨勢中突破前期高點 (prior_high_20)、SR flip (支撐阻力轉換)、均線（EMA20, EMA50）確認、以及 BTC 過濾器（避免 BTC 大幅下跌時做多山寨幣）等綜合條件。
- **止損**：基於入場價與 ATR (Average True Range) 計算，並設定最大止損比例為 6%。
- **止盈**：採用分批止盈策略，分為 4 個目標，分別為風險回報比 (R:R) 1.5, 2.5, 4.0, 6.0。
- **出場**：除了止損和止盈，還設有最大持倉時間 42 根 4H K 線（約 7 天）的出場條件。
- **成本模型**：
    - **手續費**：單邊 5 BPS (0.05%)。
    - **基礎滑點**：單邊 5 BPS (0.05%)。
    - **壓力滑點**：單邊 15 BPS (0.15%)，用於模擬流動性較差或市場劇烈波動時的成交成本。
- **評分機制**：訊號根據結構、風險回報、止損合理性、流動性、滑點風險和波動性等多個維度進行評分，總分 0-100。

## 3. 回測結果

### 3.1 基礎績效 (Score >= 70)

在 Score >= 70 的篩選條件下，回測結果如下：

| 指標名稱               | 數值       | 單位   |
| :--------------------- | :--------- | :----- |
| 總交易次數             | 153        | 筆     |
| 交易幣種數             | 8          | 個     |
| 勝率                   | 44.44      | %      |
| 平均毛風險回報比 (R)   | 0.10       |        |
| 總帳戶收益             | 13.99      | %      |
| 最大回撤               | -23.67     | %      |
| 盈利因子               | 1.21       |        |
| 平均訊號分數           | 94.0       |        |
| 平均淨名義收益         | 0.23       | %      |

![Nurse Neil Theory Universe Backtest Equity Curve](/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_theory_universe_equity.png)

**圖 1: Nurse Neil 理論回測累積收益曲線 (Score >= 70)**

從累積收益曲線來看，策略在 2025 年 9-10 月有顯著增長，但隨後出現較大回撤，並在回測期末表現平穩。總體而言，在基礎成本模型下，策略呈現正收益，但最大回撤較大，盈利因子也相對較低。

### 3.2 成本壓力測試 (Score >= 70)

在考慮壓力滑點 (單邊 15 BPS) 的情況下，策略績效如下：

| 指標名稱               | 數值       | 單位   |
| :--------------------- | :--------- | :----- |
| 總交易次數             | 153        | 筆     |
| 總帳戶收益             | 13.99      | %      |
| 平均淨名義收益 (壓力)  | 0.03       | %      |

壓力測試結果顯示，在更高的滑點成本下，平均淨名義收益大幅下降，從 0.23% 降至 0.03%。這表明策略對交易成本較為敏感，在流動性不足或市場波動劇烈時，實際收益可能會受到顯著侵蝕。

### 3.3 門檻敏感度分析

回測結果顯示，在 Score >= 70 和 Score >= 80 的篩選條件下，總交易次數和整體績效指標變化不大。這可能意味著當前評分模型在 70 分以上時，訊號的質量差異不明顯，或者高分訊號的數量不足以形成顯著的統計差異。

## 4. 結論與建議

### 4.1 結論

1. **理論可行性**：Nurse Neil 理論經過機械化轉換後，在多幣種歷史數據上顯示出一定的盈利潛力，在基礎成本模型下能實現正收益。
2. **成本敏感性**：策略對交易成本（尤其是滑點）高度敏感。在壓力測試情境下，收益會大幅縮水，這對實盤執行構成挑戰。
3. **評分模型局限**：當前評分模型在 70 分以上對績效的區分度不夠明顯，可能需要進一步優化評分權重或引入更多篩選因子。
4. **回撤較大**：策略的最大回撤達到 23.67%，對於實盤資金管理需要更嚴格的控制。

### 4.2 建議

1. **優化評分模型**：深入分析高分訊號與低分訊號的差異，調整評分權重，或引入更多能有效區分訊號質量的因子，以提高高分訊號的勝率和風險回報。
2. **加強止損策略**：考慮引入更動態的止損機制，例如移動止損、時間止損或基於波動率的止損，以減少最大回撤。
3. **實施紙交易**：在投入實盤資金前，強烈建議將此策略部署到紙交易環境中，進行至少 3-6 個月的實時驗證，觀察其在不同市場環境下的表現，並記錄真實的滑點與手續費影響。
4. **小資金實盤**：若紙交易表現穩定，可考慮小資金實盤運行，並持續監控績效，逐步調整倉位。
5. **流動性考量**：在選擇交易幣種時，應優先考慮流動性較好的品種，以降低滑點對收益的侵蝕。

## 5. 參考資料

[1] Nurse Neil 理論回測腳本: `/home/ubuntu/btcusdt_dashboard_v6/reports/backtest_nurse_neil_theory_universe.py`
[2] Nurse Neil 理論回測累積收益圖: `/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_theory_universe_equity.png`
[3] Nurse Neil 理論回測摘要: `/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_theory_universe_summary.json`
[4] Nurse Neil 理論回測交易明細: `/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_theory_universe_trades.csv`
[5] Nurse Neil 理論回測門檻敏感度: `/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_theory_universe_thresholds.csv`
[6] Nurse Neil 理論回測分幣種結果: `/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_theory_universe_by_symbol.csv`
[7] Nurse Neil 遷移指南: `/home/ubuntu/btcusdt_dashboard_v6/reports/nurse_neil_migration_guide.md`
