# V6 数据源与成本来源初步记录

本记录用于 V6 实盘可信度升级阶段，保存目前已确认的外部来源与本地数据缺口。

## 已确认的外部来源

1. Binance 官方公开市场数据站 `data.binance.vision` 存在 USDS-M Futures 的月度 `fundingRate` 目录，路径形式为：`https://data.binance.vision/?prefix=data/futures/um/monthly/fundingRate/`。页面列出按交易对分目录的资金费率历史数据，例如 `BTCUSDT/`、`ETHUSDT/`、`SOLUSDT/` 等可用于补充 V6 资金费率成本模型。
2. Binance 官方 USDS-M Futures 费率页路径为 `https://www.binance.com/en/fee/futureFee`。浏览器当前环境未能抽取正文内容，后续可用该页面或 Binance 支持文档作为手续费参数来源；在回测中应以可配置参数方式实现 maker/taker 手续费，避免硬编码单一费率。

## 本地数据现状

项目本地已经有 `data/binance_um_15m_1y_multi/` 下的 Binance USDS-M 15m K 线真实行情数据，覆盖多个主流交易对，并已有 V3/V4/V5 回测结果。当前本地没有发现资金费率、Open Interest、taker buy/sell、long-short ratio、premium index 等衍生品辅助数据文件。

## V6 数据缺口

V6 若要提高实盘可信度，应优先补齐：资金费率、真实手续费参数、滑点/冲击成本模型、严格样本外窗口、订单成交假设、停机/漏信号容错，以及纸交易日志格式。
