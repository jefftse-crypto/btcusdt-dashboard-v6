# BTCUSDT Dashboard v6 - 最終交付與後續工作說明

本專案已完成深度改良，並整合了多維度的加密貨幣新聞與社群動態來源。

## 🚀 專案狀態與訪問
- **Dashboard 連結**: `https://3001-i1zicsgkb1ko5m6tvbw6o-190eb35f.sg1.manus.computer`
- **主要更新**: 
  - **4H 預測情境**: 重構為真實 4 小時窗口，命中率提升方案實施。
  - **新聞面板升級**: 新增「社群動態」分頁，直接整合 Telegram 公開頻道（WuBlockchain, CoinTelegraph 等）。
  - **多源 RSS**: 整合 10+ 個高品質加密新聞來源。
  - **策略引擎**: 加入市場體制（Trend/Range）過濾、CVD 成交量確認。

## 📦 打包檔案說明
專案已打包為 `btcusdt_dashboard_v6_final_full.tar.gz`，包含：
- `/client`: React 前端原始碼。
- `/server`: Node.js/TypeScript 後端原始碼（含 Telegram 抓取邏輯）。
- `/shared`: 前後端共享型別定義。
- `.env`: 環境變數配置模板。
- `dist/`: 已建置完成的可執行檔案。

## 🛠️ 如何在本地/新環境運行
1. **解壓縮**: `tar -xzf btcusdt_dashboard_v6_final_full.tar.gz`
2. **安裝依賴**: `pnpm install`
3. **配置環境**: 複製 `.env` 並填入您的 `OPENAI_API_KEY`（用於新聞情緒分析與策略總結）。
4. **開發模式**: `pnpm dev`
5. **正式運行**:
   - 建置: `pnpm build`
   - 啟動: `PORT=3001 node dist/index.js`

## 🔮 後續改進空間
1. **Telegram 代理**: 目前直接抓取 `t.me/s/`，在大流量下可能被限流。建議部署時使用代理池或專用的 RSSHub 實例。
2. **AI 代理伺服器**: 目前使用 OpenAI API。若需切換至 Claude-3.5-Sonnet 等模型，只需修改 `server/_core/llm.ts` 中的配置。
3. **資料持久化**: 當前快取儲存在記憶體中，重啟會消失。建議整合 Redis 以維持長期的情緒統計數據。

---
*本系統由 Manus AI 自動化深度改良與部署。*
