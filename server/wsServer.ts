/**
 * wsServer.ts — Phase 7：WebSocket 伺服器
 *
 * 架構：
 * 1. 前端連接本伺服器 WebSocket（/ws），訂閱感興趣的幣種
 * 2. 後端以 CryptoCompare REST 輪詢多幣種 ticker（主）+ Binance REST fallback（備）
 * 3. 後端將最新價格轉發給所有訂閱該幣種的前端客戶端
 * 4. 支援多幣種同時訂閱（最多 20 個）
 * 5. 支援狀態訊息、心跳與降級狀態回報
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

// ── 訊息類型定義 ──
export interface WsTickerMsg {
  type: "ticker";
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  ts: number;
}

export interface WsSubscribeMsg {
  type: "subscribe";
  symbols: string[];
}

export interface WsUnsubscribeMsg {
  type: "unsubscribe";
  symbols: string[];
}

export interface WsPingMsg {
  type: "ping";
}

export interface WsPongMsg {
  type: "pong";
  ts: number;
}

export interface WsStatusMsg {
  type: "status";
  connected: boolean;
  subscribedSymbols: string[];
  clientCount: number;
  provider?: "binance_polling" | "none";
  marketDataConnected?: boolean;
  lastUpdateTs?: number | null;
  message?: string | null;
}

type ClientMsg = WsSubscribeMsg | WsUnsubscribeMsg | WsPingMsg;

// ── 客戶端訂閱狀態 ──
interface ClientState {
  ws: WebSocket;
  subscribedSymbols: Set<string>;
  lastPing: number;
}

// BinanceTicker24h interface removed — Binance REST blocked on Render

interface CryptoCompareRaw {
  PRICE: number;
  CHANGEPCT24HOUR: number;
  HIGH24HOUR: number;
  LOW24HOUR: number;
  VOLUME24HOURTO: number;
}

// ── 市場資料狀態 ──
interface MarketDataState {
  refreshTimer: ReturnType<typeof setInterval> | null;
  isRefreshing: boolean;
  subscribedSymbols: Set<string>;
  lastError: string | null;
  lastUpdateTs: number | null;
  provider: "binance_polling" | "none";
}

const MAX_SYMBOLS_PER_STREAM = 20;
const HEARTBEAT_INTERVAL = 30_000;
const BINANCE_POLL_INTERVAL = 12_000; // 稍微縮短輪詢間隔提高即時感
const MARKET_STALE_MS = 60_000;  // 放寬過期判定（60秒），減少警告頻率
const clients = new Map<string, ClientState>();
const CRYPTOCOMPARE_BASE = "https://min-api.cryptocompare.com/data/pricemultifull";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3/simple/price";
const COINGECKO_COIN_MAP: Record<string, string> = {
  BTCUSDT: "bitcoin", ETHUSDT: "ethereum", BNBUSDT: "binancecoin",
  SOLUSDT: "solana", XRPUSDT: "ripple", ADAUSDT: "cardano",
  DOGEUSDT: "dogecoin", AVAXUSDT: "avalanche-2", DOTUSDT: "polkadot",
  LINKUSDT: "chainlink",
};

// CryptoCompare symbol map: BTCUSDT -> BTC
function toCryptoCompareSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/USDT$/, "").replace(/BUSD$/, "").replace(/USD$/, "");
}

const marketDataState: MarketDataState = {
  refreshTimer: null,
  isRefreshing: false,
  subscribedSymbols: new Set(),
  lastError: null,
  lastUpdateTs: null,
  provider: "binance_polling",
};

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function generateClientId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getActiveSymbols(): string[] {
  const symbols = new Set<string>();
  clients.forEach((client) => {
    client.subscribedSymbols.forEach((s) => symbols.add(s));
  });
  return Array.from(symbols).slice(0, MAX_SYMBOLS_PER_STREAM);
}

function isMarketDataConnected(): boolean {
  return !!marketDataState.lastUpdateTs && Date.now() - marketDataState.lastUpdateTs < MARKET_STALE_MS;
}

function createStatusMessage(clientState?: ClientState): WsStatusMsg {
  return {
    type: "status",
    connected: true,
    subscribedSymbols: clientState ? Array.from(clientState.subscribedSymbols) : [],
    clientCount: clients.size,
    provider: marketDataState.subscribedSymbols.size > 0 ? (marketDataState.provider === "binance_polling" ? "cryptocompare_polling" : marketDataState.provider) : "none",
    marketDataConnected: isMarketDataConnected(),
    lastUpdateTs: marketDataState.lastUpdateTs,
    message: isMarketDataConnected() ? null : marketDataState.lastError, // 連接中就不顯示錯誤，減少干擾
  };
}

function sendStatus(ws: WebSocket, clientState?: ClientState) {
  try {
    ws.send(JSON.stringify(createStatusMessage(clientState)));
  } catch {
    // ignore send errors
  }
}

function broadcastStatus() {
  clients.forEach((client) => {
    sendStatus(client.ws, client);
  });
}

function broadcastTicker(msg: WsTickerMsg) {
  const data = JSON.stringify(msg);
  clients.forEach((client) => {
    if (client.subscribedSymbols.has(msg.symbol) && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(data);
      } catch {
        // ignore send errors
      }
    }
  });
}

// Binance ticker removed — blocked on Render (HTTP 451/403)
// Using CryptoCompare (primary) + CoinGecko (fallback) instead

async function fetchCryptoCompareTicker(symbol: string): Promise<WsTickerMsg> {
  const fsym = toCryptoCompareSymbol(symbol);
  const url = `${CRYPTOCOMPARE_BASE}?fsyms=${fsym}&tsyms=USDT`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 CryptoDashboard/7.0" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`CryptoCompare HTTP ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { RAW?: Record<string, Record<string, CryptoCompareRaw>> };
  const raw = payload.RAW?.[fsym]?.["USDT"];
  if (!raw) throw new Error(`CryptoCompare 無資料：${symbol}`);

  const price = raw.PRICE;
  const change24h = raw.CHANGEPCT24HOUR;
  const high24h = raw.HIGH24HOUR;
  const low24h = raw.LOW24HOUR;
  const volume24h = raw.VOLUME24HOURTO;

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`CryptoCompare ticker 價格無效：${symbol}`);
  }

  return {
    type: "ticker",
    symbol,
    price,
    change24h: Number.isFinite(change24h) ? change24h : 0,
    high24h: Number.isFinite(high24h) ? high24h : price,
    low24h: Number.isFinite(low24h) ? low24h : price,
    volume24h: Number.isFinite(volume24h) ? volume24h : 0,
    ts: Date.now(),
  };
}

async function fetchCoinGeckoTicker(symbol: string): Promise<WsTickerMsg> {
  const coinId = COINGECKO_COIN_MAP[symbol.toUpperCase()] ?? "bitcoin";
  const url = `${COINGECKO_BASE}?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_low_24h=true`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 CryptoDashboard/7.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const data = (await response.json()) as Record<string, Record<string, number>>;
  const coin = data[coinId];
  if (!coin) throw new Error(`CoinGecko 無資料：${symbol}`);
  const price = coin["usd"];
  if (!Number.isFinite(price) || price <= 0) throw new Error(`CoinGecko 價格無效：${symbol}`);
  return {
    type: "ticker",
    symbol,
    price,
    change24h: coin["usd_24h_change"] ?? 0,
    high24h: coin["usd_24h_high"] ?? price,
    low24h: coin["usd_24h_low"] ?? price,
    volume24h: coin["usd_24h_vol"] ?? 0,
    ts: Date.now(),
  };
}

async function fetchTickerWithFallback(symbol: string): Promise<WsTickerMsg> {
  try {
    return await fetchCryptoCompareTicker(symbol);
  } catch (ccErr) {
    console.warn(`[WS] CryptoCompare 失敗，嘗試 CoinGecko：${ccErr instanceof Error ? ccErr.message : String(ccErr)}`);
    try {
      return await fetchCoinGeckoTicker(symbol);
    } catch (cgErr) {
      throw new Error(`所有 ticker 來源均失敗 - CC: ${ccErr instanceof Error ? ccErr.message : ccErr} | CG: ${cgErr instanceof Error ? cgErr.message : cgErr}`);
    }
  }
}

async function refreshMarketData(symbols: string[]) {
  if (symbols.length === 0 || marketDataState.isRefreshing) return;

  marketDataState.isRefreshing = true;
  try {
    const results = await Promise.allSettled(symbols.map((symbol) => fetchTickerWithFallback(symbol)));
    let successCount = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
        broadcastTicker(result.value);
      } else {
        errors.push(`${symbols[index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    });

    if (successCount > 0) {
      marketDataState.lastUpdateTs = Date.now();
      marketDataState.lastError = errors.length > 0 ? `部分幣種更新失敗：${errors.slice(0, 3).join(" | ")}` : null;
    } else if (errors.length > 0) {
      marketDataState.lastError = `即時資料更新失敗：${errors.slice(0, 3).join(" | ")}`;
    }
  } catch (error) {
    marketDataState.lastError = error instanceof Error ? error.message : String(error);
  } finally {
    marketDataState.isRefreshing = false;
    broadcastStatus();
  }
}

function stopMarketPolling() {
  if (marketDataState.refreshTimer) {
    clearInterval(marketDataState.refreshTimer);
    marketDataState.refreshTimer = null;
  }
  marketDataState.subscribedSymbols.clear();
}

function startMarketPolling(symbols: string[]) {
  stopMarketPolling();

  if (symbols.length === 0) {
    marketDataState.provider = "none";
    marketDataState.lastError = null;
    broadcastStatus();
    return;
  }

  marketDataState.provider = "cryptocompare_polling" as any;
  marketDataState.subscribedSymbols = new Set(symbols);
  void refreshMarketData(symbols);
  marketDataState.refreshTimer = setInterval(() => {
    void refreshMarketData(Array.from(marketDataState.subscribedSymbols));
  }, BINANCE_POLL_INTERVAL);
}

function refreshMarketSubscriptions() {
  const activeSymbols = getActiveSymbols();
  const currentSymbols = Array.from(marketDataState.subscribedSymbols).sort().join(",");
  const nextSymbols = [...activeSymbols].sort().join(",");

  if (currentSymbols === nextSymbols && marketDataState.refreshTimer) {
    return;
  }

  startMarketPolling(activeSymbols);
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    const toRemove: string[] = [];

    clients.forEach((client, id) => {
      if (client.ws.readyState !== WebSocket.OPEN) {
        toRemove.push(id);
        return;
      }
      if (now - client.lastPing > 90_000) {
        try {
          client.ws.terminate();
        } catch {}
        toRemove.push(id);
        return;
      }
      try {
        client.ws.ping();
      } catch {}
    });

    toRemove.forEach((id) => {
      clients.delete(id);
      console.log(`[WS] 客戶端 ${id} 已移除（心跳超時）`);
    });

    if (toRemove.length > 0) {
      refreshMarketSubscriptions();
    }
  }, HEARTBEAT_INTERVAL);
}

export function initWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
  });

  console.log("[WS] WebSocket 伺服器已初始化，路徑: /ws");
  startHeartbeat();

  wss.on("connection", (ws, req) => {
    const clientId = generateClientId();
    const clientIp = req.socket.remoteAddress ?? "unknown";
    const clientState: ClientState = {
      ws,
      subscribedSymbols: new Set(),
      lastPing: Date.now(),
    };
    clients.set(clientId, clientState);

    console.log(`[WS] 新客戶端連接: ${clientId} (${clientIp})，當前 ${clients.size} 個連接`);
    sendStatus(ws, clientState);

    ws.on("pong", () => {
      clientState.lastPing = Date.now();
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMsg;
        switch (msg.type) {
          case "subscribe": {
            const symbols = (msg.symbols ?? [])
              .map((s: string) => s.toUpperCase())
              .filter((s: string) => /^[A-Z0-9]+USDT$/.test(s))
              .slice(0, 10);

            // 去重：若訂閱列表未變更，則跳過（避免前端 React re-render 觸發大量重複訂閱）
            const newSymbolsKey = [...symbols].sort().join(",");
            const oldSymbolsKey = Array.from(clientState.subscribedSymbols).sort().join(",");
            if (newSymbolsKey === oldSymbolsKey) {
              sendStatus(ws, clientState); // 仍回傳狀態，但不重新訂閱
              break;
            }

            clientState.subscribedSymbols = new Set(symbols);
            refreshMarketSubscriptions();
            sendStatus(ws, clientState);
            console.log(`[WS] 客戶端 ${clientId} 訂閱: ${symbols.join(", ")}`);
            break;
          }

          case "unsubscribe": {
            const symbols = (msg.symbols ?? []).map((s: string) => s.toUpperCase());
            symbols.forEach((s: string) => clientState.subscribedSymbols.delete(s));
            refreshMarketSubscriptions();
            sendStatus(ws, clientState);
            break;
          }

          case "ping": {
            clientState.lastPing = Date.now();
            const pong: WsPongMsg = { type: "pong", ts: Date.now() };
            try {
              ws.send(JSON.stringify(pong));
            } catch {}
            break;
          }
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
      console.log(`[WS] 客戶端 ${clientId} 斷開，剩餘 ${clients.size} 個連接`);
      refreshMarketSubscriptions();
    });

    ws.on("error", () => {
      clients.delete(clientId);
      refreshMarketSubscriptions();
    });
  });

  process.on("SIGTERM", () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    stopMarketPolling();
    wss.close();
  });

  return wss;
}

export function getWsServerStats() {
  return {
    clientCount: clients.size,
    marketDataConnected: isMarketDataConnected(),
    provider: marketDataState.subscribedSymbols.size > 0 ? marketDataState.provider : "none",
    subscribedSymbols: Array.from(marketDataState.subscribedSymbols),
    lastUpdateTs: marketDataState.lastUpdateTs,
    lastError: marketDataState.lastError,
  };
}
