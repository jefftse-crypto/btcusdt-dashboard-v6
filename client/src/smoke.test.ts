import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf-8");

describe("BTCUSDT Dashboard 主線 smoke test", () => {
  it("保留必要的專案生命週期腳本", () => {
    const pkg = JSON.parse(readProjectFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.check).toBe("tsc --noEmit");
    expect(pkg.scripts?.build).toContain("vite build");
    expect(pkg.scripts?.build).toContain("esbuild server/_core/index.ts");
    expect(pkg.scripts?.start).toBe("NODE_ENV=production node dist/index.js");
    expect(pkg.scripts?.test).toBe("vitest run");
  });

  it("Dashboard 保留桌面與手機主要面板入口", () => {
    const dashboard = readProjectFile("client/src/pages/Dashboard.tsx");
    const requiredTabs = ["indicators", "smc", "pa", "chan", "news"];

    for (const tab of requiredTabs) {
      expect(dashboard).toContain(`id: "${tab}"`);
    }

    expect(dashboard).toContain("IndicatorsPanel");
    expect(dashboard).toContain("SmcPanel");
    expect(dashboard).toContain("PaPanel");
    expect(dashboard).toContain("ChanPanel");
    expect(dashboard).toContain("NewsPanel");
  });

  it("技術指標面板保留四時區並排比較表", () => {
    const indicatorsPanel = readProjectFile("client/src/components/panels/IndicatorsPanel.tsx");

    for (const timeframe of ["4H", "1H", "15m", "5M"]) {
      expect(indicatorsPanel).toContain(timeframe);
    }

    expect(indicatorsPanel).toContain("四時區並排比較");
    expect(indicatorsPanel).toContain("const rows = [");
    expect(indicatorsPanel).toContain("IndicatorComparisonMatrix");
  });
});
