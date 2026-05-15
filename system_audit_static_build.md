\n## pnpm run check
```text

> crypto-dashboard@1.0.0 check /home/ubuntu/btcusdt_dashboard_v6
> tsc --noEmit

client/src/components/panels/IndicatorsPanel.tsx(104,27): error TS2802: Type 'Set<number>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_expanded_sweep.ts(394,44): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_expanded_sweep.ts(395,44): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_expanded_sweep.ts(396,44): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_expanded_sweep.ts(405,45): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_htr_1d_daily.ts(111,45): error TS2554: Expected 3 arguments, but got 2.
server/backtest_htr_1d_daily.ts(120,46): error TS2554: Expected 3 arguments, but got 2.
server/backtest_htr_v3_multisymbol.ts(138,383): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_htr_v3_multisymbol.ts(141,24): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_htr_v4_tpv_multisymbol.ts(173,383): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_htr_v4_tpv_multisymbol.ts(176,24): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_htr_v5_realdata_model.ts(138,383): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_htr_v5_realdata_model.ts(141,24): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/backtest_manus_scalper.ts(24,20): error TS2554: Expected 6 arguments, but got 3.
server/db.ts(99,23): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
  Type 'null' is not assignable to type 'string'.
server/deep_backtest_180d.ts(59,20): error TS2554: Expected 6 arguments, but got 5.
server/diagnostics_engine.ts(141,31): error TS2802: Type 'Map<StrategyFamily, { keys: string[]; totalRounds: number; blocked: number; sent: number; duplicate: number; idle: number; error: number; blockerCounts: Map<string, number>; }>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/diagnostics_engine.ts(149,21): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type 'Record<StrategyFamily, string>'.
server/fetch_and_backtest.ts(51,20): error TS2554: Expected 6 arguments, but got 3.
server/manus_scalper_strategy.ts(1,18): error TS2305: Module '"@shared/cryptoTypes"' has no exported member 'StrategySignal'.
server/run_1d_scan.ts(10,28): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_adv_scan.ts(10,28): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_adv_scan.ts(339,24): error TS2802: Type 'Set<number>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/run_all_strategy_binance.ts(6,51): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_backtest_from_json.ts(6,28): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_fast_search.ts(10,15): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_filtered_backtest.ts(7,28): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_full_param_search.ts(18,15): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_profitable_scan.ts(10,15): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_score_tp_scan.ts(7,28): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_search_groupA.ts(7,15): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_search_groupB.ts(7,15): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_search_groupC.ts(7,15): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_smart_param_search.ts(13,15): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/run_v4_five_strategy_live.ts(125,5): error TS2783: 'family' is specified more than once, so this usage will be overwritten.
server/run_v4_five_strategy_live.ts(145,5): error TS2783: 'family' is specified more than once, so this usage will be overwritten.
server/run_v4_five_strategy_live.ts(164,5): error TS2783: 'family' is specified more than once, so this usage will be overwritten.
server/run_v4_five_strategy_live.ts(183,5): error TS2783: 'family' is specified more than once, so this usage will be overwritten.
server/run_v4_five_strategy_live.ts(202,5): error TS2783: 'family' is specified more than once, so this usage will be overwritten.
server/run_v4_five_strategy_live.ts(290,30): error TS2802: Type 'MapIterator<[string, number]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/signalScanner.ts(426,15): error TS2304: Cannot find name 'StrategyFamily'.
server/strategies_archive/manus_scalper_v5_1_atr.ts(1,18): error TS2305: Module '"@shared/cryptoTypes"' has no exported member 'StrategySignal'.
server/strategies_archive/manus_scalper_v6_institutional.ts(1,18): error TS2305: Module '"@shared/cryptoTypes"' has no exported member 'StrategySignal'.
server/verify_presets_backtest.ts(9,28): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
server/verify_presets_backtest.ts(71,29): error TS2339: Property 'outcome' does not exist on type 'BacktestTrade'.
server/verify_presets_backtest.ts(71,59): error TS2339: Property 'outcome' does not exist on type 'BacktestTrade'.
server/verify_presets_v2.ts(8,28): error TS2459: Module '"./backtest.js"' declares 'Candle' locally, but it is not exported.
 ELIFECYCLE  Command failed with exit code 2.
\n(exit_code=2 duration_seconds=12)
```
\n## pnpm run build
```text

> crypto-dashboard@1.0.0 build /home/ubuntu/btcusdt_dashboard_v6
> vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

NODE_ENV=production is not supported in the .env file. Only NODE_ENV=development is supported to create a development build of your project. If you need to set process.env.NODE_ENV, you can set it in the Vite config instead.
vite v7.3.2 building client environment for production...
transforming...
✓ 6338 modules transformed.
rendering chunks...
computing gzip size...
../dist/public/index.html                                         1.76 kB │ gzip:   0.83 kB
../dist/public/assets/KaTeX_Size3-Regular-CTq5MqoE.woff           4.42 kB
../dist/public/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2          4.93 kB
../dist/public/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2          5.21 kB
../dist/public/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2          5.47 kB
../dist/public/assets/KaTeX_Size4-Regular-BF-4gkZK.woff           5.98 kB
../dist/public/assets/KaTeX_Size2-Regular-oD1tc_U0.woff           6.19 kB
../dist/public/assets/KaTeX_Size1-Regular-C195tn64.woff           6.50 kB
../dist/public/assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2    6.91 kB
../dist/public/assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2       6.91 kB
../dist/public/assets/KaTeX_Size3-Regular-DgpXs0kz.ttf            7.59 kB
../dist/public/assets/KaTeX_Caligraphic-Regular-CTRA-rTL.woff     7.66 kB
../dist/public/assets/KaTeX_Caligraphic-Bold-BEiXGLvX.woff        7.72 kB
../dist/public/assets/KaTeX_Script-Regular-D3wIWfF6.woff2         9.64 kB
../dist/public/assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2     10.34 kB
../dist/public/assets/KaTeX_Size4-Regular-DWFBv043.ttf           10.36 kB
../dist/public/assets/KaTeX_Script-Regular-D5yQViql.woff         10.59 kB
../dist/public/assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2       11.32 kB
../dist/public/assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2          11.35 kB
../dist/public/assets/KaTeX_Size2-Regular-B7gKUWhC.ttf           11.51 kB
../dist/public/assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2      12.03 kB
../dist/public/assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2        12.22 kB
../dist/public/assets/KaTeX_Size1-Regular-Dbsnue_I.ttf           12.23 kB
../dist/public/assets/KaTeX_SansSerif-Regular-CS6fqUqJ.woff      12.32 kB
../dist/public/assets/KaTeX_Caligraphic-Regular-wX97UBjC.ttf     12.34 kB
../dist/public/assets/KaTeX_Caligraphic-Bold-ATXxdsX0.ttf        12.37 kB
../dist/public/assets/KaTeX_Fraktur-Regular-Dxdc4cR9.woff        13.21 kB
../dist/public/assets/KaTeX_Fraktur-Bold-BsDP51OF.woff           13.30 kB
../dist/public/assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2    13.57 kB
../dist/public/assets/KaTeX_SansSerif-Italic-DN2j7dab.woff       14.11 kB
../dist/public/assets/KaTeX_SansSerif-Bold-DbIhKOiC.woff         14.41 kB
../dist/public/assets/KaTeX_Typewriter-Regular-C0xS9mPB.woff     16.03 kB
../dist/public/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2       16.40 kB
../dist/public/assets/KaTeX_Math-Italic-t53AETM-.woff2           16.44 kB
../dist/public/assets/KaTeX_Script-Regular-C5JkGWo-.ttf          16.65 kB
../dist/public/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2       16.78 kB
../dist/public/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2           16.99 kB
../dist/public/assets/KaTeX_Math-BoldItalic-iY-2wyZ7.woff        18.67 kB
../dist/public/assets/KaTeX_Math-Italic-DA0__PXp.woff            18.75 kB
../dist/public/assets/KaTeX_Main-BoldItalic-SpSLRI95.woff        19.41 kB
../dist/public/assets/KaTeX_SansSerif-Regular-BNo7hRIc.ttf       19.44 kB
../dist/public/assets/KaTeX_Fraktur-Regular-CB_wures.ttf         19.57 kB
../dist/public/assets/KaTeX_Fraktur-Bold-BdnERNNW.ttf            19.58 kB
../dist/public/assets/KaTeX_Main-Italic-BMLOBm91.woff            19.68 kB
../dist/public/assets/KaTeX_SansSerif-Italic-YYjJ1zSn.ttf        22.36 kB
../dist/public/assets/KaTeX_SansSerif-Bold-CFMepnvq.ttf          24.50 kB
../dist/public/assets/KaTeX_Main-Bold-Cx986IdX.woff2             25.32 kB
../dist/public/assets/KaTeX_Main-Regular-B22Nviop.woff2          26.27 kB
../dist/public/assets/KaTeX_Typewriter-Regular-D3Ib7_Hf.ttf      27.56 kB
../dist/public/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2           28.08 kB
../dist/public/assets/KaTeX_Main-Bold-Jm3AIy58.woff              29.91 kB
../dist/public/assets/KaTeX_Main-Regular-Dr94JaBh.woff           30.77 kB
../dist/public/assets/KaTeX_Math-BoldItalic-B3XSjfu4.ttf         31.20 kB
../dist/public/assets/KaTeX_Math-Italic-flOr_0UB.ttf             31.31 kB
../dist/public/assets/KaTeX_Main-BoldItalic-DzxPMmG6.ttf         32.97 kB
../dist/public/assets/KaTeX_AMS-Regular-DMm9YOAa.woff            33.52 kB
../dist/public/assets/KaTeX_Main-Italic-3WenGoN9.ttf             33.58 kB
../dist/public/assets/KaTeX_Main-Bold-waoOVXN0.ttf               51.34 kB
../dist/public/assets/KaTeX_Main-Regular-ypZvNtVU.ttf            53.58 kB
../dist/public/assets/KaTeX_AMS-Regular-DRggAlZN.ttf             63.63 kB
../dist/public/assets/katex-CfVKi3_s.css                         29.27 kB │ gzip:   8.05 kB
../dist/public/assets/index-CsRNAYBU.css                        170.89 kB │ gzip:  25.62 kB
../dist/public/assets/clone-B4uq0m59.js                           0.09 kB │ gzip:   0.11 kB
../dist/public/assets/channel-Fozs3chJ.js                         0.11 kB │ gzip:   0.13 kB
../dist/public/assets/index-BUUSEHUW.js                           0.14 kB │ gzip:   0.14 kB
../dist/public/assets/chunk-QZHKN3VN-COX-clyJ.js                  0.19 kB │ gzip:   0.16 kB
../dist/public/assets/info-Oabp5fZr.js                            0.20 kB │ gzip:   0.18 kB
../dist/public/assets/chunk-4BX2VUAB-PSVS9p8l.js                  0.23 kB │ gzip:   0.17 kB
../dist/public/assets/chunk-55IACEB6-Cxn3au4D.js                  0.24 kB │ gzip:   0.21 kB
../dist/public/assets/circle-alert-DYFJTa4h.js                    0.25 kB │ gzip:   0.18 kB
../dist/public/assets/trending-up-BUUyEUNV.js                     0.36 kB │ gzip:   0.22 kB
../dist/public/assets/chunk-FMBD7UC4-CCMpemPM.js                  0.37 kB │ gzip:   0.27 kB
../dist/public/assets/init-Dmth1JHB.js                            0.38 kB │ gzip:   0.19 kB
../dist/public/assets/stateDiagram-v2-QKLJ7IA2-CJqfoBSF.js        0.49 kB │ gzip:   0.33 kB
../dist/public/assets/chunk-EDXVE4YY-Cbyhdwzr.js                  0.51 kB │ gzip:   0.36 kB
../dist/public/assets/refresh-cw-uhyY1BD5.js                      0.53 kB │ gzip:   0.31 kB
../dist/public/assets/codeowners-Bp6g37R7.js                      0.55 kB │ gzip:   0.32 kB
../dist/public/assets/shield-yePnZagu.js                          0.55 kB │ gzip:   0.32 kB
../dist/public/assets/classDiagram-6PBFFD2Q-Cp8ruoBB.js           0.56 kB │ gzip:   0.36 kB
../dist/public/assets/classDiagram-v2-HSJHXN6E-Cp8ruoBB.js        0.56 kB │ gzip:   0.36 kB
../dist/public/assets/min-DddRhAfB.js                             0.59 kB │ gzip:   0.37 kB
../dist/public/assets/shellsession-BADoaaVG.js                    0.71 kB │ gzip:   0.43 kB
../dist/public/assets/infoDiagram-42DDH7IO-C_V_ij2w.js            0.74 kB │ gzip:   0.48 kB
../dist/public/assets/tsv-B_m7g4N7.js                             0.74 kB │ gzip:   0.34 kB
../dist/public/assets/html-derivative-BFtXZ54Q.js                 0.90 kB │ gzip:   0.50 kB
../dist/public/assets/card-DB7Vz8La.js                            0.95 kB │ gzip:   0.40 kB
../dist/public/assets/git-rebase-r7XF79zn.js                      0.98 kB │ gzip:   0.44 kB
../dist/public/assets/qmldir-C8lEn-DE.js                          1.00 kB │ gzip:   0.45 kB
../dist/public/assets/csv-fuZLfV_i.js                             1.14 kB │ gzip:   0.37 kB
../dist/public/assets/ordinal-DILIJJjt.js                         1.20 kB │ gzip:   0.58 kB
../dist/public/assets/git-commit-F4YmCXRG.js                      1.23 kB │ gzip:   0.53 kB
../dist/public/assets/xsl-CtQFsRM5.js                             1.39 kB │ gzip:   0.52 kB
../dist/public/assets/dotenv-Da5cRb03.js                          1.42 kB │ gzip:   0.53 kB
../dist/public/assets/sparql-rVzFXLq3.js                          1.48 kB │ gzip:   0.82 kB
../dist/public/assets/ini-BEwlwnbL.js                             1.53 kB │ gzip:   0.50 kB
../dist/public/assets/band-CquvqAHh.js                            1.54 kB │ gzip:   0.67 kB
../dist/public/assets/fortran-fixed-form-CkoXwp7k.js              1.67 kB │ gzip:   0.69 kB
../dist/public/assets/docker-BcOcwvcX.js                          1.74 kB │ gzip:   0.60 kB
../dist/public/assets/hxml-Bvhsp5Yf.js                            1.74 kB │ gzip:   0.88 kB
../dist/public/assets/desktop-BmXAJ9_W.js                         1.83 kB │ gzip:   0.76 kB
../dist/public/assets/chunk-YZCP3GAM-CJaE5dEU.js                  1.88 kB │ gzip:   0.83 kB
../dist/public/assets/wenyan-BV7otONQ.js                          2.16 kB │ gzip:   1.09 kB
../dist/public/assets/jssm-C2t-YnRu.js                            2.24 kB │ gzip:   0.62 kB
../dist/public/assets/NotFound-BnjBcgge.js                        2.34 kB │ gzip:   0.93 kB
../dist/public/assets/reg-C-SQnVFl.js                             2.35 kB │ gzip:   0.70 kB
../dist/public/assets/edge-BkV0erSs.js                            2.36 kB │ gzip:   0.70 kB
../dist/public/assets/diff-D97Zzqfu.js                            2.57 kB │ gzip:   0.70 kB
../dist/public/assets/gleam-BspZqrRM.js                           2.58 kB │ gzip:   0.82 kB
../dist/public/assets/erb-B12qg9BL.js                             2.61 kB │ gzip:   0.84 kB
../dist/public/assets/hy-DFXneXwc.js                              2.65 kB │ gzip:   1.18 kB
../dist/public/assets/json-Cp-IABpG.js                            2.82 kB │ gzip:   0.78 kB
../dist/public/assets/openscad-C4EeE6gA.js                        2.82 kB │ gzip:   1.01 kB
../dist/public/assets/log-2UxHyX5q.js                             2.85 kB │ gzip:   0.90 kB
../dist/public/assets/diagram-5BDNPKRD-Co1RhZd3.js                2.91 kB │ gzip:   1.44 kB
../dist/public/assets/cairo-KRGpt6FW.js                           2.94 kB │ gzip:   0.81 kB
../dist/public/assets/berry-uYugtg8r.js                           3.01 kB │ gzip:   0.81 kB
../dist/public/assets/jsonl-DcaNXYhu.js                           3.01 kB │ gzip:   0.79 kB
../dist/public/assets/jsonc-Des-eS-w.js                           3.11 kB │ gzip:   0.80 kB
../dist/public/assets/logo-BtOb2qkB.js                            3.13 kB │ gzip:   1.47 kB
../dist/public/assets/po-BTJTHyun.js                              3.24 kB │ gzip:   0.91 kB
../dist/public/assets/json5-C9tS-k6U.js                           3.25 kB │ gzip:   0.83 kB
../dist/public/assets/mipsasm-CKIfxQSi.js                         3.26 kB │ gzip:   1.18 kB
../dist/public/assets/tasl-QIJgUcNo.js                            3.29 kB │ gzip:   0.85 kB
../dist/public/assets/genie-D0YGMca9.js                           3.36 kB │ gzip:   1.21 kB
../dist/public/assets/rel-C3B-1QV4.js                             3.37 kB │ gzip:   1.11 kB
../dist/public/assets/vala-CsfeWuGM.js                            3.37 kB │ gzip:   1.19 kB
../dist/public/assets/arc-DtWrmhPk.js                             3.42 kB │ gzip:   1.46 kB
../dist/public/assets/splunk-BtCnVYZw.js                          3.44 kB │ gzip:   1.52 kB
../dist/public/assets/fluent-C4IJs8-o.js                          3.61 kB │ gzip:   0.90 kB
../dist/public/assets/ssh-config-_ykCGR6B.js                      3.62 kB │ gzip:   1.60 kB
../dist/public/assets/jsonnet-DFQXde-d.js                         3.62 kB │ gzip:   1.05 kB
../dist/public/assets/kdl-DV7GczEv.js                             3.63 kB │ gzip:   1.04 kB
../dist/public/assets/glsl-DplSGwfg.js                            3.63 kB │ gzip:   1.41 kB
../dist/public/assets/hurl-irOxFIW8.js                            3.65 kB │ gzip:   1.16 kB
../dist/public/assets/narrat-DRg8JJMk.js                          3.67 kB │ gzip:   1.11 kB
../dist/public/assets/turtle-BsS91CYL.js                          3.70 kB │ gzip:   0.98 kB
../dist/public/assets/zenscript-DVFEvuxE.js                       3.91 kB │ gzip:   1.28 kB
../dist/public/assets/ron-D8l8udqQ.js                             3.91 kB │ gzip:   0.98 kB
../dist/public/assets/button-jtl5YZWR.js                          3.92 kB │ gzip:   1.76 kB
../dist/public/assets/gn-n2N0HUVH.js                              4.00 kB │ gzip:   1.49 kB
../dist/public/assets/pascal-D93ZcfNL.js                          4.15 kB │ gzip:   1.67 kB
../dist/public/assets/diagram-TYMM5635-Bw9GO9l1.js                4.37 kB │ gzip:   1.91 kB
../dist/public/assets/tcl-dwOrl1Do.js                             4.43 kB │ gzip:   1.52 kB
../dist/public/assets/nextflow-Zz6hmt5N.js                        4.51 kB │ gzip:   1.17 kB
../dist/public/assets/rosmsg-BJDFO7_C.js                          4.52 kB │ gzip:   1.06 kB
../dist/public/assets/http-jrhK8wxY.js                            4.55 kB │ gzip:   1.12 kB
../dist/public/assets/polar-C0HS_06l.js                           4.67 kB │ gzip:   1.12 kB
../dist/public/assets/defaultLocale-DX6XiGOO.js                   4.69 kB │ gzip:   2.18 kB
../dist/public/assets/sdbl-DVxCFoDh.js                            4.70 kB │ gzip:   2.01 kB
../dist/public/assets/fennel-BYunw83y.js                          4.77 kB │ gzip:   1.53 kB
../dist/public/assets/bibtex-CHM0blh-.js                          4.80 kB │ gzip:   0.83 kB
../dist/public/assets/llvm-DjAJT7YJ.js                            5.05 kB │ gzip:   2.01 kB
../dist/public/assets/wgsl-Dx-B1_4e.js                            5.14 kB │ gzip:   1.39 kB
../dist/public/assets/gdresource-BOOCDP_w.js                      5.29 kB │ gzip:   1.34 kB
../dist/public/assets/qml-3beO22l8.js                             5.34 kB │ gzip:   1.38 kB
../dist/public/assets/zig-VOosw3JB.js                             5.34 kB │ gzip:   1.55 kB
../dist/public/assets/dax-CEL-wOlO.js                             5.37 kB │ gzip:   2.23 kB
../dist/public/assets/bicep-Bmn6On1c.js                           5.38 kB │ gzip:   1.15 kB
../dist/public/assets/xml-sdJ4AIDG.js                             5.38 kB │ gzip:   1.21 kB
../dist/public/assets/pieDiagram-DEJITSTG-Rs3kWi3Z.js             5.43 kB │ gzip:   2.41 kB
../dist/public/assets/awk-DMzUqQB5.js                             5.46 kB │ gzip:   1.38 kB
../dist/public/assets/coq-DkFqJrB1.js                             5.53 kB │ gzip:   1.92 kB
../dist/public/assets/jinja-4LBKfQ-Z.js                           5.69 kB │ gzip:   1.40 kB
../dist/public/assets/lean-BZvkOJ9d.js                            5.78 kB │ gzip:   1.92 kB
../dist/public/assets/linear-DSkd6W2C.js                          5.80 kB │ gzip:   2.38 kB
../dist/public/assets/moonbit-_H4v1dQx.js                         5.90 kB │ gzip:   1.68 kB
../dist/public/assets/powerquery-CEu0bR-o.js                      5.90 kB │ gzip:   1.52 kB
../dist/public/assets/shaderlab-Dg9Lc6iA.js                       5.92 kB │ gzip:   2.08 kB
../dist/public/assets/verilog-BQ8w6xss.js                         5.93 kB │ gzip:   1.89 kB
../dist/public/assets/cypher-COkxafJQ.js                          5.96 kB │ gzip:   1.73 kB
../dist/public/assets/diagram-MMDJMWI5-v3pcALZ5.js                5.96 kB │ gzip:   2.54 kB
../dist/public/assets/vb-D17OF-Vu.js                              6.09 kB │ gzip:   2.34 kB
../dist/public/assets/red-bN70gL4F.js                             6.26 kB │ gzip:   1.60 kB
../dist/public/assets/min-dark-CafNBF8u.js                        6.29 kB │ gzip:   1.71 kB
../dist/public/assets/gdshader-DkwncUOv.js                        6.33 kB │ gzip:   1.73 kB
../dist/public/assets/prisma-Dd19v3D-.js                          6.33 kB │ gzip:   1.39 kB
../dist/public/assets/ara-BRHolxvo.js                             6.36 kB │ gzip:   1.81 kB
../dist/public/assets/clojure-P80f7IUj.js                         6.41 kB │ gzip:   1.42 kB
../dist/public/assets/postcss-CXtECtnM.js                         6.42 kB │ gzip:   1.91 kB
../dist/public/assets/toml-vGWfd6FD.js                            6.43 kB │ gzip:   1.28 kB
../dist/public/assets/solarized-light-L9t79GZl.js                 6.48 kB │ gzip:   1.73 kB
../dist/public/assets/r-Dspwwk_N.js                               6.54 kB │ gzip:   1.78 kB
../dist/public/assets/proto-C7zT0LnQ.js                           6.55 kB │ gzip:   1.42 kB
../dist/public/assets/smalltalk-BERRCDM3.js                       6.59 kB │ gzip:   1.62 kB
../dist/public/assets/talonscript-CkByrt1z.js                     6.76 kB │ gzip:   1.49 kB
../dist/public/assets/solarized-dark-DXbdFlpD.js                  6.85 kB │ gzip:   1.80 kB
../dist/public/assets/riscv-BM1_JUlF.js                           6.91 kB │ gzip:   1.98 kB
../dist/public/assets/min-light-CTRr51gU.js                       6.97 kB │ gzip:   1.89 kB
../dist/public/assets/soy-Brmx7dQM.js                             6.98 kB │ gzip:   1.66 kB
../dist/public/assets/scheme-C98Dy4si.js                          7.17 kB │ gzip:   2.05 kB
../dist/public/assets/hlsl-D3lLCCz7.js                            7.26 kB │ gzip:   2.19 kB
../dist/public/assets/qss-IeuSbFQv.js                             7.47 kB │ gzip:   2.58 kB
../dist/public/assets/dart-CF10PKvl.js                            7.81 kB │ gzip:   1.91 kB
../dist/public/assets/systemd-4A_iFExJ.js                         7.87 kB │ gzip:   2.55 kB
../dist/public/assets/monokai-D4h5O-jR.js                         7.88 kB │ gzip:   1.91 kB
../dist/public/assets/regexp-CDVJQ6XC.js                          7.99 kB │ gzip:   1.42 kB
../dist/public/assets/haml-B8DHNrY2.js                            8.26 kB │ gzip:   1.81 kB
../dist/public/assets/typst-DHCkPAjA.js                           8.39 kB │ gzip:   1.67 kB
../dist/public/assets/vue-html-AaS7Mt5G.js                        8.47 kB │ gzip:   1.68 kB
../dist/public/assets/_baseUniq-_ZLKKn4k.js                       8.48 kB │ gzip:   3.53 kB
../dist/public/assets/plsql-ChMvpjG-.js                           8.51 kB │ gzip:   3.00 kB
../dist/public/assets/horizon-BUw7H-hv.js                         8.78 kB │ gzip:   1.96 kB
../dist/public/assets/kotlin-BdnUsdx6.js                          8.79 kB │ gzip:   2.13 kB
../dist/public/assets/horizon-bright-Cn-bp-IR.js                  8.79 kB │ gzip:   1.97 kB
../dist/public/assets/ts-tags-zn1MmPIZ.js                         8.95 kB │ gzip:   1.22 kB
../dist/public/assets/make-CHLpvVh8.js                            8.96 kB │ gzip:   1.77 kB
../dist/public/assets/andromeeda-C4gqWexZ.js                      9.02 kB │ gzip:   2.36 kB
../dist/public/assets/sas-cz2c8ADy.js                             9.06 kB │ gzip:   3.81 kB
../dist/public/assets/dark-plus-C3mMm8J8.js                       9.10 kB │ gzip:   2.10 kB
../dist/public/assets/slack-dark-BthQWCQV.js                      9.12 kB │ gzip:   1.97 kB
../dist/public/assets/sass-Cj5Yp3dK.js                            9.29 kB │ gzip:   2.49 kB
../dist/public/assets/plastic-3e1v2bzS.js                         9.30 kB │ gzip:   1.98 kB
../dist/public/assets/graph-1b4lRmF5.js                           9.37 kB │ gzip:   3.20 kB
../dist/public/assets/slack-ochin-DqwNpetd.js                     9.43 kB │ gzip:   2.10 kB
../dist/public/assets/tex-idrVyKtj.js                             9.67 kB │ gzip:   3.06 kB
../dist/public/assets/jison-wvAkD_A8.js                           9.69 kB │ gzip:   1.85 kB
../dist/public/assets/cmake-D1j8_8rp.js                           9.86 kB │ gzip:   3.37 kB
../dist/public/assets/light-plus-B7mTdjB0.js                      9.94 kB │ gzip:   2.27 kB
../dist/public/assets/hcl-BWvSN4gD.js                            10.05 kB │ gzip:   1.93 kB
../dist/public/assets/pkl-u5AG7uiY.js                            10.37 kB │ gzip:   1.38 kB
../dist/public/assets/beancount-k_qm7-4y.js                      10.37 kB │ gzip:   1.44 kB
../dist/public/assets/nextflow-groovy-BeH2EWoN.js                10.41 kB │ gzip:   2.13 kB
../dist/public/assets/dream-maker-BtqSS_iP.js                    10.47 kB │ gzip:   2.25 kB
../dist/public/assets/raku-DXvB9xmW.js                           10.47 kB │ gzip:   2.94 kB
../dist/public/assets/yaml-Buea-lGh.js                           10.51 kB │ gzip:   2.27 kB
../dist/public/assets/stateDiagram-FHFEXIEX-DnC-KMGU.js          10.52 kB │ gzip:   3.70 kB
../dist/public/assets/rst-BrH8l1NY.js                            10.67 kB │ gzip:   2.42 kB
../dist/public/assets/elm-DbKCFpqz.js                            10.97 kB │ gzip:   2.12 kB
../dist/public/assets/dagre-KV5264BT-WTyulxgV.js                 11.09 kB │ gzip:   4.15 kB
../dist/public/assets/just-Cw27pwNe.js                           11.16 kB │ gzip:   2.78 kB
../dist/public/assets/github-light-DAi9KRSo.js                   11.18 kB │ gzip:   2.51 kB
../dist/public/assets/prolog-CbFg5uaA.js                         11.36 kB │ gzip:   3.83 kB
../dist/public/assets/terraform-BETggiCN.js                      11.39 kB │ gzip:   2.51 kB
../dist/public/assets/github-dark-DHJKELXO.js                    11.41 kB │ gzip:   2.55 kB
../dist/public/assets/puppet-BMWR74SV.js                         11.44 kB │ gzip:   2.11 kB
../dist/public/assets/laserwave-DUszq2jm.js                      11.50 kB │ gzip:   2.58 kB
../dist/public/assets/gherkin-DyxjwDmM.js                        11.95 kB │ gzip:   5.05 kB
../dist/public/assets/wasm-MzD3tlZU.js                           12.01 kB │ gzip:   2.19 kB
../dist/public/assets/hjson-D5-asLiD.js                          12.05 kB │ gzip:   1.64 kB
../dist/public/assets/handlebars-BL8al0AC.js                     12.15 kB │ gzip:   2.38 kB
../dist/public/assets/NewsPanel-DnZxj-KU.js                      12.44 kB │ gzip:   3.01 kB
../dist/public/assets/apache-Pmp26Uib.js                         12.46 kB │ gzip:   3.72 kB
../dist/public/assets/vesper-DU1UobuO.js                         12.69 kB │ gzip:   1.97 kB
../dist/public/assets/bat-BkioyH1T.js                            12.89 kB │ gzip:   3.22 kB
../dist/public/assets/fish-BvzEVeQv.js                           13.04 kB │ gzip:   1.74 kB
../dist/public/assets/v-BcVCzyr7.js                              13.21 kB │ gzip:   2.74 kB
../dist/public/assets/vitesse-light-CVO1_9PV.js                  13.62 kB │ gzip:   3.04 kB
../dist/public/assets/aurora-x-D-2ljcwZ.js                       13.66 kB │ gzip:   2.28 kB
../dist/public/assets/vitesse-black-Bkuqu6BP.js                  13.68 kB │ gzip:   3.06 kB
../dist/public/assets/vitesse-dark-D0r3Knsf.js                   13.76 kB │ gzip:   3.06 kB
../dist/public/assets/pug-CGlum2m_.js                            13.84 kB │ gzip:   2.58 kB
../dist/public/assets/luau-C-HG3fhB.js                           13.96 kB │ gzip:   3.18 kB
../dist/public/assets/synthwave-84-CbfX1IO0.js                   14.04 kB │ gzip:   2.87 kB
../dist/public/assets/github-light-default-D7oLnXFd.js           14.16 kB │ gzip:   3.04 kB
../dist/public/assets/clarity-D53aC0YG.js                        14.28 kB │ gzip:   2.46 kB
../dist/public/assets/github-light-high-contrast-BfjtVDDH.js     14.28 kB │ gzip:   3.02 kB
../dist/public/assets/github-dark-dimmed-DH5Ifo-i.js             14.43 kB │ gzip:   3.13 kB
../dist/public/assets/github-dark-default-Cuk6v7N8.js            14.44 kB │ gzip:   3.13 kB
../dist/public/assets/github-dark-high-contrast-E3gJ1_iC.js      14.60 kB │ gzip:   3.09 kB
../dist/public/assets/gnuplot-DdkO51Og.js                        14.78 kB │ gzip:   3.27 kB
../dist/public/assets/rust-B1yitclQ.js                           15.07 kB │ gzip:   2.72 kB
../dist/public/assets/time-DXBSQWow.js                           15.14 kB │ gzip:   4.92 kB
../dist/public/assets/kusto-DZf3V79B.js                          15.17 kB │ gzip:   3.92 kB
../dist/public/assets/actionscript-3-CoDkCxhg.js                 15.21 kB │ gzip:   2.66 kB
../dist/public/assets/nix-CwoSXNpI.js                            15.51 kB │ gzip:   2.48 kB
../dist/public/assets/lua-BaeVxFsk.js                            15.54 kB │ gzip:   3.16 kB
../dist/public/assets/abap-BdImnpbu.js                           15.85 kB │ gzip:   5.91 kB
../dist/public/assets/diagram-G4DWMVQ6-BFWvTNcx.js               15.96 kB │ gzip:   5.74 kB
../dist/public/assets/solidity-rGO070M0.js                       16.07 kB │ gzip:   3.11 kB
../dist/public/assets/matlab-D7o27uSR.js                         16.09 kB │ gzip:   3.06 kB
../dist/public/assets/cue-D82EKSYY.js                            16.20 kB │ gzip:   2.06 kB
../dist/public/assets/elixir-CDX3lj18.js                         16.32 kB │ gzip:   2.80 kB
../dist/public/assets/odin-BBf5iR-q.js                           16.51 kB │ gzip:   2.94 kB
../dist/public/assets/bird2-DPOp833l.js                          16.97 kB │ gzip:   3.85 kB
../dist/public/assets/kanagawa-wave-DWedfzmr.js                  17.12 kB │ gzip:   2.93 kB
../dist/public/assets/kanagawa-lotus-CfQXZHmo.js                 17.13 kB │ gzip:   2.93 kB
../dist/public/assets/kanagawa-dragon-CkXjmgJE.js                17.13 kB │ gzip:   2.95 kB
../dist/public/assets/move-IF9eRakj.js                           17.51 kB │ gzip:   3.07 kB
../dist/public/assets/ishikawaDiagram-UXIWVN3A-CreE51Bv.js       17.57 kB │ gzip:   6.70 kB
../dist/public/assets/graphql-ChdNCCLP.js                        18.00 kB │ gzip:   2.52 kB
../dist/public/assets/liquid-DYVedYrR.js                         18.09 kB │ gzip:   3.16 kB
../dist/public/assets/svelte-C_ipcX3V.js                         18.24 kB │ gzip:   3.14 kB
../dist/public/assets/material-theme-D5KoaKCx.js                 18.62 kB │ gzip:   3.11 kB
../dist/public/assets/material-theme-darker-BfHTSMKl.js          18.63 kB │ gzip:   3.11 kB
../dist/public/assets/material-theme-ocean-CyktbL80.js           18.63 kB │ gzip:   3.14 kB
../dist/public/assets/material-theme-lighter-B0m2ddpp.js         18.63 kB │ gzip:   3.11 kB
../dist/public/assets/material-theme-palenight-Csfq5Kiy.js       18.64 kB │ gzip:   3.13 kB
../dist/public/assets/gdscript-C5YyOfLZ.js                       18.99 kB │ gzip:   3.75 kB
../dist/public/assets/groovy-gcz8RCvz.js                         19.18 kB │ gzip:   3.60 kB
../dist/public/assets/mdc-BMNejdWA.js                            19.63 kB │ gzip:   6.66 kB
../dist/public/assets/string-Bl2zznvy.js                         19.97 kB │ gzip:   6.71 kB
../dist/public/assets/glimmer-js-Rg0-pVw9.js                     20.07 kB │ gzip:   2.95 kB
../dist/public/assets/glimmer-ts-U6CK756n.js                     20.07 kB │ gzip:   2.94 kB
../dist/public/assets/ayu-dark-DYE7WIF3.js                       20.08 kB │ gzip:   3.94 kB
../dist/public/assets/ayu-mirage-32ctXXKs.js                     20.09 kB │ gzip:   3.94 kB
../dist/public/assets/powershell-Dpen1YoG.js                     20.15 kB │ gzip:   4.07 kB
../dist/public/assets/ayu-light-BA47KaF1.js                      20.15 kB │ gzip:   3.93 kB
../dist/public/assets/viml-CJc9bBzg.js                           20.37 kB │ gzip:   6.73 kB
../dist/public/assets/kanban-definition-6JOO6SKY-CN9dPvTO.js     20.39 kB │ gzip:   7.26 kB
../dist/public/assets/nushell-Cz2AlsmD.js                        20.41 kB │ gzip:   5.22 kB
../dist/public/assets/ScreenerPanel-BmAbExq8.js                  20.52 kB │ gzip:   4.31 kB
../dist/public/assets/snazzy-light-Bw305WKR.js                   20.77 kB │ gzip:   3.83 kB
../dist/public/assets/dracula-BzJJZx-M.js                        21.07 kB │ gzip:   4.00 kB
../dist/public/assets/dracula-soft-BXkSAIEj.js                   21.08 kB │ gzip:   4.04 kB
../dist/public/assets/twig-DNn4PbVi.js                           21.36 kB │ gzip:   3.87 kB
../dist/public/assets/wit-5i3qLPDT.js                            21.47 kB │ gzip:   2.89 kB
../dist/public/assets/rose-pine-qdsjHGoJ.js                      21.74 kB │ gzip:   3.87 kB
../dist/public/assets/rose-pine-moon-D4_iv3hh.js                 21.75 kB │ gzip:   3.89 kB
../dist/public/assets/rose-pine-dawn-DHQR4-dF.js                 21.75 kB │ gzip:   3.89 kB
../dist/public/assets/sankeyDiagram-XADWPNL6-CLD7Ggpg.js         22.21 kB │ gzip:   8.19 kB
../dist/public/assets/nim-CVrawwO9.js                            22.46 kB │ gzip:   3.16 kB
../dist/public/assets/common-lisp-Cg-RD9OK.js                    22.58 kB │ gzip:   6.06 kB
../dist/public/assets/surrealql-Bq5Q-fJD.js                      22.58 kB │ gzip:   4.32 kB
../dist/public/assets/gruvbox-dark-hard-CFHQjOhq.js              22.63 kB │ gzip:   4.18 kB
../dist/public/assets/gruvbox-dark-soft-CVdnzihN.js              22.63 kB │ gzip:   4.17 kB
../dist/public/assets/gruvbox-light-hard-CH1njM8p.js             22.64 kB │ gzip:   4.18 kB
../dist/public/assets/gruvbox-light-soft-hJgmCMqR.js             22.64 kB │ gzip:   4.18 kB
../dist/public/assets/gruvbox-dark-medium-GsRaNv29.js            22.64 kB │ gzip:   4.18 kB
../dist/public/assets/gruvbox-light-medium-DRw_LuNl.js           22.64 kB │ gzip:   4.18 kB
../dist/public/assets/sql-BLtJtn59.js                            23.41 kB │ gzip:   7.40 kB
../dist/public/assets/mindmap-definition-QFDTVHPH-Dw7bscM3.js    23.55 kB │ gzip:   7.98 kB
../dist/public/assets/journeyDiagram-VCZTEJTY-LW5Zc8Et.js        23.67 kB │ gzip:   8.40 kB
../dist/public/assets/cadence-Bv_4Rxtq.js                        23.67 kB │ gzip:   3.67 kB
../dist/public/assets/astro-CbQHKStN.js                          24.01 kB │ gzip:   7.54 kB
../dist/public/assets/typespec-BGHnOYBU.js                       24.02 kB │ gzip:   2.59 kB
../dist/public/assets/apl-dKokRX4l.js                            24.04 kB │ gzip:   4.20 kB
../dist/public/assets/templ-P3uqSqPl.js                          24.06 kB │ gzip:   5.40 kB
../dist/public/assets/vhdl-CeAyd5Ju.js                           24.26 kB │ gzip:   3.87 kB
../dist/public/assets/angular-html-CU67Zn6k.js                   24.29 kB │ gzip:   4.01 kB
../dist/public/assets/wardleyDiagram-NUSXRM2D-CgT65Ld6.js        24.37 kB │ gzip:   6.63 kB
../dist/public/assets/vue-DN_0RTcg.js                            24.48 kB │ gzip:   2.97 kB
../dist/public/assets/purescript-CklMAg4u.js                     24.69 kB │ gzip:   3.25 kB
../dist/public/assets/one-light-C3Wv6jpd.js                      25.30 kB │ gzip:   3.67 kB
../dist/public/assets/fsharp-CXgrBDvD.js                         25.31 kB │ gzip:   4.13 kB
../dist/public/assets/marko-CnJfTvn9.js                          25.48 kB │ gzip:   3.59 kB
../dist/public/assets/c3-eo99z4R2.js                             25.63 kB │ gzip:   3.87 kB
../dist/public/assets/IndicatorsPanel-Czcl6KlR.js                25.65 kB │ gzip:   5.08 kB
../dist/public/assets/night-owl-light-CMTm3GFP.js                25.90 kB │ gzip:   4.26 kB
../dist/public/assets/system-verilog-CnnmHF94.js                 26.20 kB │ gzip:   4.85 kB
../dist/public/assets/nord-Ddv68eIx.js                           26.72 kB │ gzip:   4.40 kB
../dist/public/assets/codeql-DsOJ9woJ.js                         26.88 kB │ gzip:   3.79 kB
../dist/public/assets/erDiagram-SMLLAGMA-BY0l2dT2.js             26.95 kB │ gzip:   9.39 kB
../dist/public/assets/scss-OYdSNvt2.js                           27.20 kB │ gzip:   4.20 kB
../dist/public/assets/java-CylS5w8V.js                           27.22 kB │ gzip:   4.26 kB
../dist/public/assets/coffee-Ch7k5sss.js                         27.42 kB │ gzip:   6.35 kB
../dist/public/assets/razor-Uh8Bk_45.js                          27.51 kB │ gzip:   3.57 kB
../dist/public/assets/scala-C151Ov-r.js                          28.88 kB │ gzip:   3.94 kB
../dist/public/assets/night-owl-C39BiMTA.js                      28.91 kB │ gzip:   5.16 kB
../dist/public/assets/layout-DkJulWQW.js                         29.29 kB │ gzip:  10.52 kB
../dist/public/assets/crystal-tKQVLTB8.js                        29.39 kB │ gzip:   4.44 kB
../dist/public/assets/mermaid-mWjccvbQ.js                        29.51 kB │ gzip:   3.66 kB
../dist/public/assets/ChanPanel-Bp64UMKM.js                      29.54 kB │ gzip:   4.86 kB
../dist/public/assets/applescript-Co6uUVPk.js                    29.57 kB │ gzip:   5.93 kB
../dist/public/assets/gitGraphDiagram-UUTBAWPF-Do4l7aFE.js       29.57 kB │ gzip:   8.78 kB
../dist/public/assets/timeline-definition-GMOUNBTQ-B4tVU4sM.js   30.93 kB │ gzip:  10.20 kB
../dist/public/assets/julia-CxzCAyBv.js                          31.07 kB │ gzip:   4.33 kB
../dist/public/assets/stylus-BEDo0Tqx.js                         31.07 kB │ gzip:   7.99 kB
../dist/public/assets/requirementDiagram-MS252O5E-CFvtToTG.js    31.10 kB │ gzip:   9.79 kB
../dist/public/assets/poimandres-CS3Unz2-.js                     33.49 kB │ gzip:   5.50 kB
../dist/public/assets/one-dark-pro-DVMEJ2y_.js                   33.79 kB │ gzip:   5.52 kB
../dist/public/assets/bsl-BO_Y6i37.js                            33.87 kB │ gzip:   8.35 kB
../dist/public/assets/quadrantDiagram-34T5L4WZ-APUlgfCt.js       33.94 kB │ gzip:  10.00 kB
../dist/public/assets/haxe-CzTSHFRz.js                           35.16 kB │ gzip:   5.91 kB
../dist/public/assets/nginx-BpAMiNFr.js                          35.37 kB │ gzip:   4.43 kB
../dist/public/assets/houston-DnULxvSX.js                        35.42 kB │ gzip:   5.78 kB
../dist/public/assets/tokyo-night-hegEt444.js                    35.67 kB │ gzip:   6.24 kB
../dist/public/assets/chunk-OYMX7WX6-D1GxL3ue.js                 36.98 kB │ gzip:  12.04 kB
../dist/public/assets/erlang-DsQrWhSR.js                         37.48 kB │ gzip:   4.40 kB
../dist/public/assets/cobol-nwyudZeR.js                          39.15 kB │ gzip:  10.87 kB
../dist/public/assets/xychartDiagram-5P7HB3ND-BOwgClnV.js        39.27 kB │ gzip:  11.14 kB
../dist/public/assets/asm-D_Q5rh1f.js                            40.72 kB │ gzip:   8.21 kB
../dist/public/assets/shellscript-Yzrsuije.js                    41.48 kB │ gzip:   6.09 kB
../dist/public/assets/haskell-Df6bDoY_.js                        41.49 kB │ gzip:   6.44 kB
../dist/public/assets/vennDiagram-DHZGUBPP-CMDBN9GZ.js           41.52 kB │ gzip:  15.52 kB
../dist/public/assets/perl-C0TMdlhV.js                           43.16 kB │ gzip:   4.67 kB
../dist/public/assets/d-85-TOEBH.js                              43.80 kB │ gzip:   8.47 kB
../dist/public/assets/ruby-Dw2BHqvy.js                           45.95 kB │ gzip:   5.68 kB
../dist/public/assets/go-CxLEBnE3.js                             46.81 kB │ gzip:   5.18 kB
../dist/public/assets/apex-D8_7TLub.js                           46.99 kB │ gzip:   6.77 kB
../dist/public/assets/chunk-4TB4RGXK-D_TieMeW.js                 47.24 kB │ gzip:  15.13 kB
../dist/public/assets/catppuccin-mocha-D87Tk5Gz.js               47.26 kB │ gzip:   8.00 kB
../dist/public/assets/catppuccin-latte-C9dUb6Cb.js               47.26 kB │ gzip:   8.00 kB
../dist/public/assets/catppuccin-frappe-DFWUc33u.js              47.26 kB │ gzip:   8.02 kB
../dist/public/assets/catppuccin-macchiato-DQyhUUbL.js           47.26 kB │ gzip:   8.01 kB
../dist/public/assets/ada-bCR0ucgS.js                            48.08 kB │ gzip:   6.03 kB
../dist/public/assets/css-DPfMkruS.js                            49.02 kB │ gzip:  11.85 kB
../dist/public/assets/imba-DGztddWO.js                           49.93 kB │ gzip:   9.46 kB
../dist/public/assets/Dashboard-y-dLm0RO.js                      53.31 kB │ gzip:  16.74 kB
../dist/public/assets/everforest-dark-BgDCqdQA.js                53.75 kB │ gzip:   8.42 kB
../dist/public/assets/everforest-light-C8M2exoo.js               53.75 kB │ gzip:   8.42 kB
../dist/public/assets/ganttDiagram-T4ZO3ILL-D-dx_Mye.js          54.68 kB │ gzip:  18.93 kB
../dist/public/assets/wikitext-BhOHFoWU.js                       55.89 kB │ gzip:   4.76 kB
../dist/public/assets/SmcPanel-DAPDkfI1.js                       56.11 kB │ gzip:  10.30 kB
../dist/public/assets/stata-BH5u7GGu.js                          56.99 kB │ gzip:  12.36 kB
../dist/public/assets/html-GMplVEZG.js                           57.25 kB │ gzip:  11.69 kB
../dist/public/assets/ballerina-BFfxhgS-.js                      58.69 kB │ gzip:   8.15 kB
../dist/public/assets/markdown-Cvjx9yec.js                       59.34 kB │ gzip:   5.64 kB
../dist/public/assets/flowDiagram-DWJPFMVM-DCIkbJla.js           60.59 kB │ gzip:  19.42 kB
../dist/public/assets/ocaml-C0hk2d4L.js                          62.45 kB │ gzip:   5.02 kB
../dist/public/assets/PaPanel-CsEeqsFm.js                        68.75 kB │ gzip:  15.97 kB
../dist/public/assets/mojo-rZm6bMo-.js                           69.80 kB │ gzip:   9.27 kB
../dist/public/assets/python-B6aJPvgy.js                         69.95 kB │ gzip:   9.13 kB
../dist/public/assets/c4Diagram-AHTNJAMY-CF6NT2Zx.js             70.04 kB │ gzip:  19.68 kB
../dist/public/assets/blockDiagram-DXYQGD6D-CNV_EpiW.js          71.00 kB │ gzip:  20.31 kB
../dist/public/assets/c-BIGW1oBm.js                              72.11 kB │ gzip:  10.51 kB
../dist/public/assets/latex-CWtU0Tv5.js                          72.64 kB │ gzip:   6.72 kB
../dist/public/assets/vyper-CDx5xZoG.js                          74.65 kB │ gzip:  10.74 kB
../dist/public/assets/hack-CaT9iCJl.js                           80.24 kB │ gzip:  26.21 kB
../dist/public/assets/cose-bilkent-S5V4N54A-BzwnV1_B.js          81.80 kB │ gzip:  22.53 kB
../dist/public/assets/swift-D82vCrfD.js                          86.69 kB │ gzip:  14.73 kB
../dist/public/assets/fortran-free-form-BxgE0vQu.js              88.97 kB │ gzip:  11.27 kB
../dist/public/assets/csharp-COcwbKMJ.js                         89.69 kB │ gzip:  10.69 kB
../dist/public/assets/racket-BqYA7rlc.js                         92.39 kB │ gzip:  15.02 kB
../dist/public/assets/less-B1dDrJ26.js                           97.63 kB │ gzip:  14.70 kB
../dist/public/assets/blade-D4QpJJKB.js                         104.98 kB │ gzip:  28.20 kB
../dist/public/assets/objective-c-DXmwc3jG.js                   105.41 kB │ gzip:  23.33 kB
../dist/public/assets/php-Dhbhpdrm.js                           111.06 kB │ gzip:  28.52 kB
../dist/public/assets/sequenceDiagram-FGHM5R23-PJ4wrkM0.js      116.73 kB │ gzip:  31.00 kB
../dist/public/assets/asciidoc-Ve4PFQV2.js                      131.53 kB │ gzip:   9.34 kB
../dist/public/assets/mdx-Cmh6b_Ma.js                           136.11 kB │ gzip:  23.35 kB
../dist/public/assets/architectureDiagram-Q4EWVU46-DsrZt-QL.js  149.43 kB │ gzip:  42.23 kB
../dist/public/assets/objective-cpp-CLxacb5B.js                 171.97 kB │ gzip:  30.62 kB
../dist/public/assets/KlinePanel-CMZx03IH.js                    174.04 kB │ gzip:  55.53 kB
../dist/public/assets/javascript-wDzz0qaB.js                    174.83 kB │ gzip:  16.51 kB
../dist/public/assets/tsx-COt5Ahok.js                           175.54 kB │ gzip:  16.51 kB
../dist/public/assets/jsx-g9-lgVsj.js                           177.79 kB │ gzip:  16.61 kB
../dist/public/assets/typescript-BPQ3VLAy.js                    181.08 kB │ gzip:  16.04 kB
../dist/public/assets/angular-ts-BwZT4LLn.js                    183.82 kB │ gzip:  16.63 kB
../dist/public/assets/vue-vine-CQOfvN7w.js                      190.05 kB │ gzip:  17.98 kB
../dist/public/assets/code-block-IT6T5CEO-COqV1H6N.js           190.07 kB │ gzip:  61.82 kB
../dist/public/assets/wolfram-lXgVvXCa.js                       262.39 kB │ gzip:  77.14 kB
../dist/public/assets/UnifiedStrategyCenterPanel-Cf_C_ncw.js    278.53 kB │ gzip:  52.43 kB
../dist/public/assets/BacktestPanel-DcdZn8jG.js                 362.53 kB │ gzip:  96.64 kB
../dist/public/assets/index-DixpxtVb.js                         410.30 kB │ gzip: 126.94 kB
../dist/public/assets/cytoscape.esm-DkOyvmE4.js                 441.71 kB │ gzip: 141.50 kB
../dist/public/assets/wardley-RL74JXVD-DyzCMrNy.js              492.48 kB │ gzip: 110.06 kB
../dist/public/assets/mermaid.core-BWdJbpNS.js                  540.45 kB │ gzip: 127.05 kB
../dist/public/assets/wasm-CG6Dc4jp.js                          622.34 kB │ gzip: 230.29 kB
../dist/public/assets/cpp-CofmeUqb.js                           626.08 kB │ gzip:  44.82 kB
../dist/public/assets/mermaid-VLURNSYL-BpxuMA3r.js              703.48 kB │ gzip: 214.56 kB
../dist/public/assets/emacs-lisp-C9XAeP06.js                    779.85 kB │ gzip: 196.03 kB
✓ built in 23.48s

  dist/index.js  463.2kb

⚡ Done in 40ms
\n(exit_code=0 duration_seconds=26)
```
\n## pnpm test
```text

> crypto-dashboard@1.0.0 test /home/ubuntu/btcusdt_dashboard_v6
> vitest run


 RUN  v2.1.9 /home/ubuntu/btcusdt_dashboard_v6/client

include: **/*.{test,spec}.?(c|m)[jt]s?(x)
exclude:  **/node_modules/**, **/dist/**, **/cypress/**, **/.{idea,git,cache,output,temp}/**, **/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*

No test files found, exiting with code 1
 ELIFECYCLE  Test failed. See above for more details.
\n(exit_code=1 duration_seconds=2)
```
\n## pnpm audit --audit-level moderate
```text
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ Drizzle ORM has SQL injection via improperly escaped   │
│                     │ SQL identifiers                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ drizzle-orm                                            │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <0.45.2                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=0.45.2                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > drizzle-orm@0.44.7                                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-gpj5-g38j-94v9      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ Axios: Incomplete Fix for CVE-2025-62718 — NO_PROXY    │
│                     │ Protection Bypassed via RFC 1122 Loopback Subnet       │
│                     │ (127.0.0.0/8) in Axios 1.15.0                          │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-pmwg-cvhr-8vh7      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ Axios: Prototype Pollution Gadgets - Response          │
│                     │ Tampering, Data Exfiltration, and Request Hijacking    │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-pf86-5x62-jrwf      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ Axios: Header Injection via Prototype Pollution        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-6chq-wfr3-2hj9      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ Axios has prototype pollution read-side gadgets in     │
│                     │ HTTP adapter that allow credential injection and       │
│                     │ request hijacking                                      │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.2                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.2                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-q8qp-cvcw-x6jj      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ fast-xml-builder allows attribute values with unwanted │
│                     │ quotes to bypass malicious or unwanted attributes      │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-xml-builder                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=1.1.6                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.1.7                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > @aws-sdk/client-s3@3.1030.0 >                      │
│                     │ @aws-sdk/core@3.973.27 > @aws-sdk/xml-builder@3.972.17 │
│                     │ > fast-xml-parser@5.5.8 > fast-xml-builder@1.1.4       │
│                     │                                                        │
│                     │ . > @aws-sdk/client-s3@3.1030.0 >                      │
│                     │ @aws-sdk/credential-provider-node@3.972.30 >           │
│                     │ @aws-sdk/credential-provider-env@3.972.25 >            │
│                     │ @aws-sdk/core@3.973.27 > @aws-sdk/xml-builder@3.972.17 │
│                     │ > fast-xml-parser@5.5.8 > fast-xml-builder@1.1.4       │
│                     │                                                        │
│                     │ . > @aws-sdk/client-s3@3.1030.0 >                      │
│                     │ @aws-sdk/credential-provider-node@3.972.30 >           │
│                     │ @aws-sdk/credential-provider-http@3.972.27 >           │
│                     │ @aws-sdk/core@3.973.27 > @aws-sdk/xml-builder@3.972.17 │
│                     │ > fast-xml-parser@5.5.8 > fast-xml-builder@1.1.4       │
│                     │                                                        │
│                     │ ... Found 45 paths, run `pnpm why fast-xml-builder`    │
│                     │ for more information                                   │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-5wm8-gmm8-39j9      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ esbuild enables any website to send any requests to    │
│                     │ the development server and read the response           │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ esbuild                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=0.24.2                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=0.25.0                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > drizzle-kit@0.31.10 >                              │
│                     │ @esbuild-kit/esm-loader@2.6.5 >                        │
│                     │ @esbuild-kit/core-utils@3.3.2 > esbuild@0.18.20        │
│                     │                                                        │
│                     │ . > vitest@2.1.9 > @vitest/mocker@2.1.9 > vite@5.4.21  │
│                     │ > esbuild@0.21.5                                       │
│                     │                                                        │
│                     │ . > vitest@2.1.9 > vite@5.4.21 > esbuild@0.21.5        │
│                     │                                                        │
│                     │ ... Found 4 paths, run `pnpm why esbuild` for more     │
│                     │ information                                            │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-67mh-4wv8-2f99      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Vite Vulnerable to Path Traversal in Optimized Deps    │
│                     │ `.map` Handling                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ vite                                                   │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=6.4.1                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=6.4.2                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > vitest@2.1.9 > @vitest/mocker@2.1.9 > vite@5.4.21  │
│                     │                                                        │
│                     │ . > vitest@2.1.9 > vite@5.4.21                         │
│                     │                                                        │
│                     │ . > vitest@2.1.9 > vite-node@2.1.9 > vite@5.4.21       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-4w7w-66w2-5vf9      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Axios: Authentication Bypass via Prototype Pollution   │
│                     │ Gadget in `validateStatus` Merge Strategy              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-w9j2-pvgh-6h63      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Axios: Invisible JSON Response Tampering via Prototype │
│                     │ Pollution Gadget in `parseReviver`                     │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.2                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.2                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-3w6x-2g7m-8v23      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Axios: CRLF Injection in multipart/form-data body via  │
│                     │ unsanitized blob.type in formDataToStream              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-445q-vr5w-6q77      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Axios: no_proxy bypass via IP alias allows SSRF        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-m7pr-hjqh-92cm      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Axios: unbounded recursion in toFormData causes DoS    │
│                     │ via deeply nested request data                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-62hf-57xw-28j9      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Axios' HTTP adapter-streamed uploads bypass            │
│                     │ maxBodyLength when maxRedirects: 0                     │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-5c9x-8gcm-mpgx      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Axios: HTTP adapter streamed responses bypass          │
│                     │ maxContentLength                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-vf2m-468p-8v99      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Axios: XSRF Token Cross-Origin Leakage via Prototype   │
│                     │ Pollution Gadget in `withXSRFToken` Boolean Coercion   │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ axios                                                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.0.0 <1.15.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=1.15.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > axios@1.15.0                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-xx6v-rp6x-q39c      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ uuid: Missing buffer bounds check in v3/v5/v6 when buf │
│                     │ is provided                                            │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ uuid                                                   │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=11.0.0 <11.1.1                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=11.1.1                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > streamdown@1.6.11 > mermaid@11.14.0 > uuid@11.1.0  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-w5hq-g745-h8pq      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ fast-xml-parser XMLBuilder: XML Comment and CDATA      │
│                     │ Injection via Unescaped Delimiters                     │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-xml-parser                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <5.7.0                                                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=5.7.0                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > @aws-sdk/client-s3@3.1030.0 >                      │
│                     │ @aws-sdk/core@3.973.27 > @aws-sdk/xml-builder@3.972.17 │
│                     │ > fast-xml-parser@5.5.8                                │
│                     │                                                        │
│                     │ . > @aws-sdk/client-s3@3.1030.0 >                      │
│                     │ @aws-sdk/credential-provider-node@3.972.30 >           │
│                     │ @aws-sdk/credential-provider-env@3.972.25 >            │
│                     │ @aws-sdk/core@3.973.27 > @aws-sdk/xml-builder@3.972.17 │
│                     │ > fast-xml-parser@5.5.8                                │
│                     │                                                        │
│                     │ . > @aws-sdk/client-s3@3.1030.0 >                      │
│                     │ @aws-sdk/credential-provider-node@3.972.30 >           │
│                     │ @aws-sdk/credential-provider-http@3.972.27 >           │
│                     │ @aws-sdk/core@3.973.27 > @aws-sdk/xml-builder@3.972.17 │
│                     │ > fast-xml-parser@5.5.8                                │
│                     │                                                        │
│                     │ ... Found 45 paths, run `pnpm why fast-xml-parser` for │
│                     │ more information                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-gh4j-gqv2-49f6      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Mermaid Gantt Charts are vulnerable to an Infinite     │
│                     │ Loop DoS                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ mermaid                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=11.0.0-alpha.1 <=11.14.0                             │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=11.15.0                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > streamdown@1.6.11 > mermaid@11.14.0                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-6m6c-36f7-fhxh      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Mermaid: Improper sanitization of `classDefs` in       │
│                     │ diagrams leads to CSS injection                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ mermaid                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=11.0.0-alpha.1 <=11.14.0                             │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=11.15.0                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > streamdown@1.6.11 > mermaid@11.14.0                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-xcj9-5m2h-648r      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Mermaid: Improper sanitization of configuration leads  │
│                     │ to CSS injection                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ mermaid                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=11.0.0-alpha.1 <=11.14.0                             │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=11.15.0                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > streamdown@1.6.11 > mermaid@11.14.0                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-87f9-hvmw-gh4p      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ Mermaid: Improper sanitization of `classDef` in state  │
│                     │ diagrams leads to HTML injection                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ mermaid                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=11.0.0-alpha.1 <=11.14.0                             │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=11.15.0                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ . > streamdown@1.6.11 > mermaid@11.14.0                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-ghcm-xqfw-q4vr      │
└─────────────────────┴────────────────────────────────────────────────────────┘
24 vulnerabilities found
Severity: 1 low | 17 moderate | 6 high
\n(exit_code=1 duration_seconds=5)
```
