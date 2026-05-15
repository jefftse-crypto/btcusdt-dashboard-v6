# PA 與纏論入口驗證筆記

驗證時間：2026-05-15 01:00 GMT+8

## 建置驗證

前端建置指令使用專案根目錄設定檔：

```bash
cd /home/ubuntu/btcusdt_dashboard_v6 && pnpm exec vite build --config vite.config.ts
```

結果：成功，輸出包含 `PaPanel` 與既有面板 chunk，並顯示 `✓ built in 27.65s`。

後端 bundle 驗證需依照 `package.json` 的 build 參數加上外部套件模式：

```bash
cd /home/ubuntu/btcusdt_dashboard_v6 && pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outfile=/tmp/server_bundle_test.js
```

結果：成功，輸出 `/tmp/server_bundle_test.js 463.2kb`，並顯示 `⚡ Done in 27ms`。

## 預覽服務

已重啟 port 3001，服務正常監聽：

```text
Server running on http://localhost:3001/
WebSocket server ready at ws://localhost:3001/ws
```

預覽 URL：<https://3001-i9vjsevx18s7o46emsfts-0298e436.sg1.manus.computer>

## 桌面右側入口驗證

右側分頁列已顯示：`策略 / 指標 / SMC / PA / 纏論 / 新聞`。

點擊 **PA** 分頁後，右側面板成功顯示 `PA 多時間框架共識（Rayner Teo 方法）`、多時間框架卡片、VWAP、支撐阻力等內容。

點擊 **纏論** 分頁後，右側面板成功顯示 `多時段纏論總結`、總結/4H/1H/15M/5M 子分頁、整體趨勢共識與操作建議。

## 手機入口初步驗證

`Dashboard.tsx` 的 `mobileNavItems` 已加入：

```ts
{ id: "pa", icon: <List size={17} />, label: "PA" },
{ id: "chan", icon: <PieChart size={17} />, label: "纏論" },
```

手機條件渲染已加入 `mobileActiveTab === "pa"` 與 `mobileActiveTab === "chan"`，並分別掛載 `PaPanel` 與 `ChanPanel`。已產生行動寬度截圖：

- `/home/ubuntu/btcusdt_dashboard_v6/verification_assets/mobile_dashboard_ready.png`


## 手機底部入口自動化驗證結果

使用 390×844 行動裝置 viewport，透過本機預覽服務 `http://127.0.0.1:3001/` 自動檢查底部導覽與點擊行為。

結果摘要：

| 項目 | 結果 |
| --- | --- |
| 手機底部導覽標籤 | `圖表 / 指標 / SMC / PA / 纏論 / 策略 / 回測 / 新聞` |
| PA 底部入口 | 通過，座標 y=789，位於底部導覽區 |
| 纏論底部入口 | 通過，座標 y=789，位於底部導覽區 |
| 點擊 PA 後內容 | 通過，顯示 `PA 多時間框架共識（Rayner Teo 方法）`、多時間框架、VWAP 與支撐阻力資料 |
| 點擊纏論後內容 | 通過，顯示 `多時段纏論總結`、總結/4H/1H/15M/5M 子分頁、趨勢一致性與操作建議 |

自動化驗證腳本輸出確認：`clickedPa=true`、`paContentVisible=true`、`clickedChan=true`、`chanContentVisible=true`。
