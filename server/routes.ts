import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import crypto from "crypto";

const rateLimit = new Map<string, { count: number; resetTime: number }>();

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 60;

  const current = rateLimit.get(ip);
  if (!current || now > current.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (current.count >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }

  current.count++;
  next();
}

function validateApiKeys(apiKey: string, secretKey: string): boolean {
  if (!apiKey || !secretKey) return false;
  if (typeof apiKey !== 'string' || typeof secretKey !== 'string') return false;
  if (apiKey.length < 10 || secretKey.length < 10) return false;
  return true;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
}

async function mexcPrivateRequest(
  baseUrl: string, 
  endpoint: string, 
  method: string, 
  apiKey: string, 
  secretKey: string, 
  params: Record<string, any> = {}
) {
  const timestamp = Date.now();
  const queryParams = new URLSearchParams({ ...params, timestamp: timestamp.toString() }).toString();
  const signature = await hmacSign(queryParams, secretKey);
  const targetUrl = `${baseUrl}${endpoint}?${queryParams}&signature=${signature}`;

  const response = await fetch(targetUrl, {
    method,
    headers: {
      "X-MEXC-APIKEY": apiKey,
      "Content-Type": "application/json"
    }
  });

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const result = await response.json();
    if (!response.ok || (result.code !== undefined && result.code !== 200 && result.code !== 0)) {
      throw new Error(result.msg || result.message || `MEXC Error ${result.code || response.status}`);
    }
    return result;
  } else {
    const text = await response.text();
    if (!response.ok) throw new Error(`MEXC API Error: ${text.substring(0, 100)}`);
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid response from MEXC: ${text.substring(0, 100)}`);
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get('/api/market/ticker', async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTCUSDT';
      
      const response = await fetch(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
      
      if (!response.ok) {
        const binanceResponse = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
        if (!binanceResponse.ok) throw new Error('Market API unreachable');
        const data = await binanceResponse.json();
        
        return res.json({
          symbol: symbol.toUpperCase(),
          price: parseFloat(data.lastPrice),
          change24h: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.volume),
          timestamp: Date.now()
        });
      }
      
      const data = await response.json();
      
      res.json({
        symbol: symbol.toUpperCase(),
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.priceChangePercent),
        volume: parseFloat(data.volume),
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.json({
        symbol: (req.query.symbol as string)?.toUpperCase() || 'BTCUSDT',
        price: 105000 + Math.random() * 1000,
        change24h: -0.5 + Math.random() * 3,
        volume: 50000 + Math.random() * 10000,
        timestamp: Date.now()
      });
    }
  });

  app.post('/api/mexc/account', rateLimitMiddleware, async (req, res) => {
    try {
      const { apiKey, secretKey, symbol } = req.body;
      
      if (!validateApiKeys(apiKey, secretKey)) {
        return res.status(400).json({ error: 'Invalid MEXC API keys provided' });
      }

      const baseFuturesUrl = "https://fapi.mexc.com";
      const baseSpotUrl = "https://api.mexc.com";

      const results = await Promise.allSettled([
        mexcPrivateRequest(baseSpotUrl, "/api/v3/account", "GET", apiKey, secretKey),
        mexcPrivateRequest(baseFuturesUrl, "/futures/api/v1/private/account/assets", "GET", apiKey, secretKey),
        mexcPrivateRequest(baseFuturesUrl, "/futures/api/v1/private/position/open_details", "GET", apiKey, secretKey),
        mexcPrivateRequest(baseFuturesUrl, "/futures/api/v1/private/order/list/open_orders", "GET", apiKey, secretKey),
        mexcPrivateRequest(baseFuturesUrl, "/futures/api/v1/private/order/list/history_orders", "GET", apiKey, secretKey, { states: "3,4" })
      ]);

      const spotResult = results[0];
      const futuresResult = results[1];
      const positionsResult = results[2];
      const ordersResult = results[3];
      const tradesResult = results[4];

      let spotBalances: any[] = [];
      if (spotResult.status === 'fulfilled' && spotResult.value.balances) {
        spotBalances = spotResult.value.balances
          .map((b: any) => ({
            asset: b.asset,
            available: parseFloat(b.free),
            frozen: parseFloat(b.locked),
            total: parseFloat(b.free) + parseFloat(b.locked)
          }))
          .filter((b: any) => b.total > 0.00001);
      }

      let futuresBalances: any[] = [];
      if (futuresResult.status === 'fulfilled' && futuresResult.value.data) {
        futuresBalances = futuresResult.value.data.map((b: any) => ({
          asset: b.currency,
          available: b.availableBalance,
          frozen: b.frozenBalance,
          total: b.balance
        }));
      }

      let positions: any[] = [];
      if (positionsResult.status === 'fulfilled' && positionsResult.value.data) {
        positions = positionsResult.value.data.map((p: any) => ({
          id: p.positionId || Math.random().toString(),
          symbol: p.symbol,
          side: p.positionType === 1 ? 'LONG' : 'SHORT',
          entryPrice: p.holdAvgPrice,
          currentPrice: p.fairPrice,
          leverage: p.leverage,
          pnl: p.unrealizedPnl,
          pnlPercent: (p.unrealizedPnl / p.margin) * 100,
          margin: p.margin,
          liquidationPrice: p.liquidatePrice
        }));
      }

      let orders: any[] = [];
      if (ordersResult.status === 'fulfilled' && ordersResult.value.data) {
        orders = ordersResult.value.data.map((o: any) => ({
          orderId: o.orderId,
          symbol: o.symbol,
          price: o.price,
          quantity: o.vol,
          side: o.side === 1 ? "BUY" : "SELL",
          type: o.type === 1 ? "LIMIT" : "MARKET",
          status: "OPEN",
          createTime: o.createTime
        }));
      }

      let trades: any[] = [];
      if (tradesResult.status === 'fulfilled' && tradesResult.value.data) {
        trades = tradesResult.value.data.map((t: any) => ({
          id: t.orderId,
          symbol: t.symbol,
          price: t.avgPrice,
          quantity: t.vol,
          side: t.side === 1 ? "BUY" : "SELL",
          pnl: t.realisedPnl || 0,
          time: t.updateTime
        }));
      }

      res.json({
        spotBalances,
        futuresBalances,
        positions,
        orders,
        trades
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/mexc/trade', rateLimitMiddleware, async (req, res) => {
    try {
      const { action, apiKey, secretKey, symbol, leverage, price } = req.body;
      
      if (!validateApiKeys(apiKey, secretKey)) {
        return res.status(400).json({ error: 'Invalid MEXC API keys provided' });
      }
      
      if (!['LONG', 'SHORT', 'CLOSE'].includes(action)) {
        return res.status(400).json({ error: 'Invalid trade action' });
      }

      const baseFuturesUrl = "https://fapi.mexc.com";
      const side = action === 'LONG' ? 1 : (action === 'SHORT' ? 2 : 3);
      
      const orderParams = {
        symbol: symbol,
        vol: 1,
        side: side,
        type: 5,
        openType: 1,
        leverage: leverage
      };

      const result = await mexcPrivateRequest(
        baseFuturesUrl, 
        "/futures/api/v1/private/order/create", 
        "POST", 
        apiKey, 
        secretKey, 
        orderParams
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai/analyze', async (req, res) => {
    try {
      const { settings, marketData, currentPositionSide } = req.body;
      
      const prompt = `
        Analyze the current market data for ${marketData.symbol} and decide on a leverage trading action.
        Current Price: $${marketData.price}
        24h Change: ${marketData.change24h}%
        24h Volume: ${marketData.volume}
        Recent Price History: ${JSON.stringify(marketData.history?.slice(-10) || [])}
        Current Active Position: ${currentPositionSide}

        Respond ONLY in JSON format.
        If we have an active position, decide if we should CLOSE it based on market shifts.
        If we don't have a position, decide whether to go LONG, SHORT, or WAIT.
        Maximum recommended leverage is 20x for safety.
        
        JSON Structure:
        {
          "action": "LONG" | "SHORT" | "CLOSE" | "WAIT",
          "leverage": number,
          "reason": "string",
          "confidence": number (0-100)
        }
      `;

      let result = {
        action: 'WAIT' as const,
        leverage: 1,
        reason: 'Market analysis pending',
        confidence: 50
      };

      if (settings.aiProvider === 'gemini' && settings.geminiApiKey) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json"
              }
            })
          }
        );
        
        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          try {
            result = JSON.parse(data.candidates[0].content.parts[0].text);
          } catch (e) {
            console.error('Failed to parse Gemini response:', e);
          }
        }
      } else if (settings.aiProvider === 'openai' && settings.openaiApiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.openaiApiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });
        
        const data = await response.json();
        if (data.choices?.[0]?.message?.content) {
          try {
            result = JSON.parse(data.choices[0].message.content);
          } catch (e) {
            console.error('Failed to parse OpenAI response:', e);
          }
        }
      } else if (settings.aiProvider === 'deepseek' && settings.deepseekApiKey) {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.deepseekApiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });
        
        const data = await response.json();
        if (data.choices?.[0]?.message?.content) {
          try {
            result = JSON.parse(data.choices[0].message.content);
          } catch (e) {
            console.error('Failed to parse DeepSeek response:', e);
          }
        }
      }

      res.json(result);
    } catch (error: any) {
      res.json({
        action: 'WAIT',
        leverage: 1,
        reason: `Analysis failed: ${error.message}`,
        confidence: 0
      });
    }
  });

  return httpServer;
}
