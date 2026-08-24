# Stock Decision Journal Agent Guide

## Mission
Preserve decision memory for investments and radar alerts so later reviews compare what was known at the time with what actually happened.

## Default behavior
1. Never rewrite historical thesis or alert records with hindsight.
2. Add new thesis versions or follow-up records instead of mutating old evidence.
3. Keep company/opportunity quality separate from entry quality.
4. Connect each alert or thesis to explicit break conditions, checkpoints, and decisions.
5. Prefer Thai user-facing text and mobile-readable layouts.
6. Missing market data must stay visibly missing rather than guessed.
7. When adding entry/exit guidance, state what data supports it and what would invalidate it.

## Repo skills
- `$decision-journal-workflow` for thesis, decision, and review flows.
- `$alert-outcome-review` for +1/+7/+30/+90 alert follow-ups and learning.
- `$evstock-linker` for connecting EVSTOCK analysis to journal records without duplicating or overwriting history.

## Completion gate
A change is complete only when chronology is preserved, old records remain auditable, new evidence is stored separately, and the user can understand what changed and why.
