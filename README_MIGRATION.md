# Crypto Analyst Dashboard - 專案遷移與開發指南

本文件旨在提供將 `btcusdt_dashboard_v6` 專案遷移至新環境，並能順利接續開發與運行的詳細指引。

## 1. 專案概述

`btcusdt_dashboard_v6` 是一個加密貨幣技術分析儀表板，整合了多種交易策略、回測功能，並特別強化了 AI 驅動的 Entry Trainer。最新版本加入了以下核心功能：

*   **AI Entry Trainer (v6.4.2)**：透過加權近鄰模型，提供進場分數、方向、信心、TP/SL 建議，並納入訓練品質、動態門檻、市場 Regime 與特徵重要性分析。
*   **OOS 泛化驗證 (v6.4.3)**：引入 Out-of-Sample (OOS) 驗證機制，評估模型在未見數據上的泛化能力，提供 OOS 勝率、平均 R、過擬合風險等指標。
*   **策略可靠度排行榜 (v6.4.3)**：根據當前市場 Regime，對不同策略進行可靠度評分與排名，幫助用戶選擇最適合當前環境的策略。
*   **自動 Forward Test (Paper Trading)**：實現自動化的紙上交易模擬，定期記錄 Entry Trainer 訊號的開倉、結案與績效統計，但不執行真實下單。

## 2. 環境要求

請確保您的新環境已安裝以下軟體：

*   **Node.js**: v20.x 或更高版本 (建議使用 `nvm` 管理版本)
*   **pnpm**: v8.x 或更高版本 (用於套件管理)
*   **Python**: v3.11 或更高版本 (用於自動化腳本與 AI 相關處理)
*   **git**: (用於版本控制，如果專案是透過 git 複製)

## 3. 專案設置

1.  **取得專案程式碼**：
    *   如果專案是透過 `git clone` 取得：
        ```bash
        git clone <repository_url> btcusdt_dashboard_v6
        cd btcusdt_dashboard_v6
        ```
    *   如果專案是透過壓縮包取得，請解壓縮至 `btcusdt_dashboard_v6` 目錄：
        ```bash
        unzip btcusdt_dashboard_v6.zip
        cd btcusdt_dashboard_v6
        ```

2.  **安裝依賴套件**：
    ```bash
    pnpm install
    ```

3.  **設定環境變數**：
    專案在生產環境下運行需要設定 `NODE_ENV=production`。您可以在啟動命令中直接設定，或建立 `.env` 檔案。
    ```bash
    # .env 檔案範例 (在專案根目錄)
    NODE_ENV=production
    # 如果有其他 API Key 或敏感資訊，也應在此設定
    # 例如：OAUTH_SERVER_URL=...
    ```

## 4. 運行應用程式

1.  **建置前端與後端程式碼**：
    ```bash
    pnpm build
    ```
    這會將 TypeScript 程式碼編譯為 JavaScript，並打包前端靜態資源至 `dist/public`。

2.  **啟動伺服器**：
    ```bash
    NODE_ENV=production node dist/index.js
    ```
    伺服器預設會監聽 `http://localhost:3001/`。如果 3001 埠被佔用，會自動切換至 3002 埠。

3.  **訪問儀表板**：
    在瀏覽器中打開 `http://localhost:3001/` (或實際監聽的埠號)。

## 5. 關鍵檔案與數據

以下是專案中幾個重要的檔案與目錄，對於理解和接續工作至關重要：

*   `server/entryTrainer.ts`: AI Entry Trainer 的核心邏輯，包含模型訓練、評分、OOS 驗證與策略可靠度計算。
*   `server/entryForwardTester.ts`: 自動 Forward Test (紙上交易) 的實作，負責模擬交易的開倉、結案與績效統計。
*   `client/src/components/panels/AIPredictionPanel.tsx`: 前端 AI 預測面板的 UI 程式碼，顯示 Entry Trainer 的各項指標、策略排行榜與 Forward Test 統計。
*   `server/routers.ts`: tRPC 後端路由定義，包含所有前端調用的 API 接口。
*   `runtime/entry_trainer_v642_plan.md`, `runtime/entry_trainer_v643_plan.md`, `runtime/entry_forward_test_plan.md`: 這些是開發過程中的設計筆記，詳細記錄了各項功能的設計思路、考量與實現細節。
*   `runtime/entry_forward_test_state.json`: Forward Test 的紙上交易狀態數據，包含所有模擬交易的紀錄。**此檔案會隨時間自動更新。**
*   `runtime/models/`: 存放訓練好的 AI 模型檔案。這些模型會根據需要自動訓練和更新。

## 6. 繼續開發

1.  **開發模式啟動**：
    ```bash
    pnpm dev
    ```
    這會啟動一個開發伺服器，支援熱重載，方便開發調試。

2.  **TypeScript 類型檢查**：
    ```bash
    pnpm check
    ```
    在提交程式碼前，建議運行此命令以確保沒有類型錯誤。

3.  **程式碼格式化**：
    ```bash
    pnpm format
    ```
    保持程式碼風格一致性。

## 7. AI Entry Trainer 使用注意事項

*   **紙上交易 (Paper Trading)**：Forward Test 僅為模擬交易，**不會執行任何真實的下單操作**。其目的是為了在實盤前驗證策略的有效性。
*   **OOS 驗證**：OOS (Out-of-Sample) 驗證結果 (如 `fragile`) 應作為重要參考。即使歷史回測表現良好，如果 OOS 驗證結果不佳，也應謹慎使用。
*   **策略可靠度**：策略排行榜會根據當前市場 Regime 動態調整。建議優先考慮「優先」或「可觀察」的策略，並結合 OOS 驗證結果進行判斷。
*   **實戰建議**：在實際交易中，建議先從小倉位開始，並進行至少 30-50 筆的 Forward Test 觀察，確保策略在真實市場環境下的表現符合預期。同時，密切關注 Entry Score、OOS 指標和策略推薦，避免在指標不佳時盲目進場。

## 8. 故障排除

*   **埠號衝突**：如果 3001 埠被佔用，伺服器會自動切換到 3002 埠。請檢查啟動日誌確認實際監聽埠號。
*   **依賴問題**：如果 `pnpm install` 失敗，請檢查 Node.js 和 pnpm 版本是否符合要求，並嘗試清除緩存 (`pnpm store prune && pnpm install`)。
*   **AI 模型訓練問題**：如果 Entry Trainer 顯示「首訓中」或訓練失敗，請檢查伺服器日誌是否有相關錯誤訊息。確保 `runtime/models/` 目錄有寫入權限。

--- 

**作者**: Manus AI
**日期**: 2026年5月17日

[1]: https://nodejs.org/en/download/  "Node.js 官方網站"
[2]: https://pnpm.io/installation "pnpm 安裝指南"
[3]: https://git-scm.com/downloads "Git 官方網站"
