/**
 * OpenClaw Skill: github-pr-reviewer
 * Automatically reviews GitHub Pull Requests and posts AI-generated
 * inline comments covering security, performance, and code quality.
 *
 * Part of openclaw-power-skills
 * https://github.com/hamzeesaid/openclaw-power-skills
 */

const { Octokit } = require("@octokit/rest");
const Anthropic = require("@anthropic-ai/sdk");

module.exports = {
  name: "github-pr-reviewer",
  version: "1.2.0",
  description: "AI-powered PR reviewer. Posts inline comments on GitHub PRs with security + quality feedback.",
  category: "developer",
  triggers: ["review this PR", "review PR #", "check this pull request"],
  config: {
    GITHUB_TOKEN: { required: true, description: "GitHub Personal Access Token" },
    ANTHROPIC_API_KEY: { required: true, description: "Anthropic API key for Claude" },
    MAX_FILES: { default: 20, description: "Max files to review per PR" },
    SEVERITY_THRESHOLD: { default: "medium", description: "Min severity to post: low|medium|high|critical" },
  },

  async execute(input, context) {
    const { repo, pr_number } = parsePRInput(input.text);
    if (!repo || !pr_number) {
      return { error: "Could not parse PR. Try: 'review PR owner/repo#123'" };
    }

    const octokit = new Octokit({ auth: context.config.GITHUB_TOKEN });
    const claude = new Anthropic({ apiKey: context.config.ANTHROPIC_API_KEY });

    const [owner, repoName] = repo.split("/");
    const files = await octokit.pulls.listFiles({ owner, repo: repoName, pull_number: pr_number });

    const reviews = [];
    for (const file of files.data.slice(0, context.config.MAX_FILES || 20)) {
      if (!file.patch) continue;
      const analysis = await reviewFile(claude, file.filename, file.patch);
      reviews.push(...analysis);
    }

    // Post comments
    const commits = await octokit.pulls.listCommits({ owner, repo: repoName, pull_number: pr_number });
    const lastCommit = commits.data[commits.data.length - 1].sha;

    let posted = 0;
    for (const review of reviews) {
      try {
        await octokit.pulls.createReviewComment({
          owner, repo: repoName, pull_number: pr_number,
          commit_id: lastCommit,
          path: review.file,
          line: review.line,
          body: formatComment(review),
        });
        posted++;
      } catch (_) {}
    }

    return {
      pr: `${repo}#${pr_number}`,
      files_reviewed: files.data.length,
      issues_found: reviews.length,
      comments_posted: posted,
      summary: `Reviewed ${files.data.length} files. Found ${reviews.length} issues. Posted ${posted} comments.`,
    };
  },
};

async function reviewFile(claude, filename, patch) {
  const response = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `Review this code diff for ${filename}. Return JSON array of issues:
[{"line": <number>, "severity": "critical|high|medium|low", "title": "...", "description": "...", "suggestion": "..."}]
Only return valid JSON array.

\`\`\`diff
${patch.slice(0, 3000)}
\`\`\``,
    }],
  });

  try {
    const content = response.content[0].text;
    const start = content.indexOf("[");
    const end = content.lastIndexOf("]") + 1;
    return JSON.parse(content.slice(start, end)).map(i => ({ ...i, file: filename }));
  } catch {
    return [];
  }
}

function formatComment(issue) {
  const icons = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" };
  return `${icons[issue.severity] || "💡"} **[AI Review] ${issue.title}**\n\n${issue.description}\n\n**Suggestion:** ${issue.suggestion}`;
}

function parsePRInput(text) {
  const match = text.match(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)#(\d+)/);
  if (match) return { repo: match[1], pr_number: parseInt(match[2]) };
  return { repo: null, pr_number: null };
}
