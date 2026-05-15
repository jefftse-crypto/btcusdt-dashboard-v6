# Nurse Neil 理論回測專案遷移與續作指南

本指南旨在協助您將 Nurse Neil 理論回測專案遷移至新的開發環境，並能順利進行後續的分析與回測工作。

## 1. 環境設定

本專案主要使用 Python 進行數據處理與回測，並依賴 `pandas`, `numpy`, `matplotlib`, `scipy` 等科學計算庫。此外，部分分析服務以 TypeScript 編寫。

### 1.1 Python 環境

建議使用 `python3.11` 或更高版本。您可以使用 `pip` 或 `uv pip` 安裝所需的 Python 依賴：

```bash
cd /home/ubuntu/btcusdt_dashboard_v6
sudo uv pip install --system pandas numpy matplotlib scipy
```

### 1.2 Node.js/TypeScript 環境 (選用)

如果您需要修改或使用 TypeScript 編寫的分析服務（例如 `nurseNeilSignalScorer.ts`），則需要安裝 Node.js 和 pnpm：

```bash
sudo apt update
sudo apt install -y nodejs npm
sudo npm install -g pnpm
cd /home/ubuntu/btcusdt_dashboard_v6
pnpm install
```

## 2. 專案結構

打包後的專案將包含以下主要目錄與檔案：

```
btcusdt_dashboard_v6/
├── data/                       # 存放 Binance 15m K 線歷史數據
│   └── binance_futures_15m/    # 各幣種的 15m K 線 CSV 檔案
├── reports/                    # 存放所有回測報告、圖表、CSV 數據與腳本
│   ├── backtest_nurse_neil_theory_universe.py  # Nurse Neil 理論批量回測腳本
│   ├── nurse_neil_theory_universe_equity.png   # 累積收益圖
│   ├── nurse_neil_theory_universe_run.log      # 腳本執行日誌
│   ├── nurse_neil_theory_universe_summary.json # 回測摘要 JSON
│   ├── nurse_neil_theory_universe_trades.csv   # 逐筆交易明細
│   ├── nurse_neil_theory_universe_thresholds.csv # 門檻敏感度分析結果
│   ├── nurse_neil_theory_universe_by_symbol.csv  # 分幣種回測結果
│   ├── nurse_neil_migration_guide.md           # 本指南
│   └── ... (其他報告與圖表)
└── server/                     # 存放 TypeScript 分析服務
    └── services/
        └── nurseNeilSignalScorer.ts # Nurse Neil 訊號評分服務
```

## 3. 數據準備

本專案的回測依賴於 Binance 期貨的 15m K 線數據。這些數據預期存放在 `data/binance_futures_15m/` 目錄下，每個幣種一個 CSV 檔案，例如 `BTCUSDT.csv`。如果您的新環境沒有這些數據，您需要自行下載或生成。

## 4. 執行回測

要執行 Nurse Neil 理論的多幣種批量回測，請在專案根目錄下執行以下命令：

```bash
cd /home/ubuntu/btcusdt_dashboard_v6
python3.11 reports/backtest_nurse_neil_theory_universe.py
```

腳本執行完成後，所有結果（包括報告、圖表、CSV 數據）將會生成在 `reports/` 目錄下。

## 5. 接入 V6 分析系統 (選用)

如果您希望將 Nurse Neil 訊號評分服務 (`nurseNeilSignalScorer.ts`) 整合到 V6 分析系統中，請參考 `server/services/signalQualityFilter.ts` 的實現方式，將 `nurseNeilSignalScorer.ts` 引入並在適當的流程中調用其評分邏輯。

## 6. 後續工作

在完成基本回測後，您可以進一步：

- **參數優化**：調整 `backtest_nurse_neil_theory_universe.py` 中的參數，例如止損、止盈、評分門檻等，以尋找更優的績效。
- **成本壓力測試**：將 Nurse Neil 理論回測結果與 V6 的成本壓力測試框架結合，評估在真實交易成本下的績效。
- **紙交易驗證**：將回測表現良好的參數應用於紙交易，進行實時驗證。
- **數據擴展**：獲取更多歷史數據或更多幣種數據，以進行更全面的回測與驗證。

希望這份指南能幫助您順利在新環境中繼續工作！
