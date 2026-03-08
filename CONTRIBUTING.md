# Contributing to OpenClaw Power Skills

We welcome contributions! Here's how to add your skill:

## Quick Contribution

```bash
git clone https://github.com/hamzeesaid/openclaw-power-skills
cd openclaw-power-skills
npm install
node scripts/new-skill.js  # Interactive wizard
```

## Skill Requirements

Every skill must:
- [ ] Have a clear `description`
- [ ] Define required `config` fields
- [ ] Handle errors gracefully (never throw uncaught)
- [ ] Work offline when possible
- [ ] Include at least 3 `triggers` phrases
- [ ] Have a test file

## Skill Template

```js
module.exports = {
  name: "your-skill-name",
  version: "1.0.0",
  description: "One sentence description",
  category: "developer|productivity|finance|health|social|automation",
  triggers: ["phrase 1", "phrase 2", "phrase 3"],
  config: {
    API_KEY: { required: true, description: "..." },
    OPTION: { default: "value", description: "..." },
  },
  async execute(input, context) {
    // input.text — user's message
    // context.config — skill configuration
    // context.send — send additional messages
    return { message: "..." };
  },
};
```

## Pull Request Checklist

- [ ] Skill tested locally
- [ ] No hardcoded secrets
- [ ] Error handling for all network calls
- [ ] Added to registry.json
- [ ] Updated category README

Thank you! 🦞
