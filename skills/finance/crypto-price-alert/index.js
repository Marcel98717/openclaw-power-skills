/**
 * OpenClaw Skill: crypto-price-alert
 * Monitor crypto prices 24/7 and get notified on your messaging app
 * when prices hit your targets. Set once, runs forever.
 */

const axios = require("axios");

module.exports = {
  name: "crypto-price-alert",
  version: "1.0.0",
  description: "Real-time crypto price alerts via OpenClaw messaging channels",
  category: "finance",
  schedule: "*/5 * * * *", // every 5 minutes
  triggers: ["alert me when BTC", "set price alert", "crypto alert", "notify me when"],
  config: {
    COINGECKO_API_KEY: { required: false, description: "CoinGecko API key (optional, increases rate limits)" },
    DEFAULT_CURRENCY: { default: "usd", description: "Base currency" },
  },

  // Stored alerts format: { id, coin, target_price, direction: 'above'|'below', triggered: false }
  alerts: [],

  async execute(input, context) {
    const text = input.text?.toLowerCase() || "";

    // Parse: "alert me when BTC goes above 100000"
    const match = text.match(/when\s+(\w+)\s+(?:goes?\s+)?(above|below|hits?|reaches?)\s+\$?([\d,]+)/i);
    if (match) {
      const [, coin, direction, priceStr] = match;
      const price = parseFloat(priceStr.replace(/,/g, ""));
      const dir = direction.match(/above|hits?|reaches?/) ? "above" : "below";
      this.alerts.push({ id: Date.now(), coin: coin.toLowerCase(), target_price: price, direction: dir, triggered: false });
      return { message: `✅ Alert set: I'll notify you when **${coin.toUpperCase()}** goes ${dir} **$${price.toLocaleString()}**` };
    }

    // Check all active alerts
    const triggered = await checkAlerts(this.alerts, context.config);
    if (triggered.length > 0) {
      triggered.forEach(a => (a.triggered = true));
      return {
        alerts_triggered: triggered.map(a => a.message),
        message: triggered.map(a => a.message).join("\n"),
      };
    }

    // Show current prices
    const coins = ["bitcoin", "ethereum", "solana"];
    const prices = await getPrices(coins, context.config);
    return {
      message: "💰 Current Prices:\n" + Object.entries(prices).map(([k, v]) => `• **${k.toUpperCase()}**: $${v.toLocaleString()}`).join("\n"),
    };
  },
};

async function getPrices(coins, config) {
  const ids = coins.join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${config.DEFAULT_CURRENCY || "usd"}`;
  const headers = config.COINGECKO_API_KEY ? { "x-cg-demo-api-key": config.COINGECKO_API_KEY } : {};
  const { data } = await axios.get(url, { headers });
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v[config.DEFAULT_CURRENCY || "usd"]]));
}

async function checkAlerts(alerts, config) {
  const activeAlerts = alerts.filter(a => !a.triggered);
  if (activeAlerts.length === 0) return [];

  const coins = [...new Set(activeAlerts.map(a => a.coin))];
  const prices = await getPrices(coins, config);
  const triggered = [];

  for (const alert of activeAlerts) {
    const price = prices[alert.coin];
    if (!price) continue;
    const hit = alert.direction === "above" ? price >= alert.target_price : price <= alert.target_price;
    if (hit) {
      triggered.push({ ...alert, message: `🚨 **${alert.coin.toUpperCase()}** is now $${price.toLocaleString()} — your ${alert.direction} $${alert.target_price.toLocaleString()} alert triggered!` });
    }
  }
  return triggered;
}
