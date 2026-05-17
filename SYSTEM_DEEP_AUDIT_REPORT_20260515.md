# BTCUSDT Dashboard v6 全系統深度健康檢查報告

檢查日期：2026-05-15  
檢查範圍：`/home/ubuntu/btcusdt_dashboard_v6` 目前工作樹、最新本地預覽服務、主要 tRPC/REST 端點、桌面與行動版 UI、最新交付壓縮包，以及新環境續作文件。

## 一、總體結論

本輪深度檢查的結論是：**目前 Dashboard 主線功能可以正常啟動、建置、載入與操作，PA、纏論、SMC、技術指標四時區並排比較等主要面板在瀏覽器端未出現白屏或 React 崩潰；最新交付包也已排除 `node_modules`、`.git`、`.env` 與 `.npmrc` 等高風險內容。** 這代表目前版本可作為可預覽、可交接、可繼續開發的工作版本。

但系統仍存在幾類需要處理的問題。最重要的是：**全專案 TypeScript 靜態檢查目前未通過，`pnpm test` 因測試檔案配置問題失敗，依賴稽核存在中高風險漏洞，WebSocket 行情連線處於降級狀態，`chan_mtf.timeframes` 資料為空但前端使用 fallback 顯示，新聞面板在無資料時缺少明確空狀態。** 這些問題不一定阻塞當前預覽，但會影響日後穩定交付、CI 品質門檻與新環境長期維護。

| 檢查面向 | 結論 | 風險等級 | 是否阻塞目前預覽 |
| --- | --- | --- | --- |
| 正式建置 | `pnpm run build` 成功，Vite 前端與 esbuild 後端 bundle 均可產生 | 低 | 否 |
| TypeScript 靜態檢查 | `pnpm run check` 失敗，共 47 個 TS 錯誤 | 高 | 不阻塞預覽，但阻塞嚴格交付 |
| 測試 | `pnpm test` 因 Vitest 未找到測試檔而 exit 1 | 中 | 否 |
| 依賴安全 | `pnpm audit --audit-level moderate` 失敗，摘要為 24 個漏洞，其中 6 high | 高 | 不阻塞預覽，但阻塞安全交付 |
| 後端健康檢查 | `/health` 與 `/api/health` 回 200 | 低 | 否 |
| WebSocket 行情 | 健康檢查顯示 `market_data_connected:false`、provider 為 `kraken_polling` | 中 | 否，屬降級狀態 |
| tRPC 資料流 | 核心查詢如 `crypto.getSnapshot`、news、tweets、screener、heatmap 可回應 | 低至中 | 否 |
| UI 桌面版 | 指標、SMC、PA、纏論、新聞入口可點擊；無 console error | 低至中 | 否 |
| UI 行動版 | 底部導覽可見，主要入口未被最新修改破壞 | 低 | 否 |
| 打包內容 | 敏感檔與依賴未打入；但包含 `.log`、`.bak` 與 `dist` | 中 | 否 |
| 新環境文件 | 有完整續作指南，但部分範例檔名與舊描述可再同步 | 低至中 | 否 |

## 二、已確認正常的部分

專案目前規模約為前端 111 個檔案、後端 116 個檔案、共享型別 5 個檔案，源碼行數約為前端 26,843 行、後端 37,186 行、共享 1,059 行。這是一個已累積多個分析模組、回測腳本與實驗策略的中大型儀表板專案，因此檢查時我把「當前 Dashboard 主線可用性」與「歷史腳本/研究腳本品質債」分開判斷。

正式建置結果是正面的。`package.json` 中的 `build` 腳本為 `vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`，本輪執行結果 exit code 為 0，表示前端靜態產物與後端 bundle 都能生成。瀏覽器預覽也可以正常開啟，初始載入後能看到 BTCUSDT 價格、主圖表、底部回測區與右側策略/分析面板。

| 已驗證項目 | 驗證結果 |
| --- | --- |
| 桌面 Dashboard 首頁 | 可正常載入，無白屏 |
| 右側「指標」分頁 | 新增的 **4H / 1H / 15m / 5M 四時區並排比較表**可正常顯示 |
| 右側「SMC」分頁 | 可顯示結構、Premium/Discount、確認模型與多空確認資訊 |
| 右側「PA」分頁 | 可顯示多時間框架共識、4H/1H/15m/5m 卡片與 PA 子分頁 |
| 右側「纏論」分頁 | 可顯示摘要、4H/1H/15M/5M 子分頁與趨勢共識，未崩潰 |
| 右側「新聞」分頁 | 可切換到面板，未白屏；但空狀態提示不足 |
| 瀏覽器控制台 | 未捕捉到 console error、React crash 或顯著警告 |
| 行動版導覽 | 390×844 viewport 下底部導覽可見，包含圖表、指標、SMC、PA、監控、策略 |
| 交付包敏感檔 | TAR 與 ZIP 內 `node_modules`、`.git`、`.env`、`.npmrc` 計數均為 0 |

## 三、主要問題與風險分級

### 1. 高風險：`pnpm run check` 未通過，靜態型別品質門檻目前不可用

`pnpm run check` 的 exit code 為 2，總計偵測到 47 個 TypeScript 錯誤。錯誤主要分布在歷史回測、掃描與 live strategy 腳本，例如 `server/run_v4_five_strategy_live.ts`、`server/backtest_expanded_sweep.ts`、`server/verify_presets_backtest.ts` 等。不過需要特別注意的是，**最新修改過的 `client/src/components/panels/IndicatorsPanel.tsx` 也出現 1 個 TS2802 錯誤**。

目前第一個錯誤是：`client/src/components/panels/IndicatorsPanel.tsx(104,27): error TS2802: Type 'Set<number>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.` 觸發位置為 `const selectedIdx = [...selected].sort((a, b) => a - b);`。雖然 `pnpm run build` 成功，因為 Vite/esbuild 打包流程不等同完整 `tsc --noEmit` 型別門檻，但這個錯誤代表嚴格 CI 或新環境執行 `pnpm run check` 時會失敗。

| 錯誤代碼 | 數量 | 主要含義 | 建議處理 |
| --- | ---: | --- | --- |
| TS2459 | 15 | 匯入了未匯出的成員，常見於腳本與工具模組 API 漂移 | 清理舊腳本匯入或補正式 export |
| TS2802 | 14 | `Set`/迭代器展開與 target/downlevelIteration 不一致 | 改用 `Array.from(set)` 或調整 tsconfig |
| TS2554 | 5 | 函式參數數量不符 | 對齊函式簽名與呼叫點 |
| TS2783 | 5 | 物件屬性重複指定 | 移除重複 spread/覆寫 |
| TS2305 | 3 | 模組沒有匯出的成員 | 修正 export/import |
| 其他 | 5 | 欄位不存在、型別不相容、未宣告名稱等 | 逐檔修復 |

建議先做一個小修：把 `IndicatorsPanel.tsx` 第 104 行改為 `Array.from(selected).sort((a, b) => a - b)`，這是低風險且直接針對本次新增比較表的修正。然後再決定是否把歷史回測/掃描腳本排除在主線 `tsconfig` 之外，或逐一修復這些腳本，避免 `pnpm run check` 長期失去品質門檻意義。

### 2. 高風險：依賴稽核存在中高風險漏洞

`pnpm audit --audit-level moderate` exit code 為 1，摘要顯示共 24 個漏洞，靜態摘要為 `1 low | 17 moderate | 6 high`。後續抽取到涉及套件包含 `axios`、`drizzle-orm`、`esbuild`、`fast-xml-builder`、`fast-xml-parser`、`mermaid`、`uuid`、`vite` 等，其中 high 風險包含 `axios` 相關 advisory。

| 風險 | 觀察 | 建議 |
| --- | --- | --- |
| 中高 | `axios@1.15.0` 出現在 advisory 中，patched version 顯示至少需 `>=1.15.1` | 優先升級 axios 並重新跑 build/audit |
| 中 | `vite`、`esbuild`、XML parser、mermaid 等也出現在稽核結果中 | 依 lockfile 逐項升級，避免一次大幅破壞相容性 |
| 交付 | 目前交付包不含 `node_modules`，所以漏洞不會以依賴實體直接打包；但新環境 `pnpm install` 後仍會安裝 lockfile 指定版本 | 安全交付前應更新 lockfile 並重新稽核 |

這類問題不會立即導致預覽頁白屏，但如果 Dashboard 要部署到公開環境或長期運行，就應該列為高優先級修復。

### 3. 中風險：`pnpm test` 目前不是有效的測試門檻

`pnpm test` exit code 為 1，Vitest 輸出顯示在 `/home/ubuntu/btcusdt_dashboard_v6/client` 下未找到測試檔案。這不代表所有邏輯都壞掉，而是代表目前測試腳本的工作目錄或測試檔案配置與專案實際位置不匹配。由於後端存在多個 `*.test.ts` 檔案，這可能是 Vitest root/include 配置造成的問題。

建議把測試分為兩層：第一層是 Dashboard 主線 smoke test，例如 snapshot schema、核心 tRPC 回應、主要面板渲染；第二層才是歷史策略與回測腳本測試。如此可避免一個實驗腳本失效就讓整個主線品質狀態不清楚。

### 4. 中風險：WebSocket 即時行情目前處於降級狀態

`/health` 與 `/api/health` 都回 200，代表服務本身健康；但回應中 `ws.market_data_connected` 為 `false`，provider 顯示為 `kraken_polling`，`last_update_ts` 為 `null`。這代表 WebSocket/行情推送不是完全連上的「live streaming」狀態，而更接近降級或輪詢狀態。

前端 hook 已經有 connected、fallback、disconnected、error 等狀態設計，因此這不是崩潰級問題。但對交易儀表板而言，即時行情延遲或無推送可能影響使用者判斷。建議在 UI 上明確顯示「行情源：輪詢/降級/最後更新時間」，不要只顯示價格，避免使用者誤判為即時資料。

### 5. 中風險：`chan_mtf.timeframes` 為空，但前端用 fallback 顯示纏論資料

核心 snapshot 結構完整度檢查顯示：`mtf_indicators` 有 `15m`、`1h`、`4h`、`5m` 四個時間框架，`pa` 也有這四個時間框架；但 `chan_mtf.timeframes` 是空陣列。瀏覽器端纏論面板仍能顯示 4H/1H/15M/5M 摘要，原因是前端使用既有快照或 PA 內的舊版纏論資料 fallback。

這是「使用者目前看得到內容」但「資料契約不乾淨」的問題。短期不阻塞，但長期會讓開發者很難判斷纏論資料到底應該從 `chan_mtf`、`pa`、還是 legacy 欄位取得。建議把纏論資料來源標準化：要嘛讓後端填滿 `chan_mtf.timeframes`，要嘛移除或標註 `chan_mtf`，避免前端長期依賴隱性 fallback。

### 6. 中低風險：新聞面板無資料時缺少明確空狀態

桌面瀏覽器切到新聞分頁後，能看到「最新資訊」標題，但當下沒有新聞條目，也沒有清楚的「目前無資料 / 資料源未配置 / 請稍後重試」提示。API 探測中 `news.getLatestNews` 可回應資料，但 UI 當下空白可能與查詢參數、載入狀態或過濾狀態有關。

這不是程式崩潰，但會讓使用者誤以為面板壞掉。建議新增明確空狀態與重新整理按鈕，並把最後查詢時間與資料來源狀態顯示出來。

### 7. 中低風險：四時區比較表在窄欄需要橫向捲動，PA 卡片在右側窄欄偏擁擠

目前新做的四時區比較表功能是可用的，但在桌面右側窄欄內，表格會橫向延伸，需要水平捲動才能完整比較。這是四欄並排比較的自然代價，不是錯誤；但若追求交易時快速閱讀，建議提供「全寬模式」、「彈出比較視窗」或「固定指標欄 + 可滑動時區欄」。PA 面板的多時間框架卡片在右側欄中也偏窄，建議未來做成雙層布局或支援全屏面板。

### 8. 中低風險：交付包乾淨度仍可改善

最新 ZIP/TAR 都未包含 `node_modules`、`.git`、`.env`、`.npmrc`，這是正確的。但包內仍包含 `dist`、`dev_server.log`、`reports/nurse_neil_*.log` 以及 `Dashboard.tsx.bak`。其中 `dist` 可接受，因為它讓新環境可快速使用已建置產物；但 `.log` 與 `.bak` 更像本機工作痕跡，若要交付乾淨正式版本，建議下一版排除 `*.log`、`*.bak`、`.manus-logs`、`system_audit_*` 中不需交付的臨時檔。

| 打包項目 | 結果 | 判斷 |
| --- | --- | --- |
| TAR 條目數 | 1100 | 正常 |
| ZIP 條目數 | 1100 | 正常 |
| `node_modules` | 0 | 正確排除 |
| `.git` | 0 | 正確排除 |
| `.env` / `.npmrc` | 0 | 正確排除 |
| `dist` | 453 條目 | 可接受，但視交付策略決定是否保留 |
| `.log` | 4 個 | 建議正式包排除 |
| `.bak` | 至少包含 `Dashboard.tsx.bak` | 建議正式包排除 |

### 9. 低至中風險：新環境指南有少量舊描述需要同步

`NEW_ENVIRONMENT_CONTINUATION_GUIDE.md` 整體可用，已包含環境、安裝、啟動、建置與驗證流程。不過其中範例壓縮包檔名仍使用較舊的 `btcusdt_dashboard_v6_release_20260515.tar.gz`，實際最新交付檔名是 `btcusdt_dashboard_v6_release_20260515_indicator_comparison.*`。此外功能驗證表中對「技術指標面板」仍有一段舊描述，但文件後段已補充最新四時區比較表。建議下一版統一這些描述，避免接手者混淆。

## 四、API 與資料流檢查結論

健康檢查端點 `/health` 與 `/api/health` 回 200，回應包含 `status`、`uptime`、`timestamp`、`version`、`model`、`ws` 等欄位。這表示 Express/tRPC 整合服務可啟動，且健康檢查路由可用。

REST 探測中 `/api/latest-live-snapshot` 與 `/api/diagnostics-summary` 回 404。這不一定是故障，較可能是舊路徑或不存在的 legacy endpoint；目前前端主線主要使用 `/api/trpc/*`。tRPC 初次用 POST 探測時回 405，是因為測試方式與目前查詢端點可接受方法不一致；改用 GET 格式後，核心 tRPC 查詢可回應。

| 端點/程序 | 結果 | 解讀 |
| --- | --- | --- |
| `/health` | 200 | 服務健康，但行情 WebSocket 降級 |
| `/api/health` | 200 | 同上 |
| `/api/latest-live-snapshot` | 404 | 可能為舊 REST 路徑，非主線端點 |
| `/api/diagnostics-summary` | 404 | 可能為舊 REST 路徑，非主線端點 |
| `crypto.getSnapshot` | 200，約 263KB | 核心 Dashboard snapshot 可取得 |
| `crypto.getKlines` | 初次 400，修正 timeframe 後可回應 | 原探測參數與 schema 不一致，不代表資料流壞掉 |
| `news.getLatestNews` | 200，約 8 秒 | 可回應，但耗時偏長，UI 需清楚 loading/empty state |
| `tweets.getLatestTweets` | 200，回空陣列 | 可接受，前端需顯示空狀態 |
| `screener.scanAll` | 200 | 掃描資料流可回應 |
| `heatmap.getMarketOverview` | 200 | 市場總覽資料流可回應 |

核心 snapshot 目前 top-level keys 包含 `advanced`、`chan_mtf`、`consensus`、`forecast_4h`、`indicators`、`klines`、`mtf_indicators`、`onchain`、`pa`、`smc`、`strategy` 等。`mtf_indicators` 與 `pa` 的四時區資料是齊的，這支持指標並排比較與 PA 面板目前可用。

## 五、建議修正優先級

以下是我建議的修正順序。這個順序不是以修改難度排列，而是以「對交付可信度與未來維護的影響」排序。

| 優先級 | 問題 | 建議動作 | 預期效果 |
| --- | --- | --- | --- |
| P0 | 最新 `IndicatorsPanel.tsx` 造成 1 個 TS2802 | 把 `[...selected]` 改為 `Array.from(selected)`，重新跑 `pnpm run check` | 消除本次新增功能帶來的型別問題 |
| P0 | 依賴 high vulnerabilities | 升級 `axios` 至 patched version，逐項升級 `vite/esbuild/xml parser` 等，更新 lockfile | 降低部署安全風險 |
| P1 | 全專案 TypeScript 47 個錯誤 | 將主線 Dashboard 與歷史研究腳本分 tsconfig；或逐步修復腳本 | 讓 `pnpm run check` 重新成為可信品質門檻 |
| P1 | 測試腳本找不到測試檔 | 修正 Vitest root/include，建立 smoke tests | 讓 `pnpm test` 能反映實際品質 |
| P1 | WebSocket market data disconnected | 檢查資料源連線、fallback 標示與最後更新時間 | 避免使用者誤判行情即時性 |
| P1 | `chan_mtf.timeframes` 空但 UI fallback | 統一纏論資料來源，後端填滿 `chan_mtf` 或明確標註 legacy 欄位 | 降低資料契約風險 |
| P2 | 新聞面板無資料時提示不足 | 增加 loading、empty、error、refresh 狀態 | 改善 UX 與可診斷性 |
| P2 | 窄欄表格/PA 卡片擁擠 | 增加全寬模式、彈窗或更好的 responsive layout | 提升比較效率 |
| P2 | 交付包含 `.log`、`.bak` | 下一次打包排除本機痕跡 | 提升正式交付乾淨度 |
| P3 | 續作指南少量舊檔名/舊描述 | 更新實際檔名與技術指標描述 | 降低新環境接手混淆 |

## 六、是否可以繼續在新環境工作

可以。新環境接手的基本流程仍然成立：解壓最新 `btcusdt_dashboard_v6_release_20260515_indicator_comparison.*`，執行 `pnpm install`，再用 `PORT=3001 pnpm dev` 啟動開發服務，或執行 `pnpm run build` 後用 `PORT=3001 pnpm start` 啟動正式服務。由於交付包包含 `pnpm-lock.yaml` 與 `dist`，接手者可重現依賴並檢查既有建置產物。

但我建議新環境開始續作前先做三個確認：第一，先跑 `pnpm run build`，確保平台相容；第二，打開 Dashboard 點擊「指標 / SMC / PA / 纏論 / 新聞」做 smoke test；第三，先修掉 `IndicatorsPanel.tsx` 的 TS2802，再決定是否全面處理歷史腳本的 TypeScript 錯誤。若新環境要正式部署，則必須先處理依賴漏洞與 WebSocket 行情降級狀態。

## 七、最終判斷

本系統目前不是「壞掉」狀態，而是處於**主線功能可用、交付包基本可用，但工程品質門檻與安全維護仍需補強**的狀態。若只看交易 Dashboard 的現有預覽，主要面板能載入且沒有前端崩潰；若從正式交付或生產部署角度看，`pnpm run check`、`pnpm test`、`pnpm audit` 三項都還不能給出綠燈，因此不建議在未修復前宣稱為嚴格意義上的 production-ready。

我建議下一步優先執行「小範圍修復包」：修掉 `IndicatorsPanel.tsx` 型別錯誤、更新依賴漏洞、補新聞空狀態、同步續作指南，然後重新跑 `pnpm run build`、`pnpm run check`、瀏覽器 smoke test 與打包。完成後再進一步處理歷史回測/掃描腳本的型別債，讓整個 repo 的品質門檻真正恢復。
