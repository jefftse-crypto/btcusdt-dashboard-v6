# 打包與新環境部署稽核

## 最新壓縮包與校驗值
-rw-r--r-- 1 ubuntu ubuntu 37M May 15 01:26 btcusdt_dashboard_v6_release_20260515_indicator_comparison.tar.gz
-rw-r--r-- 1 ubuntu ubuntu 37M May 15 01:26 btcusdt_dashboard_v6_release_20260515_indicator_comparison.zip
-rw-r--r-- 1 ubuntu ubuntu 48K May 15 01:25 btcusdt_dashboard_v6_release_20260515_indicator_comparison_manifest.txt
-rw-r--r-- 1 ubuntu ubuntu 261 May 15 01:26 btcusdt_dashboard_v6_release_20260515_indicator_comparison_sha256.txt

dda5841dad6b9c040563be3989e0e0e28ff4d1c38fe6247eac03ffccc91862df  btcusdt_dashboard_v6_release_20260515_indicator_comparison.tar.gz
77bbbd6ad1089390673b7269bb079a1099fbc0b067c565ac278a6bbd21a811ad  btcusdt_dashboard_v6_release_20260515_indicator_comparison.zip

## TAR 內容抽查：核心檔案
btcusdt_dashboard_v6/BTCUSDT_Dashboard_v5_Final_Guide.md
btcusdt_dashboard_v6/Dashboard_v5_Upgrade_Report.md
btcusdt_dashboard_v6/client/src/components/DashboardLayout.tsx
btcusdt_dashboard_v6/client/src/components/DashboardLayoutSkeleton.tsx
btcusdt_dashboard_v6/client/src/components/panels/IndicatorsPanel.tsx
btcusdt_dashboard_v6/client/src/hooks/useDashboardWebSocket.ts
btcusdt_dashboard_v6/client/src/pages/Dashboard.tsx
btcusdt_dashboard_v6/client/src/pages/Dashboard.tsx.bak
btcusdt_dashboard_v6/package.json
btcusdt_dashboard_v6/pnpm-lock.yaml
btcusdt_dashboard_v6/server/_core/index.ts
btcusdt_dashboard_v6/server/routers.ts
btcusdt_dashboard_v6/verification_notes.md
btcusdt_dashboard_v6/BTCUSDT_Dashboard_v6_完整迁移与续作指南.md
btcusdt_dashboard_v6/dist/public/assets/IndicatorsPanel-Czcl6KlR.js
btcusdt_dashboard_v6/dist/public/assets/Dashboard-y-dLm0RO.js
btcusdt_dashboard_v6/RELEASE_PACKAGE_NOTES.md
btcusdt_dashboard_v6/verification_notes_mobile_smc.md
btcusdt_dashboard_v6/verification_notes_pa_chan.md
btcusdt_dashboard_v6/NEW_ENVIRONMENT_CONTINUATION_GUIDE.md
btcusdt_dashboard_v6/verification_notes_indicator_comparison.md

## TAR 敏感與依賴檔檢查
tar_sensitive_matches_exit=0

## ZIP 敏感與依賴檔檢查
zip_sensitive_matches_exit=0

## 專案內本機檔案風險（不等於已打包）
./.env
./.env.local
./.manus-logs/browserConsole.log
./.manus-logs/networkRequests.log
./.manus-logs/sessionReplay.log
./dev_server.log
./reports/nurse_neil_backtest_run.log
./reports/nurse_neil_theory_universe_run.log
./reports/nurse_neil_theory_universe_run_final.log

## 新環境指南關鍵行
1:# 新環境續作指南：BTCUSDT Dashboard v6
6:本文件說明如何在新的 Linux、macOS 或雲端開發環境中接手 **BTCUSDT Dashboard v6**，包含解壓專案、安裝依賴、啟動服務、重新建置、驗證 PA / 纏論入口，以及後續繼續開發時應優先檢查的檔案與資料流。
8:## 一、環境需求
10:此專案使用 Node.js、pnpm、Vite、React、TypeScript、TailwindCSS、Express/tRPC 與 esbuild。建議在乾淨環境中使用 Node.js 22.x，並透過 pnpm 安裝依賴；若環境中尚未安裝 pnpm，可使用 Corepack 或 npm 安裝。Vite 官方建置流程以 `vite build` 產生前端靜態資產，而 pnpm 會依據 `pnpm-lock.yaml` 安裝可重現的套件版本。[1] [2]
15:| Node.js | 22.x | 本專案原驗證環境為 Node.js 22.13 |
16:| pnpm | 9.x 或更新版本 | 以 `pnpm-lock.yaml` 安裝依賴 |
17:| 記憶體 | 至少 2GB | 建置 Vite 前端時建議保留足夠記憶體 |
20:## 二、解壓與安裝
22:將交付壓縮包複製到新環境後，先建立工作目錄並解壓。以下以 `btcusdt_dashboard_v6_release_20260515.tar.gz` 為例；如果檔名不同，請替換成實際檔名。
29:pnpm install
32:若新環境尚未安裝 pnpm，可先執行：
36:corepack prepare pnpm@latest --activate
39:或使用 npm 安裝：
42:npm install -g pnpm
45:## 三、啟動開發服務
47:安裝依賴後，可在專案根目錄使用下列指令啟動開發服務。`PORT=3001` 會讓前後端整合服務監聽在 3001 連接埠。
51:PORT=3001 pnpm dev
54:服務啟動後，請在瀏覽器開啟：
62:## 四、正式建置與啟動
67:pnpm build
70:本專案的正式建置流程包含兩段：第一段使用 Vite 產生前端輸出，第二段使用 esbuild 將 `server/_core/index.ts` 以 Node 平台與 ESM 格式打包。esbuild 的 `--packages=external` 用於保留外部依賴，避免將不適合 bundle 的套件硬打進後端輸出。[3]
72:建置完成後，可使用：
75:PORT=3001 pnpm start
78:若只想單獨驗證前端與後端打包，可執行：
81:pnpm exec vite build --config vite.config.ts
82:pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outfile=/tmp/server_bundle_check.js
85:## 五、功能驗證清單
87:新環境啟動後，建議先依下表確認核心功能。這些項目是本次交付已驗證的重點，也是後續繼續開發前最適合做 smoke test 的範圍。
89:| 驗證項目 | 操作方式 | 預期結果 |
98:| 技術指標面板 | 點擊 `指標` | 顯示 Order Flow / OI、VWAP / TPO、趨勢線與關鍵水位 |
103:後續若要新增功能，請優先理解 `Dashboard.tsx` 如何掛載各個面板，以及 `server/routers.ts` 如何組合前端需要的 snapshot。專案的資料流大致是後端取得 Binance 與衍生資料，經 `server/analysis.ts` 產生多時間框架、指標、SMC、PA、纏論與策略分析，再透過 tRPC 提供給 React 面板。
110:| `client/src/components/panels/IndicatorsPanel.tsx` | 技術指標面板 | 新增 VWAP、TPO、CVD、OI/Funding 類卡片時改此檔 |
112:| `server/routers.ts` | tRPC API 路由 | 新增前端 API、snapshot 欄位或 fallback 行為時改此檔 |
113:| `server/analysis.ts` | 指標與策略計算核心 | 新增或修正分析規則時改此檔 |
116:| `verification_notes_pa_chan.md` | PA / 纏論驗證筆記 | 排查入口或面板載入問題時可參考 |
120:後續若繼續開發，建議採用「先後端型別、再資料來源、再 UI 呈現、最後驗證」的順序。新增任何 dashboard 欄位時，先修改 `shared/cryptoTypes.ts`，再於 `server/analysis.ts` 或 `server/routers.ts` 產出資料，最後才調整前端面板。這樣可以降低前端讀取不存在欄位而造成 runtime error 的風險。
125:| 高 | 為 snapshot API 加入固定樣本測試 | 可避免日後新增欄位時破壞前端面板 |
126:| 中 | 清理舊回測、掃描或 archive 腳本中的 TypeScript 型別問題 | 可讓 `pnpm check` 成為真正可靠的全專案品質門檻 |
132:如果 `pnpm install` 失敗，請先確認 Node.js 與 pnpm 版本，並刪除舊的 `node_modules` 後重新安裝。如果 `PORT=3001 pnpm dev` 啟動失敗，請檢查 3001 連接埠是否已被占用；若已被占用，可改用其他 PORT。若頁面顯示資料為 `---`，通常代表行情 API 暫時未回應或網路受限，請先確認伺服器是否能連接 Binance 與外部資料來源。
138:# 改用其他連接埠啟動
139:PORT=3002 pnpm dev
141:# 重新安裝依賴
143:pnpm install
146:若 `pnpm check` 回報 TypeScript 錯誤，請先判斷錯誤是否來自本次 Dashboard 主線檔案。當前已知舊回測、掃描或 archive 腳本可能仍有歷史型別問題；這些問題不影響本次已通過的 Vite 前端建置、esbuild 後端 bundle 與瀏覽器預覽驗證。
150:目前最重要的交接結論是：**PA 與纏論已完成桌面與手機獨立入口掛載，並已通過前端建置、後端 bundle、桌面瀏覽器點擊與手機 viewport 自動化驗證**。若新環境需要繼續擴充，請先完成本文件第五節的 smoke test，再依第六節的資料流逐步修改。
155:[2]: https://pnpm.io/cli/install "pnpm install Documentation"  
156:[3]: https://esbuild.github.io/api/#bundle "esbuild Bundle API"
158:## 技術指標四時區並排比較表
160:最新版本已在 `client/src/components/panels/IndicatorsPanel.tsx` 新增 `IndicatorComparisonMatrix`。此元件將 `snap.mtf_indicators` 中的 `4h`、`1h`、`15m` 與 `5m` 轉為 `指標 × 時區` 的比較矩陣，方便快速對照趨勢、動量、RSI、MACD 柱、ADX、+DI/-DI、EMA20、EMA50、EMA200、VWAP、CVD、布林 %B 與 ATR。
162:若要在新環境確認此功能，請啟動 Dashboard 後點擊右側 `指標` 分頁，確認出現標題為「四時區並排比較」的表格，表頭應包含 `指標`、`4H`、`1H`、`15m` 與 `5M`。手機或窄版右側欄位下，表格會保留橫向捲動，避免四個時間框架被壓縮到難以閱讀。

## 明確計數複核

使用 Python 直接讀取 TAR 與 ZIP 目錄後，得到下列結果：兩種壓縮包均包含 1100 個條目，`node_modules`、`.git`、`.env`、`.npmrc` 均為 0。壓縮包包含 `dist` 453 個條目，表示目前交付包包含已建置的靜態產物；這對新環境快速啟動正式服務有利，但若只想交付原始碼，可在下一版排除 `dist` 並要求接手者自行執行 `pnpm build`。

另外，壓縮包中仍包含 4 個 `.log` 檔：`dev_server.log` 與 `reports/nurse_neil_*.log`。它們不是環境密鑰，但屬於本機執行紀錄；若交付對象需要最小乾淨包，建議下一次打包時排除 `*.log`。
