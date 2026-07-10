# agentic-code-review

A Claude Code plugin that reviews a pull request or your local diff the **agentic way**: one orchestrator command fans out to a crew of specialized subagents — bugs, security, CLAUDE.md compliance, git history, test coverage — each running in parallel with its own model and its own narrow mandate. Findings are scored 0–100 by confidence, filtered against a shared false-positive list, deduped, and reported to your terminal or posted as inline GitHub PR comments.

It's an extended re-implementation of Anthropic's official [code-review plugin](https://claude.com/plugins/code-review): same phase structure and confidence-gating philosophy, plus two extra reviewers (security, test coverage) and a local-diff mode that needs no GitHub.

## Install

```
/plugin marketplace add "/Users/manojkumar/Desktop/Learnings/Claude Assets"
/plugin install agentic-code-review@manoj-plugins
```

Then the command is available as `/agentic-code-review:code-review`.

## Usage

```
# Review the local diff (uncommitted changes, else branch vs merge-base)
/agentic-code-review:code-review

# Review GitHub PR #123, terminal report only
/agentic-code-review:code-review 123

# Review PR #123 and post inline comments
/agentic-code-review:code-review 123 --comment

# Only hunt security issues, stricter threshold
/agentic-code-review:code-review --focus security --threshold 90

# Two angles at once
/agentic-code-review:code-review 123 --focus bug,security
```

### Flags

| Flag | Effect | Default |
|------|--------|---------|
| `[PR number]` | GitHub PR mode. Omit for local diff mode. | local |
| `--comment` | Post inline PR comments (PR mode only). | off |
| `--threshold N` | Confidence cutoff (0–100). Findings below N are dropped. | 80 |
| `--focus <area>` | Run only chosen reviewers: `bug`, `security`, `compliance`, `history`, `test`. Comma-separate. | all |

## Architecture

```
/agentic-code-review:code-review
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ Orchestrator (commands/code-review.md)                  │
│                                                          │
│ Phase 1  Resolve target ── PR (gh) │ local (git diff)   │
│ Phase 2  Gate ─────────────► pr-gatekeeper   (haiku)    │  PR mode only
│ Phase 3  Context ──────────► context-scout   (haiku)    │
│ Phase 4  Fan-out (parallel):                            │
│            ├─ compliance-reviewer ×2         (sonnet)   │  skip if no CLAUDE.md
│            ├─ bug-hunter                     (opus)     │
│            ├─ history-analyst                (sonnet)   │
│            ├─ security-reviewer              (opus)     │
│            └─ test-coverage-reviewer         (sonnet)   │
│ Phase 5  Validate & filter (threshold, reject, dedupe)  │
│ Phase 6  Report ── terminal │ inline PR comments        │
└─────────────────────────────────────────────────────────┘

Shared skills:
  confidence-scoring   0–100 rubric + auto-rejection list (every agent + the filter)
  review-reporting     terminal format + gh inline-comment mechanics
```

Each reviewer emits uniform pipe-delimited findings —
`file:line | category | confidence | summary | scenario | fix` —
so the orchestrator can parse, threshold, dedupe, and render them mechanically.

## Why it filters so hard

The value of an automated reviewer is inversely proportional to its false-positive rate. Every agent scores each finding on the shared [`confidence-scoring`](skills/confidence-scoring/SKILL.md) rubric and must attach a concrete failure scenario; the orchestrator then drops everything below threshold, re-rejects style/linter/pre-existing/speculative noise, and verifies each finding actually anchors to a changed line. What reaches you is meant to be worth reading.

## Tuning

- **Change the threshold** globally by passing `--threshold`, or edit the default in `commands/code-review.md` and `skills/confidence-scoring/SKILL.md`.
- **Add a reviewer**: drop a new `agents/<name>.md` (copy an existing one's frontmatter shape, keep the pipe-delimited output contract), then add it to the Phase 4 fan-out list in `commands/code-review.md`.
- **Retire one**: remove it from the Phase 4 list — the file can stay.
- **Adjust what counts as noise**: edit the rejection list in `skills/confidence-scoring/SKILL.md`; all agents inherit it.

## Requirements

- **Local mode**: a git repository. Nothing else.
- **PR mode**: `gh` CLI authenticated (`gh auth login`) and a GitHub remote.
- `--comment` posting is exercised manually against a real PR — the plugin's other paths are verifiable on any local repo.
