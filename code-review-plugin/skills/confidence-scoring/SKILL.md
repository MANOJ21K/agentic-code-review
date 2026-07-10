---
name: confidence-scoring
description: Shared rubric for scoring code-review findings 0-100 and rejecting false positives. Every reviewer agent in the agentic-code-review plugin cites this before emitting a finding, and the orchestrator applies the same threshold when filtering. Use when scoring a review finding or deciding whether an issue is real signal.
---

# Confidence Scoring Rubric

Every finding a reviewer emits carries a confidence score from 0 to 100. Score reflects *how certain the defect is real and reachable from the code as written* — not how severe it would be if true.

## Score bands

| Band | Meaning | Emit? |
|------|---------|-------|
| 90–100 | Provable from the diff alone. The failure is mechanical: a null dereference on a path that always runs, an undefined reference, an inverted operator, a hardcoded secret sitting in the diff. | Yes |
| 80–89 | Highly probable. A concrete failure scenario exists and is realistic for how the code is actually called, though it depends on one reasonable assumption. | Yes (default threshold) |
| 60–79 | Plausible but leans on assumptions about inputs, callers, or runtime state not visible in the diff. | No (below threshold) |
| < 60 | Speculative. "This could be a problem if…" with a chain of ifs. | No |

**Default threshold: 80.** The orchestrator drops anything below it. The `--threshold N` flag overrides.

## Every finding must include

1. **Concrete failure scenario** — specific inputs or state that trigger the defect, and the resulting wrong behavior. "Could break" is not a scenario. "When `items` is empty, `items[0]` throws IndexError and the request 500s" is.
2. **Evidence in the diff** — cite `file:line` that is actually part of the changed lines (or directly implicated by them). If you cannot point at a changed line, the finding does not belong to this review.

If you cannot write the scenario, the score is below 80 by definition. Do not round up.

## Automatic rejection — score 0 regardless of severity

Reject outright. These are noise for this review:

- **Style / formatting** — naming, spacing, import order, quote style. Not a defect.
- **Linter- or typechecker-catchable** — anything a standard linter/compiler for the language already flags. Don't duplicate tooling.
- **Pre-existing issues** — problems in code the diff did not touch. Out of scope even if real.
- **Vague quality opinions** — "could be cleaner", "consider refactoring", "this is fragile" with no concrete failure. Not actionable, not a bug.
- **Unreachable-state speculation** — bugs that require runtime state the code never actually produces, or inputs the type system forbids.
- **Duplicated finding** — the same defect at the same location already reported by another angle. One finding per unique issue.

## Calibration examples

- `user.email.lower()` where an earlier branch can leave `user` as `None` → **92**. Direct null deref, clear path.
- New endpoint interpolates a request param straight into a shell command → **95**. Command injection, in the diff.
- "This loop could be slow for large N" with no evidence N is ever large → **45**. Speculative, reject.
- "Variable name `d` is unclear" → **0**. Style, reject.
- Deleted the only assertion in a test that guarded a regression → **85**. Concrete: the test can no longer fail on that regression.
