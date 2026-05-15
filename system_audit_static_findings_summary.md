# 靜態檢查、測試與依賴稽核摘要
\n## TypeScript error count by code
     15 error TS2459
     14 error TS2802
      5 error TS2783
      5 error TS2554
      3 error TS2305
      2 error TS2339
      1 error TS7053
      1 error TS2345
      1 error TS2304
\n## TypeScript errors by file
      6 server/run_v4_five_strategy_live.ts
      4 server/backtest_expanded_sweep.ts
      3 server/verify_presets_backtest.ts
      2 server/run_adv_scan.ts
      2 server/diagnostics_engine.ts
      2 server/backtest_htr_v5_realdata_model.ts
      2 server/backtest_htr_v4_tpv_multisymbol.ts
      2 server/backtest_htr_v3_multisymbol.ts
      2 server/backtest_htr_1d_daily.ts
      1 server/verify_presets_v2.ts
      1 server/strategies_archive/manus_scalper_v6_institutional.ts
      1 server/strategies_archive/manus_scalper_v5_1_atr.ts
      1 server/signalScanner.ts
      1 server/run_smart_param_search.ts
      1 server/run_search_groupC.ts
      1 server/run_search_groupB.ts
      1 server/run_search_groupA.ts
      1 server/run_score_tp_scan.ts
      1 server/run_profitable_scan.ts
      1 server/run_full_param_search.ts
      1 server/run_filtered_backtest.ts
      1 server/run_fast_search.ts
      1 server/run_backtest_from_json.ts
      1 server/run_all_strategy_binance.ts
      1 server/run_1d_scan.ts
      1 server/manus_scalper_strategy.ts
      1 server/fetch_and_backtest.ts
      1 server/deep_backtest_180d.ts
      1 server/db.ts
      1 server/backtest_manus_scalper.ts
      1 client/src/components/panels/IndicatorsPanel.tsx
\n## Test section tail
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
\n## Audit section tail
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
\n## Build warnings and completion
\n(exit_code=2 duration_seconds=12)
NODE_ENV=production is not supported in the .env file. Only NODE_ENV=development is supported to create a development build of your project. If you need to set process.env.NODE_ENV, you can set it in the Vite config instead.
rendering chunks...
../dist/public/assets/chunk-QZHKN3VN-COX-clyJ.js                  0.19 kB │ gzip:   0.16 kB
../dist/public/assets/chunk-4BX2VUAB-PSVS9p8l.js                  0.23 kB │ gzip:   0.17 kB
../dist/public/assets/chunk-55IACEB6-Cxn3au4D.js                  0.24 kB │ gzip:   0.21 kB
../dist/public/assets/chunk-FMBD7UC4-CCMpemPM.js                  0.37 kB │ gzip:   0.27 kB
../dist/public/assets/chunk-EDXVE4YY-Cbyhdwzr.js                  0.51 kB │ gzip:   0.36 kB
../dist/public/assets/chunk-YZCP3GAM-CJaE5dEU.js                  1.88 kB │ gzip:   0.83 kB
../dist/public/assets/chunk-OYMX7WX6-D1GxL3ue.js                 36.98 kB │ gzip:  12.04 kB
../dist/public/assets/chunk-4TB4RGXK-D_TieMeW.js                 47.24 kB │ gzip:  15.13 kB
✓ built in 23.48s
⚡ Done in 40ms
\n(exit_code=0 duration_seconds=26)
\n(exit_code=1 duration_seconds=2)
\n(exit_code=1 duration_seconds=5)
