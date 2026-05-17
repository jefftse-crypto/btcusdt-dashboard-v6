# Mobile/SMC 預覽驗證筆記

時間：2026-05-15 00:00 左右

最新預覽連結 `https://3001-i9vjsevx18s7o46emsfts-0298e436.sg1.manus.computer/` 可載入主頁。右側桌面導覽已可看到 `策略中心 / 技術指標 / SMC / 市場情報`，但點擊 SMC 後出現 React runtime error：

```text
TypeError: Cannot read properties of null (reading 'useContext')
    at exports.useContext (...chunk-HTUTOXL4.js...)
    at useDirection (...chunk-7KOIX3N3.js...)
    at Tabs (...@radix-ui_react-tabs.js...)
```

判斷：新增的 `SmcPanel` 入口載入時觸發 Radix Tabs 的 `useDirection/useContext` 錯誤，需檢查 `SmcPanel.tsx` 是否引入 Tabs 或造成 React/Radix context 不一致，並以無 Radix Tabs 的安全包裝或修正 import 方式處理。

## SMC Tabs 修復後驗證

重新載入 `3001` 預覽頁後，原先的 `useContext` runtime error 已消失，主頁可正常載入，右側面板顯示 `策略中心 / 技術指標 / SMC / 市場情報` 四個入口。接下來需點擊 `SMC` 與 `技術指標` 確認內容面板可正常切換。

## SMC 與技術指標入口驗證

點擊右側 `SMC` 分頁後，SMC/ICT 三重確認模型已正常顯示，包含做多確認、做空確認、Premium/Discount、流動性、OTE 與 CHoCH 條件，未再出現 runtime error。

點擊右側 `技術指標` 分頁後，技術指標面板已正常顯示，包含整體趨勢、動量、RSI、MACD、布林帶，以及 4H / 1H / 15m / 5M 多時間框架指標。因此新增入口可正常訪問。


## 2026-05-15 技術指標面板補強驗證

已在最新 3001 預覽服務中打開「技術指標」分頁並完成瀏覽器驗證。畫面已正常顯示新增的三組核心卡片：`Order Flow / OI`、`VWAP / TPO`、`趨勢線 / 關鍵水位`。其中 `Order Flow / OI` 已顯示 CVD 變化、CVD 累積、Open Interest、Funding 與 Long/Short；`VWAP / TPO` 已顯示 VWAP、TPO POC、TPO VAH、TPO VAL 與目前價格位置；`趨勢線 / 關鍵水位` 已顯示趨勢線偏向、支撐線 / SSL、壓力線 / BSL、近期 Swing High 與近期 Swing Low。

多時間框架指標欄也已顯示 4H、1H、15m、5M 的 RSI、MACD、ADX、EMA、布林帶、VWAP、CVD、Stoch、ATR 與動量狀態。前端 Vite build 與後端 esbuild bundle 均已通過。
