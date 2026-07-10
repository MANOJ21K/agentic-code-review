# reviewcrew

A Claude Code plugin marketplace. Currently ships one plugin:

## agentic-code-review

Multi-agent code review, the **agentic way**: one orchestrator command fans out to six parallel specialized reviewers — bugs, security, CLAUDE.md compliance, git history, test coverage — each with its own model and narrow mandate. Findings are scored 0–100 by confidence, filtered against a shared false-positive list, deduped, and reported to your terminal or posted as inline GitHub PR comments.

Extended re-implementation of Anthropic's official [code-review plugin](https://claude.com/plugins/code-review): same phase structure and confidence-gating philosophy, plus security + test-coverage reviewers and a local-diff mode that needs no GitHub.

Full docs: **[code-review-plugin/README.md](code-review-plugin/README.md)**

### Install

```
/plugin marketplace add MANOJ21K/agentic-code-review
/plugin install agentic-code-review@reviewcrew
```

### Use

```
/agentic-code-review:code-review                 # review the local diff
/agentic-code-review:code-review 123             # review GitHub PR #123
/agentic-code-review:code-review 123 --comment   # post inline PR comments
/agentic-code-review:code-review --focus security --threshold 90
```

### Layout

```
.claude-plugin/marketplace.json       marketplace manifest
code-review-plugin/
├─ .claude-plugin/plugin.json         plugin manifest
├─ commands/code-review.md            orchestrator (6-phase workflow)
├─ agents/                            7 reviewer subagents
├─ skills/                            confidence-scoring, review-reporting
└─ README.md                          full documentation
```
