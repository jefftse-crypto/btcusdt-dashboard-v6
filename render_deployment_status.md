# Render Deployment Status

截至目前，專案已推送到 GitHub 儲存庫 `jefftse-crypto/btcusdt-dashboard-v6` 的 `render-deploy-v6` 分支。Render 既有服務 `btcusdt-dashboard-v6` 已從原本的 `main` 分支切換為 `render-deploy-v6` 分支，並自動觸發部署。

| 項目 | 狀態 |
| --- | --- |
| GitHub 儲存庫 | `https://github.com/jefftse-crypto/btcusdt-dashboard-v6` |
| 部署分支 | `render-deploy-v6` |
| Render 服務 | `btcusdt-dashboard-v6` |
| Render 服務網址 | `https://btcusdt-dashboard-v6.onrender.com` |
| 目前部署提交 | `6df7a0690f39e014cefcd19afbc211d80b714e58` |
| Render 部署頁面 | `https://dashboard.render.com/web/srv-d83f3cbtqb8s73dm05kg/deploys/dep-d84lc1l7vvec73fbsmgg` |

Render 日誌顯示已成功 clone `render-deploy-v6` 分支、執行 `pnpm install && pnpm run build`，前端與後端建置已出現 `built` 與 `Done` 訊息。Render 已回報 `Build successful`，服務已執行 `node dist/index.js`，並顯示 `Your service is live`。公開網址 `https://btcusdt-dashboard-v6.onrender.com/` 已完成瀏覽器驗證，可載入 Crypto Analyst Dashboard 主介面。日誌與頁面仍顯示 `OAUTH_SERVER_URL` 尚未設定，以及行情來源出現 CryptoCompare 無資料與 CoinGecko HTTP 429 的降級訊息；這些不影響主介面載入，但若需要 OAuth 或穩定行情來源，需後續補齊環境變數或資料源設定。
