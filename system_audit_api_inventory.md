# API 與資料流盤點
\n## Express REST routes
server/_core/index.ts:61:  app.get("/health", healthHandler);
server/_core/index.ts:62:  app.get("/api/health", healthHandler);
server/_core/index.ts:67:  app.get("/api/latest-live-snapshot", async (_req, res) => {
server/_core/index.ts:87:  app.get("/api/diagnostics-summary", async (_req, res) => {
server/_core/oauth.ts:13:  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
\n## tRPC router exports/procedures
server/routers.ts:2: * routers.ts — tRPC 路由
server/routers.ts:8:import { publicProcedure, router } from "./_core/trpc";
server/routers.ts:330:export const appRouter = router({
server/routers.ts:333:  auth: router({
server/routers.ts:334:    me: publicProcedure.query((opts) => opts.ctx.user),
server/routers.ts:335:    logout: publicProcedure.mutation(({ ctx }) => {
server/routers.ts:342:  crypto: router({
server/routers.ts:344:    triggerAnalysis: publicProcedure
server/routers.ts:367:    getAnalysisStatus: publicProcedure
server/routers.ts:377:    getSnapshot: publicProcedure
server/routers.ts:410:    getKlines: publicProcedure
server/routers.ts:440:    getOnchain: publicProcedure
server/routers.ts:462:  news: router({
server/routers.ts:463:    getLatestNews: publicProcedure
server/routers.ts:620:  tweets: router({
server/routers.ts:621:    getLatestTweets: publicProcedure
server/routers.ts:751:  backtest: router({
server/routers.ts:752:    run: publicProcedure
server/routers.ts:881:    compare: publicProcedure
server/routers.ts:1023:    history: publicProcedure
server/routers.ts:1031:    walkForward: publicProcedure
server/routers.ts:1081:  highWinRate: router({
server/routers.ts:1082:    scan: publicProcedure
server/routers.ts:1182:  screener: router({
server/routers.ts:1183:    scanAll: publicProcedure
server/routers.ts:1290:  heatmap: router({
server/routers.ts:1291:    getMarketOverview: publicProcedure
server/routers.ts:1334:  alerts: router({
server/routers.ts:1335:    checkAlerts: publicProcedure
server/routers.ts:1404:    checkCompositeAlerts: publicProcedure
server/routers.ts:1487:  widgets: router({
server/routers.ts:1488:    getPrefs: publicProcedure
server/routers.ts:1495:    savePrefs: publicProcedure
server/routers.ts:1516:  panda: router({
server/routers.ts:1517:    scan: publicProcedure
server/routers.ts:1537:    backtest: publicProcedure
server/routers.ts:1562:  champion: router({
server/routers.ts:1563:    analyze: publicProcedure
server/routers.ts:1802:  cannonball: router({
server/routers.ts:1803:    analyze: publicProcedure
server/routers.ts:1837:  combo: router({
server/routers.ts:1838:    liveSignal: publicProcedure
server/_core/context.ts:19:    // Authentication is optional for public procedures.
server/_core/index.ts:8:import { appRouter } from "../routers";
server/_core/index.ts:115:      router: appRouter,
server/_core/systemRouter.ts:3:import { adminProcedure, publicProcedure, router } from "./trpc";
server/_core/systemRouter.ts:6:export const systemRouter = router({
server/_core/systemRouter.ts:7:  health: publicProcedure
server/_core/systemRouter.ts:18:  config: publicProcedure.query(() => ({
server/_core/trpc.ts:10:export const router = t.router;
server/_core/trpc.ts:11:export const publicProcedure = t.procedure;
server/_core/trpc.ts:28:export const protectedProcedure = t.procedure.use(requireUser);
server/_core/trpc.ts:30:export const adminProcedure = t.procedure.use(
server/_core/voiceTranscription.ts:245: * Example tRPC procedure implementation:
server/_core/voiceTranscription.ts:248: * // In server/routers.ts
server/_core/voiceTranscription.ts:251: * export const voiceRouter = router({
server/_core/voiceTranscription.ts:252: *   transcribe: protectedProcedure
\n## client API calls
client/src/_core/hooks/useAuth.ts:2:import { trpc } from "@/lib/trpc";
client/src/_core/hooks/useAuth.ts:3:import { TRPCClientError } from "@trpc/client";
client/src/_core/hooks/useAuth.ts:14:  const utils = trpc.useUtils();
client/src/_core/hooks/useAuth.ts:16:  const meQuery = trpc.auth.me.useQuery(undefined, {
client/src/_core/hooks/useAuth.ts:21:  const logoutMutation = trpc.auth.logout.useMutation({
client/src/_core/hooks/useAuth.ts:81:    refresh: () => meQuery.refetch(),
client/src/components/AIChatBox.tsx:79: *   const chatMutation = trpc.ai.chat.useMutation({
client/src/components/Map.tsx:98:    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`;
client/src/components/panels/AlertsPanel.tsx:6:import { trpc } from "@/lib/trpc";
client/src/components/panels/AlertsPanel.tsx:70:  const checkMutation = trpc.alerts.checkAlerts.useMutation();
client/src/components/panels/BacktestPanel.tsx:2:import { trpc } from "@/lib/trpc";
client/src/components/panels/BacktestPanel.tsx:107:  const runMutation = trpc.backtest.run.useMutation({
client/src/components/panels/CannonballPanel.tsx:11:import { trpc } from "@/lib/trpc";
client/src/components/panels/CannonballPanel.tsx:163:  const { data, isLoading, error, refetch, isFetching } = trpc.cannonball.analyze.useQuery(
client/src/components/panels/CannonballPanel.tsx:207:        <button onClick={() => refetch()} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700">重試</button>
client/src/components/panels/CannonballPanel.tsx:256:          <button onClick={() => refetch()} disabled={isFetching}
client/src/components/panels/ChampionAnalysisPanel.tsx:14:import { trpc } from "@/lib/trpc";
client/src/components/panels/ChampionAnalysisPanel.tsx:139:  const analyzeMutation = trpc.champion.analyze.useMutation({
client/src/components/panels/ComboStrategyPanel.tsx:7:import { trpc } from "@/lib/trpc";
client/src/components/panels/ComboStrategyPanel.tsx:94:  const mutation = trpc.combo.liveSignal.useMutation({
client/src/components/panels/CompositeAlertsPanel.tsx:7:import { trpc } from "@/lib/trpc";
client/src/components/panels/CompositeAlertsPanel.tsx:170:  const checkMutation = trpc.alerts.checkCompositeAlerts.useMutation();
client/src/components/panels/HeatmapPanel.tsx:6:import { trpc } from "@/lib/trpc";
client/src/components/panels/HeatmapPanel.tsx:76:  const { data, isLoading, refetch, dataUpdatedAt } = trpc.heatmap.getMarketOverview.useQuery(
client/src/components/panels/HeatmapPanel.tsx:103:          <button onClick={() => refetch()} disabled={isLoading} className="p-1.5 rounded hover:bg-accent transition-colors">
client/src/components/panels/HighWinRatePanel.tsx:7:import { trpc } from "@/lib/trpc";
client/src/components/panels/HighWinRatePanel.tsx:375:  const scanMutation = trpc.highWinRate.scan.useMutation({
client/src/components/panels/KlinePanel.tsx:3:import { trpc } from "@/lib/trpc";
client/src/components/panels/KlinePanel.tsx:95:  const { data: candles, isLoading } = trpc.crypto.getKlines.useQuery(
client/src/components/panels/NewsPanel.tsx:2:import { trpc } from "@/lib/trpc";
client/src/components/panels/NewsPanel.tsx:121:  const { data: news, isLoading } = trpc.news.getLatestNews.useQuery(
client/src/components/panels/PandaPanel.tsx:8:import { trpc } from "@/lib/trpc";
client/src/components/panels/PandaPanel.tsx:479:  const scanMutation = trpc.panda.scan.useMutation();
client/src/components/panels/PandaPanel.tsx:480:  const backtestMutation = trpc.panda.backtest.useMutation();
client/src/components/panels/ScreenerPanel.tsx:11:import { trpc } from "@/lib/trpc";
client/src/components/panels/ScreenerPanel.tsx:191:  const { data, isLoading, refetch, dataUpdatedAt } = trpc.screener.scanAll.useQuery(
client/src/components/panels/ScreenerPanel.tsx:277:            onClick={() => refetch()}
client/src/components/panels/TweetPanel.tsx:2:import { trpc } from "@/lib/trpc";
client/src/components/panels/TweetPanel.tsx:139:  const { data: tweets, isLoading, refetch, isFetching } = trpc.tweets.getLatestTweets.useQuery(
client/src/components/panels/TweetPanel.tsx:197:              onClick={() => refetch()}
client/src/components/panels/VolumeProfilePanel.tsx:7:import { trpc } from "@/lib/trpc";
client/src/components/panels/VolumeProfilePanel.tsx:130:  const { data, isLoading, refetch, dataUpdatedAt } = trpc.screener.scanAll.useQuery(
client/src/components/panels/VolumeProfilePanel.tsx:179:          <button onClick={() => refetch()} disabled={isLoading} className="p-1.5 rounded hover:bg-accent transition-colors">
client/src/components/ui/carousel.tsx:64:    setCanScrollPrev(api.canScrollPrev());
client/src/components/ui/carousel.tsx:65:    setCanScrollNext(api.canScrollNext());
client/src/components/ui/carousel.tsx:97:    api.on("reInit", onSelect);
client/src/components/ui/carousel.tsx:98:    api.on("select", onSelect);
client/src/const.ts:13:  const redirectUri = `${window.location.origin}/api/oauth/callback`;
client/src/lib/trpc.ts:1:import { createTRPCReact } from "@trpc/react-query";
client/src/lib/trpc.ts:4:export const trpc = createTRPCReact<AppRouter>();
client/src/main.tsx:1:import { trpc } from "@/lib/trpc";
client/src/main.tsx:4:import { httpBatchLink, TRPCClientError } from "@trpc/client";
client/src/main.tsx:40:const trpcClient = trpc.createClient({
client/src/main.tsx:43:      url: "/api/trpc",
client/src/main.tsx:45:      fetch(input, init) {
client/src/main.tsx:46:        return globalThis.fetch(input, {
client/src/main.tsx:56:  <trpc.Provider client={trpcClient} queryClient={queryClient}>
client/src/main.tsx:60:  </trpc.Provider>
client/src/pages/ComponentShowcase.tsx:222:        content: `This is a **demo response**. In a real app, you would call a tRPC mutation here:\n\n\`\`\`typescript\nconst chatMutation = trpc.ai.chat.useMutation({\n  onSuccess: (response) => {\n    setChatMessages(prev => [...prev, {\n      role: "assistant",\n      content: response.choices[0].message.content\n    }]);\n  }\n});\n\nchatMutation.mutate({ messages: newMessages });\n\`\`\`\n\nYour message was: "${content}"`,
client/src/pages/Dashboard.tsx:2:import { trpc } from "@/lib/trpc";
client/src/pages/Dashboard.tsx:40:  const { data: snapshot, isLoading: isAnalyzing } = trpc.crypto.getSnapshot.useQuery(
client/src/pages/Dashboard.tsx.bak:2:import { trpc } from "@/lib/trpc";
client/src/pages/Dashboard.tsx.bak:113:  const widgetPrefsQuery = trpc.widgets.getPrefs.useQuery(
client/src/pages/Dashboard.tsx.bak:117:  const saveWidgetPrefsMutation = trpc.widgets.savePrefs.useMutation();
client/src/pages/Dashboard.tsx.bak:124:  const utils = trpc.useUtils();
client/src/pages/Dashboard.tsx.bak:141:      const result = await utils.crypto.getSnapshot.fetch({ symbol }, { staleTime: 0 });
