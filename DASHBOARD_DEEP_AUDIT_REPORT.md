# Crypto Analyst Dashboard 深度體檢與修復報告

本次檢查針對目前的 Dashboard 進行了系統級排查，範圍涵蓋 **服務進程、API 路由、K 線資料流、回測引擎、前端圖表、行動端佈局、策略快照契約與穩定性**。檢查過程中不只修復了表面錯誤，也處理了幾個會造成後續反覆出錯的根因。

## 一、核心問題定位

| 類別 | 發現問題 | 影響 | 狀態 |
|---|---|---|---|
| 服務進程 | 多個舊版開發服務同時存在，端口在 3000/3001/3003/3005 間漂移 | 手機端可能打到舊版本或失效端口 | 已清理並啟動單一新版服務 |
| K 線資料 | `analysis.ts` 曾被臨時 stub 化，導致圖表空白與回測 0 根 K 線 | 圖表沒有蠟燭、回測報錯 | 已重寫為穩定本地分析引擎 |
| 回測引擎 | `runBacktest` 是 async Promise，但路由端用同步方式讀取 `btResult.trades` | 造成 `Cannot read properties of undefined (reading 'length')` | 已修復為同步使用已傳入 K 線資料 |
| API 驗證 | V8 策略未完整加入部分白名單 | V8 回測會被 Zod 擋下 | 已加入 `v8_hybrid` |
| 前端圖表 | 圖表清理與 series 生命週期曾有 undefined 風險 | 熱重載或切換頁籤時崩潰 | 已加強安全清理 |
| 行動端 | 原三欄桌面式佈局在手機上擁擠 | 使用體驗不佳 | 已改為底部導航與單面板模式 |

## 二、已完成修復

### 1. 後端資料引擎修復

已將 `server/analysis.ts` 從臨時 stub 恢復為可用的本地分析引擎，現在能夠實際拉取 Binance 公開 K 線資料，並輸出前端需要的完整 snapshot 結構，包括：

| 欄位 | 說明 |
|---|---|
| `live_price` | 最新 BTCUSDT 價格 |
| `indicators` | RSI、MACD、ADX、ATR、Bollinger、VWAP、EMA、Stochastic |
| `mtf_indicators` | 4H、1H 等多週期指標快照 |
| `consensus` | 多指標共識評分 |
| `strategy` | 策略方向、理由與信心資料 |
| `forecast` | 前端預測面板所需結構 |
| `klines` | 圖表與策略中心共用 K 線資料 |

### 2. 回測引擎修復

`server/backtest.ts` 中的 `runBacktest` 已改為使用路由傳入的 `candles`、`candles_4h`、`htf_candles` 或 `mtf_candles`，避免在回測函數內再次非同步抓資料。這解決了後端路由中 `btResult.trades` 讀取 undefined 的問題。

修復後，V8 回測 API 已實測成功返回交易紀錄與 R-Multiples：

| 測試項 | 結果 |
|---|---|
| `backtest.run` + `v8_hybrid` | 成功 |
| `BTCUSDT` / `1H` / `limit=300` | 成功取得資料 |
| 回傳 `trades` | 成功 |
| 回傳 `equity_curve` | 成功 |
| 回傳 `total_r_multiple` | 成功 |

### 3. 行動端可用性修復

手機端現在採用更適合小螢幕的結構：圖表、策略、回測、新聞拆分為底部導航頁籤，不再強行顯示桌面三欄。這能避免右側欄壓縮圖表、按鈕太小與內容重疊等問題。

## 三、實測結果

| 實測項 | 結果 |
|---|---|
| 健康檢查 `/health` | 正常，返回 `status: ok` |
| K 線 API `crypto.getKlines` | 正常，返回真實 K 線資料 |
| Snapshot API `crypto.getSnapshot` | 正常，返回完整指標快照 |
| V8 回測 `backtest.run` | 正常，返回交易列表與績效統計 |
| 手機端服務訪問 | 新端口已暴露 |

目前最新可用鏈接為：

[https://3003-i9vjsevx18s7o46emsfts-0298e436.sg1.manus.computer](https://3003-i9vjsevx18s7o46emsfts-0298e436.sg1.manus.computer)

## 四、仍建議後續優化的方向

目前系統已恢復可用並通過核心 API 驗證，但若要接近真正 TradingView 級別，建議下一輪做以下優化：

| 優先級 | 改良項 | 原因 |
|---|---|---|
| 高 | 固定服務端口與啟動腳本 | 避免端口漂移造成手機鏈接失效 |
| 高 | 增加前端 API Error Boundary 與重試按鈕 | API 暫時失敗時不要讓整頁崩潰 |
| 高 | 為圖表增加「資料載入中 / 無資料 / API 失敗」三段式狀態 | 避免空白圖表讓使用者誤判系統壞掉 |
| 中 | 回測結果增加交易標記 overlay | 將進場、止損、止盈直接畫在 K 線上 |
| 中 | 增加手機橫屏專用圖表模式 | 手機橫屏時更接近專業交易終端 |
| 中 | 將 Binance API 加入備援來源 | Binance 不可用時可降級到 OKX 或本地快取 |
| 低 | 增加 PWA 安裝模式 | 手機可像 App 一樣固定到桌面 |

## 五、結論

本次深度檢查後，Dashboard 的主要阻塞問題已修復：**圖表空白、回測 0 根 K 線、V8 策略驗證、回測 Promise 錯誤、端口失效與行動端布局擁擠** 都已處理。現在系統可以正常取得真實 K 線、生成完整快照，並執行 V8 回測。

下一步最值得做的是把「交易標記 overlay」與「固定端口/穩定部署」做好，這會讓整體體驗更接近真正專業交易平台。
