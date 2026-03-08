/**
 * OpenClaw Skill: ci-failure-analyzer
 * When your CI/CD pipeline fails, this skill reads the logs,
 * explains what broke in plain English, and suggests the fix.
 *
 * Supports: GitHub Actions, GitLab CI, CircleCI, Jenkins
 */

const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");

module.exports = {
  name: "ci-failure-analyzer",
  version: "1.0.0",
  description: "Reads CI/CD failure logs and explains what broke + how to fix it",
  category: "developer",
  triggers: ["why did CI fail", "CI is broken", "analyze CI failure", "build failed"],
  config: {
    ANTHROPIC_API_KEY: { required: true },
    GITHUB_TOKEN: { required: false, description: "For GitHub Actions logs" },
  },

  async execute(input, context) {
    const claude = new Anthropic({ apiKey: context.config.ANTHROPIC_API_KEY });

    // Extract log content from input or URL
    let logs = input.logs || input.text || "";

    if (input.run_url && context.config.GITHUB_TOKEN) {
      try {
        logs = await fetchGitHubActionsLogs(input.run_url, context.config.GITHUB_TOKEN);
      } catch (e) {
        logs = `Could not fetch logs: ${e.message}`;
      }
    }

    if (!logs || logs.length < 10) {
      return { error: "No logs provided. Paste the CI failure log or provide a GitHub Actions run URL." };
    }

    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Analyze this CI/CD failure log. Explain:
1. What exactly failed (be specific)
2. Why it failed (root cause)
3. How to fix it (exact steps)
4. How to prevent it in future

Keep it concise and actionable. Format with markdown.

\`\`\`
${logs.slice(-4000)}
\`\`\``,
      }],
    });

    return {
      analysis: response.content[0].text,
      log_lines_analyzed: logs.split("\n").length,
    };
  },
};

async function fetchGitHubActionsLogs(runUrl, token) {
  // Extract owner/repo/run_id from URL
  const match = runUrl.match(/github\.com\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)/);
  if (!match) throw new Error("Invalid GitHub Actions URL");
  const [, owner, repo, runId] = match;
  const { data } = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
    { headers: { Authorization: `token ${token}` }, responseType: "arraybuffer" }
  );
  return data.toString("utf-8").slice(-6000); // last 6k chars
}
