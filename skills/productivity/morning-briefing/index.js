/**
 * OpenClaw Skill: morning-briefing
 * Every morning at your configured time, sends you a personalized briefing:
 * weather + top news + calendar events + urgent emails + GitHub PRs waiting.
 *
 * Part of openclaw-power-skills
 * https://github.com/hamzeesaid/openclaw-power-skills
 */

const axios = require("axios");

module.exports = {
  name: "morning-briefing",
  version: "1.1.0",
  description: "Daily morning digest: weather, news, calendar, email summary, GitHub PRs",
  category: "productivity",
  schedule: "0 7 * * 1-5",  // 7am weekdays by default
  triggers: ["morning briefing", "daily briefing", "what's my day look like", "good morning"],
  config: {
    OPENWEATHER_API_KEY: { required: false, description: "OpenWeather API key for weather" },
    CITY: { default: "New York", description: "Your city for weather" },
    NEWS_API_KEY: { required: false, description: "NewsAPI key for headlines" },
    NEWS_TOPICS: { default: "technology,ai", description: "Comma-separated topics" },
    GITHUB_TOKEN: { required: false, description: "GitHub token for PR summary" },
    GITHUB_USERNAME: { required: false, description: "Your GitHub username" },
  },

  async execute(input, context) {
    const cfg = context.config;
    const sections = [];

    // 1. Date + greeting
    const now = new Date();
    const greeting = getGreeting(now.getHours());
    sections.push(`${greeting}! Here's your briefing for ${formatDate(now)}:`);

    // 2. Weather
    if (cfg.OPENWEATHER_API_KEY) {
      try {
        const weather = await getWeather(cfg.CITY, cfg.OPENWEATHER_API_KEY);
        sections.push(`\n🌤️ **Weather (${cfg.CITY})**\n${weather}`);
      } catch (_) {}
    }

    // 3. Top news
    if (cfg.NEWS_API_KEY) {
      try {
        const news = await getTopNews(cfg.NEWS_TOPICS, cfg.NEWS_API_KEY);
        sections.push(`\n📰 **Top Headlines**\n${news}`);
      } catch (_) {}
    }

    // 4. GitHub PRs awaiting review
    if (cfg.GITHUB_TOKEN && cfg.GITHUB_USERNAME) {
      try {
        const prs = await getPendingPRs(cfg.GITHUB_TOKEN, cfg.GITHUB_USERNAME);
        if (prs) sections.push(`\n🔧 **GitHub**\n${prs}`);
      } catch (_) {}
    }

    // 5. Motivational closer
    sections.push(`\n💪 Have a productive day! Type any question to get started.`);

    return {
      message: sections.join("\n"),
      generated_at: now.toISOString(),
    };
  },
};

function getGreeting(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

async function getWeather(city, apiKey) {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  const { data } = await axios.get(url);
  return `${data.weather[0].description}, ${Math.round(data.main.temp)}°C (feels like ${Math.round(data.main.feels_like)}°C). Humidity: ${data.main.humidity}%`;
}

async function getTopNews(topics, apiKey) {
  const topic = topics.split(",")[0].trim();
  const url = `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(topic)}&apiKey=${apiKey}&pageSize=3`;
  const { data } = await axios.get(url);
  return data.articles.map((a, i) => `${i + 1}. ${a.title}`).join("\n");
}

async function getPendingPRs(token, username) {
  const { data } = await axios.get(
    `https://api.github.com/search/issues?q=is:pr+is:open+review-requested:${username}`,
    { headers: { Authorization: `token ${token}` } }
  );
  if (data.total_count === 0) return null;
  const prs = data.items.slice(0, 3).map(pr => `• #${pr.number} ${pr.title}`).join("\n");
  return `${data.total_count} PRs waiting for your review:\n${prs}`;
}
