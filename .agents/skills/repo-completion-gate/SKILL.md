---
name: repo-completion-gate
description: Run the final self-review for Stock Decision Journal after meaningful code, schema, alert, thesis, or EVSTOCK integration changes. Use before declaring work complete.
---

# Stock Decision Journal Completion Gate

Run this after implementing a meaningful change.

## 1. Build
Run:

```bash
npm run build
```

If the build fails, fix the failure before continuing.

## 2. Chronology integrity
Confirm:
- historical thesis versions are never overwritten
- historical radar alerts are never rewritten with hindsight
- new evidence is appended as a new version, checkpoint, or review
- timestamps and sequence remain auditable

## 3. Decision integrity
Confirm company/opportunity quality remains separate from entry quality.
If entry, exit, or sizing guidance changed, state the supporting data and invalidation condition.

## 4. EVSTOCK linkage
When EVSTOCK integration changed, run `$evstock-linker` and verify links do not duplicate or mutate journal history.

## 5. Alert learning
When alert or follow-up logic changed, run `$alert-outcome-review` and verify +1/+7/+30/+90 checkpoints remain interpretable.

## 6. UI and missing data
Check Thai spelling and wording, mobile readability, empty states, and that unavailable market data is visibly unavailable rather than guessed.

## 7. Adversarial pass
Try duplicate alerts, missing prices, incomplete thesis fields, repeated reviews, and out-of-order evidence where applicable.

## Completion verdict
Return exactly one verdict:
- `PASS` when build and all critical checks pass
- `PASS WITH CONDITIONS` when only disclosed non-critical limitations remain
- `FAIL` when any critical check fails

Never claim completion before the build has passed.