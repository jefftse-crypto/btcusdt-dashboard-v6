# BTCUSDT Dashboard v6 全修版交付說明

作者：**Manus AI**  
更新日期：2026-05-15

本交付包包含修復後的 **BTCUSDT Dashboard v6** 專案原始碼、前端建置輸出、後端程式、共用型別、驗證筆記與必要資料檔。為避免洩漏敏感資訊並控制壓縮包體積，打包時會排除 `node_modules`、`.env`、`.env.local`、`.manus-logs`、開發伺服器暫存記錄、瀏覽器快照與其他本機快取；依賴套件可在新環境透過 `pnpm install` 重新安裝。Vite 的正式建置流程負責產生前端靜態資產，而 esbuild 在本專案中用於打包 Node 後端入口；pnpm 則依 `pnpm-lock.yaml` 安裝可重現依賴版本。[1] [2] [3]

## 本次全修重點

本輪是在先前 v6 儀表板功能補強基礎上進行的全系統收斂修復。除了保留已完成的 **SMC、PA、纏論獨立入口**、技術指標四時區並排比較、Champion fallback、15m 資料流與 K 線時間戳修正之外，本次新增修復了三個容易造成使用者誤判或前端資料空洞的主線問題：**`chan_mtf` 正式資料契約補齊**、**WebSocket/行情來源降級狀態顯示**，以及 **新聞面板載入、錯誤與空資料狀態提示**。

| 類別 | 已完成內容 | 驗證狀態 |
| --- | --- | --- |
| 纏論多時區契約 | 在 `server/analysis.ts` 將 PA 內嵌纏論資料組裝為 `chan_mtf.timeframes`、`chan_mtf.signals` 與 `chan_mtf.summary`；在 `server/routers.ts` fallback 快照同步補齊相同契約 | 已以 API 與瀏覽器雙重驗證，四時區鍵值為 `4h / 1h / 15m / 5m` |
| WebSocket 降級提示 | 在 `useDashboardWebSocket.ts` 暴露行情連線狀態、provider 與降級訊息；在 `Dashboard.tsx` 顯示行情來源與降級橫幅 | 即時狀態下顯示「行情即時」，降級橫幅正確隱藏；若切到 fallback provider，UI 已具備提示入口 |
| 新聞狀態處理 | 在 `NewsPanel.tsx` 補強 RSS 載入中、錯誤、空資料與篩選無結果狀態，避免使用者看到空白面板 | 已驗證正常資料情境顯示 40 則新聞與情緒統計；異常與空狀態已具備清楚提示與重試按鈕 |
| 桌面與手機入口 | 桌面右側分頁維持 `策略 / 指標 / SMC / PA / 纏論 / 新聞`，手機入口維持完整分析導覽 | 已在前輪與本輪瀏覽器驗證中通過 |
| 技術指標四時區比較 | 指標面板保留 `指標 × 4H / 1H / 15m / 5M` 橫向比較矩陣 | 已納入正式建置與瀏覽器主線驗證 |
| SMC、PA、K 線與 Champion fallback | 延續既有 runtime error、資料流與 fallback 修復 | 已通過建置與 smoke test |

> 本次最重要的交付結論是：**纏論面板不再依賴空的 `chan_mtf`，而是能在正式 snapshot 與 fallback snapshot 中取得一致的四時區資料；行情與新聞面板也具備可理解的來源狀態與空狀態提示。**

## 主要修改檔案

本輪核心修改集中於資料契約、即時行情狀態與新聞面板的使用者可解釋性。`server/analysis.ts` 與 `server/routers.ts` 負責將後端資料契約補齊；`useDashboardWebSocket.ts` 與 `Dashboard.tsx` 負責把行情 provider、降級與重連狀態轉為前端可見訊息；`NewsPanel.tsx` 則補上資料來源失敗或無資料時的清楚 UI。

| 檔案 | 本輪用途 |
| --- | --- |
| `server/analysis.ts` | 新增 `chan_mtf` 組裝 helper，從多時區 PA 內嵌纏論結果建立正式 `ChanMtfData` |
| `server/routers.ts` | 在 fallback snapshot 同步產生 `chan_mtf`，避免主引擎失敗時回傳空纏論契約 |
| `client/src/hooks/useDashboardWebSocket.ts` | 擴充 hook 回傳欄位，暴露行情連線狀態、provider 與降級訊息 |
| `client/src/pages/Dashboard.tsx` | 新增行情來源與降級提示橫幅，並保留桌面右側與手機入口配置 |
| `client/src/components/panels/NewsPanel.tsx` | 補強 RSS 載入中、錯誤、空資料、篩選無結果與重試提示 |
| `shared/cryptoTypes.ts` | 作為 `CryptoSnapshot`、`ChanResultData`、`ChanMtfData` 等前後端契約依據 |
| `validation_browser_notes.md` | 記錄本輪瀏覽器與 API 驗證結果 |

## 建置、測試與瀏覽器驗證摘要

本輪完成程式修改後，已重新執行 TypeScript 靜態檢查、正式建置、Vitest 測試、依賴安全稽核與瀏覽器 smoke test。預覽服務曾清理舊行程後固定重啟於 port `3001`，避免瀏覽器誤連到舊版開發服務。

| 驗證項目 | 指令或方式 | 結果 |
| --- | --- | --- |
| TypeScript 靜態檢查 | `pnpm run c` | 通過 |
| 正式建置 | `pnpm run b` | 通過，前端 Vite 與後端 esbuild 產物可生成 |
| 測試 | `pnpm test` | 通過，Vitest smoke test 與既有測試未回歸 |
| 安全稽核 | `pnpm audit` | 已執行，未發現需阻斷本次交付的主線問題 |
| 服務重啟 | 清理 3001/3002/3003 舊行程後以 `PORT=3001 pnpm dev` 重啟 | 通過，服務顯示 `Server running on http://localhost:3001/` |
| Dashboard 主頁 | 瀏覽器開啟預覽 URL | 通過，主頁、K 線、策略區與右側分頁可載入 |
| 纏論分頁 | 點擊右側 `纏論` | 通過，顯示 4H、1H、15M、5M 四時區快速一覽與趨勢摘要 |
| 新聞分頁 | 點擊右側 `新聞` | 通過，先顯示 RSS 載入狀態，完成後顯示 40 則新聞、情緒統計與篩選器 |
| Snapshot API | 查詢 `/api/trpc/crypto.getSnapshot` | 通過，`chan_mtf.timeframes` 與 `chan_mtf.signals` 均包含四時區鍵值 |

> 預覽 URL：<https://3001-i9vjsevx18s7o46emsfts-0298e436.sg1.manus.computer>

## 啟動方式

新環境解壓後，請先安裝 Node.js 22.x 與 pnpm，再於專案根目錄安裝依賴並啟動開發服務。專案的 `package.json` 已定義開發、建置、測試與檢查腳本；其中正式建置會先執行 Vite 前端建置，再以 esbuild 打包 Node 後端。

```bash
cd btcusdt_dashboard_v6
pnpm install
PORT=3001 pnpm dev
```

若要自行建置正式輸出，可執行：

```bash
pnpm run b
```

若要重新跑完整 smoke test，建議依序執行：

```bash
pnpm run c
pnpm run b
pnpm test
pnpm audit
```

## 已知事項與後續建議

目前 Dashboard 主線功能已可交付。後續若要繼續提高工程品質，建議將 `chan_mtf` 組裝 helper 與新聞狀態處理拆出更細的單元測試，並為 snapshot API 建立固定樣本，以便在新增欄位時快速偵測資料契約破壞。若未來要模擬行情 provider 降級，可在開發環境中暫時阻斷交易所 WebSocket 連線，確認橫幅顯示 Kraken REST 輪詢或其他 fallback provider 訊息。

## 參考資料

[1]: https://vite.dev/guide/build "Vite Build Guide"  
[2]: https://pnpm.io/cli/install "pnpm install Documentation"  
[3]: https://esbuild.github.io/api/#bundle "esbuild Bundle API"
