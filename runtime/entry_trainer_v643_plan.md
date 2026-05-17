# Entry Trainer v6.4.3 改良方案

作者：Manus AI

## 設計目標

v6.4.3 的核心目標是讓 AI Entry Trainer 不只會看歷史相似樣本，也能自我檢查是否存在過度擬合。新版會在訓練 metadata 中加入 out-of-sample 驗證，並提供跨策略 regime leaderboard，讓使用者知道目前市場型態下哪一個策略更可靠。

## Out-of-sample 驗證規則

訓練樣本依時間排序後切成 70% 訓練集與 30% 驗證集。系統只用前 70% 樣本計算特徵重要性與近鄰權重，然後逐筆對後 30% 驗證樣本打分。驗證時不使用該筆樣本的未來標籤作為輸入，只把它的特徵拿去和訓練集相似樣本比較，最後統計被模型判定為「小倉以上」的樣本表現。

| 欄位 | 定義 | 用途 |
|---|---|---|
| trainSampleCount | 訓練段樣本數 | 判斷模型學習基礎是否足夠 |
| testSampleCount | 驗證段樣本數 | 判斷 out-of-sample 是否可信 |
| predictedTradeCount | 驗證段中分數達小倉以上的筆數 | 估計模型實際會出手的頻率 |
| oosWinRate | 被選中驗證樣本的已結案勝率 | 檢查模型選訊號能力 |
| oosAvgR | 被選中驗證樣本的平均 R 倍數 | 檢查交易期望值 |
| coverage | predictedTradeCount / testSampleCount | 避免模型過度保守或過度頻繁 |
| edgeScore | 綜合 OOS 勝率、R 倍數與覆蓋率的 0–100 分數 | 前端可讀的泛化品質指標 |
| overfitRisk | 0–100 過度擬合風險 | OOS 表現弱於訓練時會提高 |

## 策略可靠度 leaderboard 規則

後端新增一個跨策略評估函式，對固定策略清單產生樣本、訓練診斷、OOS 驗證與 regime 統計，最後輸出每個策略的 reliabilityScore。分數會偏重 out-of-sample 的勝率與平均 R，而不是單純歷史總勝率。

| 權重來源 | 分數邏輯 |
|---|---|
| OOS edgeScore | 主要來源，代表泛化品質 |
| 訓練品質 | strong 加分，weak/insufficient 扣分 |
| regime 適配 | 若目前 regime 的樣本平均 R 與勝率較佳則加分 |
| 樣本數 | 樣本不足時降權，避免小樣本排名過高 |
| 過度擬合風險 | 風險越高扣分越多 |

## 前端呈現

Entry Trainer 卡片增加「OOS 驗證」區塊，顯示 edgeScore、OOS 勝率、平均 R、覆蓋率與 overfitRisk。另新增「目前 regime 策略可靠度」小排行榜，列出前 5 名策略、分數、OOS 勝率、regime 勝率與建議狀態。
