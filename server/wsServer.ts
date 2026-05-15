/**
 * wsServer.ts — Phase 7：WebSocket 伺服器
 *
 * 架構：
 * 1. 前端連接本伺服器 WebSocket（/ws），訂閱感興趣的幣種
 * 2. 後端以 Binance REST 輪詢多幣種 ticker（主）+ Bybit fallback（備）
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

interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  openPrice: string;
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
const BINANCE_POLL_INTERVAL = 15_000;
const MARKET_STALE_MS = 45_000;
const clients = new Map<string, ClientState>();
const BINANCE_TICKER_BASE = "https://api.binance.com/api/v3/ticker/24hr";
const BYBIT_TICKER_BASE = "https://api.bybit.com/v5/market/tickers";

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
    provider: marketDataState.subscribedSymbols.size > 0 ? marketDataState.provider : "none",
    marketDataConnected: isMarketDataConnected(),
    lastUpdateTs: marketDataState.lastUpdateTs,
    message: marketDataState.lastError,
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

async function fetchBinanceTicker(symbol: string): Promise<WsTickerMsg> {
  const url = `${BINANCE_TICKER_BASE}?symbol=${symbol.toUpperCase()}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 CryptoDashboard/7.0" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Binance HTTP ${response.status} ${response.statusText}`);
  }

  const ticker = (await response.json()) as BinanceTicker24h;
  const price = Number(ticker.lastPrice);
  const change24h = Number(ticker.priceChangePercent);
  const high24h = Number(ticker.highPrice);
  const low24h = Number(ticker.lowPrice);
  const volume24h = Number(ticker.volume);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Binance ticker 價格無效：${symbol}`);
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

async function fetchBybitTicker(symbol: string): Promise<WsTickerMsg> {
  const url = `${BYBIT_TICKER_BASE}?category=spot&symbol=${symbol.toUpperCase()}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 CryptoDashboard/7.0" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Bybit HTTP ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { retCode: number; result?: { list?: Array<{ lastPrice: string; price24hPcnt: string; highPrice24h: string; lowPrice24h: string; volume24h: string }> } };
  if (payload.retCode !== 0) throw new Error(`Bybit API 錯誤：retCode ${payload.retCode}`);
  const item = payload.result?.list?.[0];
  if (!item) throw new Error(`Bybit ticker 無資料：${symbol}`);

  const price = Number(item.lastPrice);
  const change24h = Number(item.price24hPcnt) * 100;
  const high24h = Number(item.highPrice24h);
  const low24h = Number(item.lowPrice24h);
  const volume24h = Number(item.volume24h);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Bybit ticker 價格無效：${symbol}`);
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

async function fetchTickerWithFallback(symbol: string): Promise<WsTickerMsg> {
  try {
    return await fetchBinanceTicker(symbol);
  } catch (binanceErr) {
    console.warn(`[WS] Binance ticker 失敗，嘗試 Bybit：${binanceErr instanceof Error ? binanceErr.message : String(binanceErr)}`);
    return await fetchBybitTicker(symbol);
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

  marketDataState.provider = "binance_polling";
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
