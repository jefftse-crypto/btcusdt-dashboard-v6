# BTCUSDT Dashboard V6 完整迁移与新环境续作指南

作者：**Manus AI**  
最后更新：**2026-05-13**  
项目目录：`/home/ubuntu/btcusdt_dashboard_v6`

> 本指南用于把当前 **BTCUSDT Dashboard V6** 项目迁移到新环境，并在新环境继续前端 Dashboard 优化、真实一年数据回测、V3 多币种策略迭代与 V4 后续开发。项目包含前端 React / Vite / TypeScript 代码、后端与回测 TypeScript 脚本、Binance Data Vision 年度回测结果、完整 Markdown 报告、图表与 CSV 交易明细。Binance Data Vision 是 Binance 提供的公开市场数据下载入口，适合用于复现本项目的 K 线数据回测来源。[1]

## 一、迁移包内容概览

当前已准备完整迁移压缩包：`btcusdt_dashboard_v6_unified_suite.zip`。该压缩包排除了 `node_modules`、构建输出目录与 `.git` 历史，以减少体积；它保留了源码、配置、回测脚本、历史报告、图表、JSON 结果与 CSV 交易明细。新环境解压后需要重新安装依赖，这是 Node / pnpm 项目迁移时的标准做法。[2] [3]

| 类别 | 关键路径 | 说明 |
|---|---|---|
| 前端 Dashboard | `client/src/components/panels/KlinePanel.tsx`、`client/src/index.css` | 已加入 **CVD、TPO / Market Profile、趋势线**，并完成柔和低饱和配色覆盖。 |
| 后端与服务 | `server/_core/index.ts`、`server/services/*`、`server/utils/*` | 项目服务端、指标计算、策略工具与信号模块。 |
| V1 回测 | `reports/htr_1d_daily_backtest_1y.json`、`reports/htr_1d_daily_backtest_1y_full_report.md` | BTC 单币种 15m 一年数据回测，结果为负期望或低优势。 |
| V2 回测 | `server/backtest_htr_v2_regime.ts`、`reports/htr_v2_regime_backtest_1y.json` | 行情状态分类与趋势 / 震荡双策略切换，最佳配置为 `v2_trend_quality_70`。 |
| V3 回测 | `server/backtest_htr_v3_multisymbol.ts`、`reports/htr_v3_multisymbol_backtest_1y.json` | 4H 定方向、1H 确认状态、15m 触发，多币种每日择优一单。 |
| V3 完整报告 | `reports/htr_v3_multisymbol_backtest_1y_full_report.md` | 已生成完整结论、V1/V2/V3 对比、参数敏感性、币种贡献与后续建议。 |
| V3 图表 | `reports/htr_v3_vs_v2_equity_curve.png`、`reports/htr_v3_config_comparison.png` | 权益曲线与配置对比图。 |
| V3 交易明细 | `reports/htr_v3_best_v3_pool8_quality_trades.csv` | 最佳配置 `v3_pool8_quality` 的逐笔交易明细。 |
| 报告生成脚本 | `reports/build_htr_v3_report.py` | 已修复 Python 3.11 f-string 反斜杠问题，可重新生成 V3 完整报告。 |
| 迁移辅助 | `reports/migration_inventory.txt` | 当前项目主要文件盘点记录。 |

## 二、新环境最低要求

新环境建议使用 Linux 或 macOS。Windows 环境也可运行，但若使用 PowerShell 或 CMD，部分 shell 命令需要调整。项目的前端与服务端依赖 Node.js、pnpm 与 TypeScript 工具链；报告生成依赖 Python 3.11、pandas 与 matplotlib。Node.js 是 JavaScript 运行环境，pnpm 是高性能包管理器，Vite 是前端构建工具，Python 3.11 用于执行报告整理脚本。[2] [3] [4] [5]

| 组件 | 建议版本 | 用途 | 检查命令 |
|---|---:|---|---|
| Node.js | 22.x 或 20.x LTS | 运行 Vite、tsx、服务端与回测脚本 | `node -v` |
| pnpm | 10.x | 安装前后端依赖 | `pnpm -v` |
| Python | 3.11+ | 生成 Markdown 报告、CSV 与图表 | `python3.11 --version` |
| Python 套件 | pandas、matplotlib | 数据整理与图表输出 | `python3.11 -c "import pandas, matplotlib"` |
| unzip / zip | 系统工具 | 解压迁移包 | `unzip -v` |

若新环境还没有 pnpm，可以在安装 Node.js 后执行 `corepack enable`，或通过 npm 安装 pnpm。实际项目中的 `package.json` 已声明 `packageManager` 为 pnpm，因此建议继续使用 pnpm，避免 lockfile 与依赖解析差异。[3]

## 三、在新环境解压项目

把交付的 `btcusdt_dashboard_v6_unified_suite.zip` 上传到新环境后，建议放在用户主目录或工作目录中。以下命令假设压缩包位于 `~/upload/`，你可以按实际路径调整。

```bash
mkdir -p ~/work
cd ~/work
unzip ~/upload/btcusdt_dashboard_v6_unified_suite.zip
cd btcusdt_dashboard_v6
```

解压后，建议先确认关键文件是否存在。若这些文件齐全，说明迁移包可以继续使用。

```bash
ls -lh package.json pnpm-lock.yaml vite.config.ts
ls -lh reports/htr_v3_multisymbol_backtest_1y_full_report.md
ls -lh reports/htr_v3_multisymbol_backtest_1y.json
ls -lh server/backtest_htr_v3_multisymbol.ts
ls -lh client/src/components/panels/KlinePanel.tsx
```

## 四、安装依赖与启动 Dashboard

项目根目录已经包含 `package.json` 与 `pnpm-lock.yaml`。在新环境进入项目根目录后，先安装依赖，再启动开发服务器。Vite 的开发服务器默认用于本地预览前端，项目脚本中的 `dev` 会通过 `tsx watch server/_core/index.ts` 启动服务端开发模式。[4]

```bash
cd ~/work/btcusdt_dashboard_v6
pnpm install
pnpm run dev
```

启动后，在浏览器打开本地地址。如果新环境采用远程服务器，需要把对应端口映射或暴露出来。若只想验证能否构建，可以执行：

```bash
pnpm run build
```

| 操作 | 命令 | 成功判断 |
|---|---|---|
| 安装依赖 | `pnpm install` | 没有 dependency resolution 或 postinstall 错误。 |
| 开发启动 | `pnpm run dev` | 服务端开始监听，浏览器可以打开 Dashboard。 |
| 类型检查 | `pnpm run check` | TypeScript 没有阻断性类型错误。 |
| 生产构建 | `pnpm run build` | 生成 `dist/` 输出，没有 Vite 或 esbuild 错误。 |

如果启动时报端口占用，可以先查占用进程再释放端口，或修改服务端监听端口。若依赖安装失败，优先确认 Node.js 与 pnpm 版本，再删除 `node_modules` 后重新执行 `pnpm install`。

## 五、重新生成 V3 完整报告

V3 报告已生成并包含在迁移包中。若你在新环境修改了 V3 回测 JSON 或回测脚本，可以用以下命令重新生成完整报告、权益曲线、配置对比图与最佳交易 CSV。

```bash
cd ~/work/btcusdt_dashboard_v6
python3.11 reports/build_htr_v3_report.py
```

该脚本会读取 `reports/htr_v3_multisymbol_backtest_1y.json`，并输出以下文件。当前版本已经修复 Python 3.11 中 **f-string 表达式不能包含反斜杠** 的语法问题，因此可以直接执行。[5]

| 输出文件 | 用途 |
|---|---|
| `reports/htr_v3_multisymbol_backtest_1y_full_report.md` | V3 完整研究报告。 |
| `reports/htr_v3_vs_v2_equity_curve.png` | V2 与 V3 权益曲线对比。 |
| `reports/htr_v3_config_comparison.png` | V3 六组配置收益、PF 与交易数对比。 |
| `reports/htr_v3_best_v3_pool8_quality_trades.csv` | 最佳配置逐笔交易明细。 |

## 六、重新执行 V3 回测

如果新环境已经包含原始 K 线数据，或未来重新下载 Binance Data Vision 的 USDT-M Futures 15m 月度 K 线数据，可以执行 V3 TypeScript 回测脚本。当前 V3 策略逻辑位于 `server/backtest_htr_v3_multisymbol.ts`，其核心为 **4H 定方向、1H 确认状态、15m 触发、多币种池每日择优一单**。

```bash
cd ~/work/btcusdt_dashboard_v6
pnpm exec tsx server/backtest_htr_v3_multisymbol.ts
python3.11 reports/build_htr_v3_report.py
```

若脚本提示找不到数据，请先检查项目中的数据目录命名与脚本读取路径。由于不同环境的数据存放位置可能不同，建议优先在脚本中搜索 `data`、`klines`、`Binance`、`15m` 等关键词，确认实际读取目录。

```bash
grep -R "Binance\|klines\|15m\|data" -n server/backtest_htr_v3_multisymbol.ts server | head -80
```

## 七、当前研究结论与新环境续作方向

目前最重要的研究结论是，V3 已显著优于 V1 与 V2。最佳配置 `v3_pool8_quality` 的一年结果为 **154 笔交易**、约 **2.37 天一笔**、胜率 **64.94%**、PF **1.82**、账户收益 **17.35%**、最大回撤 **3.02%**。这说明多周期过滤与多币种择优比单币种强行提高频率更可靠。

| 版本 | 市场 | 最佳结论 | 后续处理 |
|---|---|---|---|
| V1 | BTC 单币种 15m | 负期望或低优势 | 保留为基线，不建议实盘化。 |
| V2 | BTC 单币种状态分类 | 转正但频率不足 | 保留趋势模块，关闭或重写震荡模块。 |
| V3 | 8 币种择优 | 当前最佳，PF 与收益显著提升 | 作为下一阶段 V4 的基础。 |

新环境建议优先继续 V4，而不是简单降低 V3 阈值。V3 frequency 配置虽然交易更多，但 PF 明显下降，因此若目标仍是「尽量接近每天一单」，更合理的路线是扩大高流动性合约池、增加相关性控制，并引入 5m 作为止损压缩工具，而不是作为放宽信号的工具。

| 优先级 | 续作任务 | 目标 |
|---:|---|---|
| 1 | 扩大到 12–20 个高流动性 USDT-M 合约 | 提升机会密度，但不牺牲质量阈值。 |
| 2 | 增加同向相关性控制 | 避免同一天买入多个高度相关币种造成风险集中。 |
| 3 | 引入 5m 精细入场 | 缩小止损距离、提高实际 R 值，但不得降低 4H / 1H / 15m 过滤标准。 |
| 4 | 加入手续费、滑点、资金费率压力测试 | 更接近真实交易环境。 |
| 5 | 做 walk-forward 与分年度样本 | 检查策略是否过拟合当前 2025-05 至 2026-04 区间。 |

## 八、前端 Dashboard 续作说明

前端已完成本轮用户要求：配色改为柔和淡色系，降低刺眼高饱和背景；K 线面板已加入 CVD、TPO / Market Profile 与趋势线表达；专业指标摘要卡文字也已更新。新环境若要继续优化前端，优先查看以下文件。

| 文件 | 继续工作的重点 |
|---|---|
| `client/src/components/panels/KlinePanel.tsx` | 调整 CVD、TPO、趋势线显示逻辑、图层顺序与交互。 |
| `client/src/index.css` | 调整低饱和主题覆盖、卡片背景、边框、阴影、文字对比度。 |
| `client/src/components/*` | 若要做整体布局、导航或图表面板扩展，优先从组件目录查找。 |
| `server/services/indicators.ts` 与 `server/utils/indicators.ts` | 若前端需要更多真实指标，可从后端指标计算扩展。 |

在新环境完成修改后，建议至少运行一次构建验证：

```bash
pnpm run build
```

## 九、常见问题排查

| 问题 | 可能原因 | 处理方式 |
|---|---|---|
| `pnpm: command not found` | 新环境未安装 pnpm | 执行 `corepack enable` 或安装 pnpm。 |
| `tsx: command not found` | 依赖尚未安装 | 在项目根目录执行 `pnpm install`。 |
| Python 报 `ModuleNotFoundError: pandas` | Python 套件缺失 | 执行 `pip install pandas matplotlib`，或使用系统允许的安装方式。 |
| 报告图片未显示 | Markdown 查看器没有从同目录加载图片 | 确认 `.md` 与 `.png` 均在 `reports/` 目录，或使用支持相对路径的 Markdown 预览器。 |
| V3 回测找不到原始数据 | 新环境没有数据目录或路径不同 | 检查脚本中数据读取路径，并重新下载或复制 Binance K 线数据。 |
| Dashboard 启动但页面空白 | 前端构建或路由错误 | 查看终端日志与浏览器 console，先执行 `pnpm run build` 定位错误。 |

## 十、建议的新环境第一条任务说明

如果你要在新环境开启新的 AI 工作会话，可以直接复制以下说明，让新会话快速接上当前进度。

> 请读取项目 `btcusdt_dashboard_v6`。当前已完成 Dashboard 柔和配色、CVD / TPO / 趋势线补入，以及 V1 / V2 / V3 一年真实数据回测。V3 最佳配置是 `v3_pool8_quality`，结果为 154 笔/年、约 2.37 天/笔、胜率 64.94%、PF 1.82、账户收益 17.35%、最大回撤 3.02%。请优先阅读 `BTCUSDT_Dashboard_v6_完整迁移与续作指南.md`、`reports/htr_v3_multisymbol_backtest_1y_full_report.md`、`server/backtest_htr_v3_multisymbol.ts`、`reports/build_htr_v3_report.py` 与 `client/src/components/panels/KlinePanel.tsx`。下一步目标是开发 V4：扩大币种池、加入相关性控制、用 5m 精细化入场压缩止损，并继续使用真实数据回测，不要简单降低阈值追求每天一单。

## References

[1]: https://data.binance.vision/ "Binance Data Vision"
[2]: https://nodejs.org/en "Node.js 官方网站"
[3]: https://pnpm.io/ "pnpm 官方文档"
[4]: https://vite.dev/ "Vite 官方文档"
[5]: https://docs.python.org/3.11/ "Python 3.11 官方文档"
