# 新環境續作指南：BTCUSDT Dashboard v6 全修版

作者：**Manus AI**  
更新日期：2026-05-15

本文件說明如何在新的 Linux、macOS 或雲端開發環境中接手 **BTCUSDT Dashboard v6 全修版**，包含解壓專案、安裝依賴、啟動服務、重新建置、驗證 PA / 纏論 / 新聞 / 行情狀態，以及後續繼續開發時應優先檢查的檔案與資料流。Vite 用於前端正式建置，pnpm 依鎖定檔安裝依賴，esbuild 則負責將 Node 後端入口打包為可部署產物。[1] [2] [3]

## 一、環境需求

此專案使用 Node.js、pnpm、Vite、React、TypeScript、TailwindCSS、Express/tRPC 與 esbuild。建議在乾淨環境中使用 Node.js 22.x，並透過 pnpm 安裝依賴；若環境中尚未安裝 pnpm，可使用 Corepack 或 npm 安裝。

| 項目 | 建議版本或條件 | 備註 |
| --- | --- | --- |
| 作業系統 | Ubuntu 22.04+、macOS、Debian 系 Linux | 若部署到伺服器，建議使用 Linux |
| Node.js | 22.x | 本專案驗證環境為 Node.js 22.13 |
| pnpm | 9.x 或更新版本 | 以 `pnpm-lock.yaml` 安裝依賴 |
| 記憶體 | 至少 2GB | 建置 Vite 前端時建議保留足夠記憶體 |
| 網路 | 可連接交易所、RSS 與外部資料來源 | 即時行情、新聞與部分分析資料需要網路 |

## 二、解壓與安裝

將交付壓縮包複製到新環境後，先建立工作目錄並解壓。以下以 `btcusdt_dashboard_v6_fullfix_20260515.tar.gz` 為例；如果檔名不同，請替換成實際檔名。

```bash
mkdir -p ~/projects
cd ~/projects
tar -xzf /path/to/btcusdt_dashboard_v6_fullfix_20260515.tar.gz
cd btcusdt_dashboard_v6
pnpm install
```

若新環境尚未安裝 pnpm，可先執行：

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

或使用 npm 安裝：

```bash
npm install -g pnpm
```

## 三、啟動開發服務

安裝依賴後，可在專案根目錄使用下列指令啟動開發服務。`PORT=3001` 會讓前後端整合服務監聽在 3001 連接埠。

```bash
cd ~/projects/btcusdt_dashboard_v6
PORT=3001 pnpm dev
```

服務啟動後，請在瀏覽器開啟：

```text
http://localhost:3001/
```

若 3001 被舊行程占用，建議先清理舊服務再重啟，避免測到舊版程式碼。

```bash
ss -ltnp | grep ':3001'
# 找到 PID 後終止；請替換成實際 PID
kill <PID>
PORT=3001 pnpm dev
```

## 四、正式建置、測試與稽核

若要產生正式前端資產與後端 bundle，請執行：

```bash
pnpm run b
```

本專案的正式建置流程包含兩段：第一段使用 Vite 產生前端輸出，第二段使用 esbuild 將 `server/_core/index.ts` 以 Node 平台與 ESM 格式打包。esbuild 的 `--packages=external` 用於保留外部依賴，避免將不適合 bundle 的套件硬打進後端輸出。[3]

建議新環境接手後至少跑一次下列指令，以確認全修版沒有因環境差異而回歸：

```bash
pnpm run c
pnpm run b
pnpm test
pnpm audit
```

## 五、功能驗證清單

新環境啟動後，建議先依下表確認核心功能。這些項目是本次交付已驗證的重點，也是後續繼續開發前最適合做 smoke test 的範圍。

| 驗證項目 | 操作方式 | 預期結果 |
| --- | --- | --- |
| 首頁載入 | 開啟 `http://localhost:3001/` | 顯示 BTCUSDT 儀表板、K 線與右側分析分頁 |
| 行情狀態 | 觀察右下角或頂部提示 | 正常時顯示「行情即時」；fallback 時應顯示 provider 與降級說明 |
| 時間框架切換 | 點擊 `5M / 15M / 1H / 4H` | K 線與分析資料更新，不應出現紅色錯誤頁 |
| 桌面 PA 入口 | 在寬螢幕點擊右側 `PA` | 顯示 PA 多時間框架、支撐阻力與 K 線形態資訊 |
| 桌面纏論入口 | 在寬螢幕點擊右側 `纏論` | 顯示 `多時段纏論總結`，且 4H、1H、15M、5M 四時區快速一覽不為空 |
| 新聞面板 | 點擊右側 `新聞` | 先顯示 RSS 載入狀態，完成後顯示情緒統計、新聞列表與篩選器；若來源失敗則顯示重試提示 |
| SMC 面板 | 點擊 `SMC` | 可切換 SMC 內部分頁，不應出現 Radix Tabs runtime error |
| 技術指標面板 | 點擊 `指標` | 顯示 Order Flow / OI、VWAP / TPO、趨勢線與四時區比較矩陣 |
| Champion 分析 | 觸發策略分析或查看策略中心 | 外部模型不可用時仍應回傳本地 fallback 結果 |
| Snapshot API | 查詢 `/api/trpc/crypto.getSnapshot` | `chan_mtf.timeframes` 與 `chan_mtf.signals` 均包含 `4h / 1h / 15m / 5m` |

## 六、關鍵檔案與資料流

後續若要新增功能，請優先理解 `Dashboard.tsx` 如何掛載各個面板，以及 `server/analysis.ts` 與 `server/routers.ts` 如何共同組合前端需要的 snapshot。資料流大致是後端取得交易所與衍生資料，經分析核心產生多時間框架、指標、SMC、PA、纏論與策略分析，再透過 tRPC 提供給 React 面板。

| 路徑 | 角色 | 續作建議 |
| --- | --- | --- |
| `client/src/pages/Dashboard.tsx` | 儀表板主入口、分頁配置與行情降級橫幅 | 新增入口、調整手機/桌面佈局或提示訊息時先改此檔 |
| `client/src/hooks/useDashboardWebSocket.ts` | WebSocket 與行情 provider 狀態 hook | 修改即時行情、fallback provider 或重連邏輯時優先檢查 |
| `client/src/components/panels/NewsPanel.tsx` | 新聞與 RSS 狀態面板 | 新增新聞來源、情緒分類或空狀態文案時改此檔 |
| `client/src/components/panels/PaPanel.tsx` | PA 分析面板 | 新增 Rayner / Al Brooks / 支撐阻力規則時改此檔與後端 PA 資料 |
| `client/src/components/panels/ChanPanel.tsx` | 纏論面板 | 新增筆、線段、中樞或買賣點視覺化時改此檔與 `ChanMtfData` |
| `client/src/components/panels/IndicatorsPanel.tsx` | 技術指標面板 | 新增 VWAP、TPO、CVD、OI/Funding 類卡片時改此檔 |
| `client/src/components/panels/SmcPanel.tsx` | SMC 面板 | 新增 BOS、CHOCH、OB、FVG 或 liquidity pool 呈現時改此檔 |
| `server/analysis.ts` | 指標與策略計算核心 | 新增或修正分析規則、`chan_mtf` 正式資料時改此檔 |
| `server/routers.ts` | tRPC API 路由與 fallback snapshot | 新增 snapshot 欄位或 fallback 行為時必須同步改此檔 |
| `shared/cryptoTypes.ts` | 前後端共用型別 | 新增資料欄位前先在此檔定義型別 |
| `RELEASE_PACKAGE_NOTES.md` | 本次交付說明 | 後續交付時應同步更新 |
| `validation_browser_notes.md` | 本輪瀏覽器與 API 驗證筆記 | 排查資料契約或 UI 狀態時可參考 |

## 七、`chan_mtf` 契約注意事項

本輪修復的重點之一是避免纏論面板讀到空的 `chan_mtf`。後續任何調整都應維持下列契約：`chan_mtf.timeframes` 應提供四個時區的 `ChanResultData`，`chan_mtf.signals` 應提供對應時區的信號摘要，`chan_mtf.summary` 則應提供整體趨勢、共識度、主導時段與操作建議。

| 欄位 | 必要鍵值 | 用途 |
| --- | --- | --- |
| `chan_mtf.timeframes` | `4h / 1h / 15m / 5m` | 前端子分頁與詳細結構顯示 |
| `chan_mtf.signals` | `4h / 1h / 15m / 5m` | 快速一覽中的方向、操作與信心提示 |
| `chan_mtf.summary` | `overall_trend`、`dominant_timeframe`、`alignment_score` 等 | 多時區共識摘要與操作建議 |

> 若主分析引擎失敗，fallback snapshot 也必須維持同一份契約。這是避免前端在異常情境下退回空白纏論面板的關鍵。

## 八、後續開發建議

後續若繼續開發，建議採用「先後端型別、再資料來源、再 UI 呈現、最後驗證」的順序。新增任何 dashboard 欄位時，先修改 `shared/cryptoTypes.ts`，再於 `server/analysis.ts` 或 `server/routers.ts` 產出資料，最後才調整前端面板。這樣可以降低前端讀取不存在欄位而造成 runtime error 的風險。

| 優先級 | 建議工作 | 原因 |
| --- | --- | --- |
| 高 | 為 `chan_mtf` 組裝 helper 與 fallback snapshot 加入固定樣本測試 | 可避免日後新增欄位時破壞纏論面板契約 |
| 高 | 為 WebSocket provider 與 REST fallback 建立模擬測試 | 可確認行情降級提示在網路異常時可靠顯示 |
| 高 | 為新聞面板新增空資料、錯誤與篩選無結果的元件測試 | 可避免 RSS 來源異常時回到空白狀態 |
| 中 | 將 PA 與纏論計算規則拆成可測試的純函式 | 可降低 UI 與分析邏輯耦合，方便單元測試 |
| 中 | 補充使用者可調參數，例如 PA 評分權重、纏論時段權重 | 可提升策略分析的可操作性 |
| 低 | 將行動版底部入口做成可橫向捲動或自適應壓縮 | 若後續入口超過 8 個，可避免過度擁擠 |

## 九、常見問題排查

如果 `pnpm install` 失敗，請先確認 Node.js 與 pnpm 版本，並刪除舊的 `node_modules` 後重新安裝。如果 `PORT=3001 pnpm dev` 啟動失敗，請檢查 3001 連接埠是否已被占用；若已被占用，可終止舊行程或改用其他 PORT。若頁面顯示資料為 `---`，通常代表行情 API 暫時未回應或網路受限，請先確認伺服器是否能連接交易所與外部資料來源。

```bash
# 檢查連接埠占用
ss -ltnp | grep ':3001'

# 改用其他連接埠啟動
PORT=3002 pnpm dev

# 重新安裝依賴
rm -rf node_modules
pnpm install
```

若纏論分頁再次變成空白，請先直接查詢 snapshot API，確認 `chan_mtf` 是否含四時區鍵值。若 API 有資料但 UI 沒有顯示，檢查 `ChanPanel.tsx`；若 API 沒資料，檢查 `server/analysis.ts` 與 `server/routers.ts` 是否同步維持正式與 fallback 契約。

## 十、交接摘要

目前最重要的交接結論是：**PA、纏論、SMC、指標、新聞與策略主線都已具備可驗證入口；`chan_mtf` 已完成正式與 fallback 契約補齊；行情來源與新聞來源也具備使用者可理解的狀態提示**。若新環境需要繼續擴充，請先完成本文件第五節的 smoke test，再依第六節與第七節的資料流逐步修改。

## 參考資料

[1]: https://vite.dev/guide/build "Vite Build Guide"  
[2]: https://pnpm.io/cli/install "pnpm install Documentation"  
[3]: https://esbuild.github.io/api/#bundle "esbuild Bundle API"
