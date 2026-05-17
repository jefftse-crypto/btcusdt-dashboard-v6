# Entry Trainer 自動 Forward Test 設計

本設計採用 **paper trading / forward test**，只記錄模擬交易，不串接交易所 API、不讀取下單金鑰、不送出任何真實委託。目的不是自動交易，而是累積 30–50 筆以上未來樣本，用來驗證 Entry Trainer 在實盤時間序列中的泛化能力。

## 執行方式

Forward test 會整合到現有後端服務，隨 production server 啟動。排程頻率先採用 5 分鐘一次；每次掃描 BTCUSDT、ETHUSDT 的 15m 與 1h，對 live 白名單策略呼叫既有 Entry Trainer `scoreEntry`，再以策略可靠度 leaderboard 作為安全濾網。此流程只呼叫市場資料與內部評分函式，不會觸發 Telegram 下單或任何交易所委託。

| 模組 | 設計 |
|---|---|
| 儲存 | `runtime/entry_forward_test_state.json` |
| 交易型態 | paper trade，只記錄 entry/sl/tp/score/verdict |
| 開倉條件 | verdict 為 `進場` 或 `小倉`，score 達 small 門檻，OOS 非 fragile，策略推薦非 `保守/避免` |
| 去重 | 同 symbol/timeframe/strategy/direction 只保留一筆 open trade |
| 結案 | 每次排程用最新 K 線檢查 TP/SL/timeout，若同根同時碰 TP/SL 採保守 SL 優先 |
| timeout | 15m 預設 32 根，1h 預設 48 根，timeout 以目前收盤價計算 R |
| 統計 | 總筆數、open/closed、勝率、平均 R、profitFactor、最近 20 筆平均 R、策略/timeframe breakdown |

## 實戰安全規則

Forward test 的推薦只用來衡量系統是否逐步具備實戰條件。即使 forward test 有正報酬，也不應直接轉為自動真實交易；要升級到實盤前，至少需要足夠樣本、明確風控、交易所沙盒測試、異常停機保護與人工確認流程。

| 條件 | 用途 |
|---|---|
| 30–50 筆 closed paper trades | 最低 forward test 樣本門檻 |
| 平均 R > 0.10 | 扣除費用滑價後仍有緩衝 |
| 最近 20 筆平均 R 不惡化 | 避免早期好表現後失效 |
| OOS 非 fragile | 避免模型明顯過擬合 |
| 策略推薦至少 `可觀察` | 避免 regime 不合的策略進入測試 |
