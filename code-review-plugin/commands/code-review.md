---
description: Multi-agent code review of a GitHub PR or the local diff. Fans out to parallel specialized reviewers (bugs, security, CLAUDE.md compliance, git history, test coverage), scores findings by confidence, filters noise, and reports to the terminal or as inline PR comments.
argument-hint: "[PR number] [--comment] [--threshold N] [--focus bug|security|compliance|history|test]"
allowed-tools: Agent, Read, Grep, Glob, Bash(git:*), Bash(gh:*)
---

You are the orchestrator of a multi-agent code review. Run the phases below in order. Delegate detection to subagents; you resolve the target, coordinate the fan-out, filter the results, and report. Do the reviewing yourself only where a phase says so.

Arguments: `$ARGUMENTS`
- A bare number → GitHub PR mode, that PR.
- No number → local mode.
- `--comment` → post inline PR comments (PR mode only; error if used in local mode).
- `--threshold N` → override confidence threshold (default **80**).
- `--focus <area>` → run only the matching reviewer(s): `bug`, `security`, `compliance`, `history`, `test` (comma-separate for several).

Two supporting skills define shared behavior — follow them: **`confidence-scoring`** (the 0–100 rubric and rejection list every reviewer and your filter use) and **`review-reporting`** (terminal + GitHub output formats and `gh` mechanics).

---

## Phase 1 — Resolve the target

**PR mode** (number given):
- `gh pr view <n> --json state,isDraft,author,title,headRefOid,baseRefName,files` for metadata.
- `gh pr diff <n>` for the diff. Record the full head SHA (`headRefOid`) for later comment anchoring.
- Requires `gh` authenticated; if it fails, stop and tell the user to run `gh auth login`.

**Local mode** (no number):
- Must be inside a git repo. If `git rev-parse --git-dir` fails, stop with: "Not a git repository — `/agentic-code-review:code-review` local mode needs one. Pass a PR number to review a GitHub PR instead."
- If there are uncommitted changes (`git status --porcelain` non-empty), review the working-tree diff: `git diff HEAD`.
- Otherwise review the branch vs its merge-base with the default branch: `git merge-base HEAD origin/<default>` then `git diff <base>...HEAD`. Determine `<default>` from `git symbolic-ref refs/remotes/origin/HEAD` (fallback `main`).
- `--comment` here is an error: "‑‑comment only applies to PR mode." Stop.

If the diff is empty, print `No changes to review.` and stop.

## Phase 2 — Gate (PR mode only)

Spawn **pr-gatekeeper** synchronously (`run_in_background: false`) with the PR number. If it returns `SKIP: <reason>`, print the reason and stop — do not spin up reviewers. If `REVIEW`, continue. (Local mode skips this phase.)

## Phase 3 — Context

Spawn **context-scout** with the changed-file list and the diff. It returns the in-scope CLAUDE.md rules and a structured change summary. Keep its output; you will paste it into every reviewer prompt.

## Phase 4 — Fan-out (parallel)

In a **single message**, spawn the reviewers below as parallel `Agent` calls with `run_in_background: false`. Give **every** reviewer the same context block: the diff, the context-scout output, and a one-line reminder to apply the `confidence-scoring` rubric (threshold = effective threshold).

Default lineup (6 agents):
- **compliance-reviewer** ×2 — split the changed files into two roughly equal sets, one per instance. **Skip both** if context-scout found no CLAUDE.md rules.
- **bug-hunter** ×1.
- **history-analyst** ×1 — PR/branch history; skip if the repo has no meaningful history for the touched files.
- **security-reviewer** ×1.
- **test-coverage-reviewer** ×1.

`--focus` narrows this to only the named reviewer(s). Wait for all to return before Phase 5.

## Phase 5 — Validate & filter (you do this)

Merge every reviewer's findings, then:
1. **Parse** each pipe-delimited block: `file:line | category | confidence | summary | scenario | fix`.
2. **Threshold** — drop any finding with confidence below the effective threshold.
3. **Rejection list** — re-check each survivor against `confidence-scoring`'s automatic-rejection list (style, linter-catchable, pre-existing, vague quality, unreachable speculation). Drop matches even if the agent scored them high.
4. **Verify anchoring** — confirm each cited `file:line` is actually a changed line in the diff. Drop findings that point outside the diff.
5. **Dedupe** — collapse findings that describe the same defect at the same location (across agents) into one; keep the highest-confidence phrasing.

What remains is the final finding set.

## Phase 6 — Report

Follow **review-reporting**.
- **No `--comment`** (local, or PR without the flag): print the terminal report. If nothing survived, print exactly `No issues found.`
- **`--comment`** (PR mode): dedupe against existing PR comments, post one inline comment per unique finding anchored to the full head SHA (suggestion blocks only when they fully resolve the issue), then post the summary comment. If nothing survived, post the single "no issues" comment and no inline comments.

Keep your own narration minimal — the report is the deliverable.
