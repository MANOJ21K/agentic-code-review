---
name: review-reporting
description: How the agentic-code-review orchestrator renders findings — the terminal report format and the GitHub inline-comment mechanics (gh api calls, full-SHA anchoring, suggestion blocks, one-comment-per-issue dedupe). Use when formatting a code-review result for the terminal or posting review comments to a pull request.
---

# Review Reporting

Two output modes. Local/no-flag → terminal only. PR mode with `--comment` → inline GitHub comments plus a summary comment. `--comment` is invalid without a PR target.

## Terminal report

Order findings by severity (security > correctness bug > history regression > compliance > test gap), then by confidence descending. Render as:

```
Code Review — <N> finding(s) above threshold <T>

1. [SECURITY · conf 95] path/to/file.py:42
   Command injection: request param `name` interpolated into shell call.
   Scenario: POST /run with name="; rm -rf /" executes attacker input.
   Fix: pass args as a list to subprocess.run(...) with shell=False.

2. [BUG · conf 88] path/to/other.js:17
   ...
```

End with a verdict line: `Verdict: <N> issue(s) worth addressing` or, when nothing survives filtering, exactly:

```
No issues found.
```

## GitHub mode (`--comment`)

Target: `gh pr view <n> --json ...` for metadata; post via `gh api`.

### Before posting — dedupe against existing comments
Fetch current review comments: `gh api repos/{owner}/{repo}/pulls/{n}/comments --paginate`. Skip any finding whose `path` + line + core message already matches a comment authored by this tool. **One comment per unique issue — never post a duplicate.**

### Post an inline comment
```
gh api repos/{owner}/{repo}/pulls/{n}/comments \
  -f body="$BODY" \
  -f commit_id="$FULL_SHA" \
  -f path="$PATH" \
  -F line="$LINE" \
  -f side="RIGHT"
```
- `commit_id` must be the **full 40-char head SHA** of the PR (`gh pr view <n> --json headRefOid -q .headRefOid`), not an abbreviation.
- For a multi-line span add `-F start_line="$START" -f start_side="RIGHT"`.
- `line` numbers refer to the file in the PR head; only cite lines present in the diff or the comment will fail to anchor.

### Comment body
```
**[SECURITY · confidence 95]** Command injection.

Request param `name` is interpolated into a shell string. POST with `name="; rm -rf /"` executes attacker input.

​```suggestion
subprocess.run(["echo", name], shell=False)
​```
```
Include a ` ```suggestion ` block **only when the replacement fully resolves the issue** and is a drop-in for the commented line(s). If the fix is partial or spans unshown code, describe it in prose instead — never post a suggestion that would break on apply.

### Summary comment
After inline comments, post one issue-level summary via `gh pr comment <n> --body`:
```
Reviewed <N> changed file(s). Posted <M> inline comment(s): <k> security, <k> bug, <k> compliance, <k> test-coverage.
No blocking issues. / <M> issue(s) worth addressing before merge.
```
When nothing survives filtering, post a single comment: `Automated review found no issues above the confidence threshold.` and post no inline comments.
