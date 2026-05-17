# AI Entry Trainer v6.4.3 實戰可用性檢查

作者：Manus AI  
檢查時間：2026-05-17

## 結論

目前系統已經具備**輔助實戰決策**的條件，但還不應該直接作為全自動下單依據。服務、首頁、tRPC API、Entry Score、Trainer Status 與 Strategy Reliability 都可以正常回傳；同時，本次檢查已補強一個實戰安全門檻：策略排行榜不再只因 OOS 勝率高就列為「優先」，而會同時檢查 OOS 平均 R 是否高於保守的手續費與滑價緩衝。

> 實戰定位應該是「訊號過濾器」與「倉位調整器」，不是單獨的交易引擎。若 OOS verdict 為 fragile，即使分數看起來不低，也應只允許保守觀察或小倉測試。

## 服務與 API 健康狀態

| 檢查項目 | 結果 | 判讀 |
|---|---:|---|
| Production 首頁 | HTTP 200 | 正常 |
| 服務連接埠 | 3001 | 正常，已清除誤跑到 3002 的重複程序 |
| 目前 PID | 10868 | 正常 |
| `ai.entryTrainerStatus` | HTTP 200 | 正常 |
| `ai.entryScore` | HTTP 200 | 正常 |
| `ai.entryStrategyReliability` | HTTP 200 | 正常 |
| TypeScript check | 通過 | 正常 |
| Production build | 成功 | 正常 |

## BTCUSDT 1h v8_hybrid 現況

| 指標 | 數值 | 實戰判讀 |
|---|---:|---|
| 訓練樣本 | 624 | 樣本數足夠做輔助判斷 |
| 訓練品質 | strong | 特徵與資料完整度可用 |
| Entry Score | 53 | 低於 small 門檻 59，不建議主動追單 |
| 方向 | short | 僅代表目前相似歷史樣本偏空，不等於直接進場 |
| 市場 regime | trend | 目前偏趨勢環境 |
| Enter / Small / Wait 門檻 | 86 / 59 / 36 | 目前 53 屬於等待或觀察區 |
| OOS verdict | fragile | 泛化能力偏弱，不能放大倉位 |
| OOS win rate | 37.04% | 勝率不足，不適合直接實戰進場 |
| OOS avg R | 0.0984 | 有微弱正 R，但不足以抵消訊號品質風險 |
| OOS predicted trades | 32 | 驗證樣本可用，但仍需持續追蹤 |
| Overfit risk | 3 | 過擬合風險低，但 edge 本身不足 |

## 策略可靠度排行榜判讀

| 排名 | 策略 | 可靠度 | 推薦 | OOS 判定 | OOS 勝率 | OOS 平均 R | 實戰判讀 |
|---:|---|---:|---|---|---:|---:|---|
| 1 | pa | 79 | 可觀察 | robust | 83.87% | 0.0415 | 勝率高但平均 R 太低，扣除成本後不列為優先 |
| 2 | rsi_reversal | 61 | 可觀察 | acceptable | 64.29% | 0.3466 | 可列入小倉候選，但仍需訊號共振 |
| 3 | v8_hybrid | 55 | 保守 | fragile | 37.04% | 0.0984 | 只適合背景參考，不宜單獨進場 |
| 4 | cannonball | 55 | 保守 | fragile | 37.04% | 0.0984 | 同上 |
| 5 | hwr_model_a | 55 | 保守 | fragile | 37.04% | 0.0984 | 同上 |

## 實戰操作規則

若要用於實盤或接近實盤的 paper trading，建議採用以下規則。第一，只有當 Entry Score 大於或等於 small 門檻，且 OOS verdict 至少為 acceptable，才允許小倉。第二，只有當 Entry Score 大於或等於 enter 門檻，OOS verdict 為 robust 或 acceptable，OOS avg R 大於 0.08，且策略可靠度推薦為「優先」或「可觀察」時，才允許正常倉位。第三，當 OOS verdict 為 fragile、unverified，或目前 regime 樣本不足時，系統訊號只能作為觀察，不應該作為主動下單理由。

## 本次額外修正

本次實戰檢查中發現兩個需要補強的點。第一，Trainer Status 原本沒有把 `validationStats` 回傳給前端或外部檢查，已補上，現在狀態 API 可以直接看到 OOS 統計。第二，策略排行榜原本可能把高勝率但平均 R 太低的策略列為「優先」，已加入 0.08R 的保守費用滑價緩衝與 predicted trade 數量門檻，因此 `pa` 目前從「優先」降為「可觀察」，較符合實戰風控。

## 最終判定

**可以實戰觀察與小倉 paper/live test，但不建議立刻全自動實盤。** 目前 BTCUSDT 1h 的 v8_hybrid OOS 判定為 fragile，當前 Entry Score 也沒有達到 small 門檻，因此此刻不是理想進場狀態。若要上線，建議先以 1/5 至 1/10 倉位進行至少 30 至 50 筆 forward test，並把實際成交後的滑價、手續費與 MFE/MAE 寫回訓練資料，再決定是否放大。
