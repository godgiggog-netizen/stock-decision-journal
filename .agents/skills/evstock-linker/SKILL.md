---
name: evstock-linker
description: Connect EVSTOCK analysis with Stock Decision Journal records while preserving provenance, chronology, entry context, and separate follow-up evidence.
---

# EVSTOCK Linker

Use when EVSTOCK analysis should feed the journal or when a journal record should open supporting EVSTOCK context.

Rules:
1. Treat EVSTOCK output as dated evidence, not permanent truth.
2. Link analysis to the ticker and decision timestamp.
3. Store entry context separately from fundamental or valuation evidence.
4. Carry forward explicit thesis breakers, catalysts, and uncertainty.
5. New EVSTOCK runs create new evidence records. They do not overwrite older analysis.
6. If point-in-time price or valuation is unavailable, mark it unavailable.
7. Show the user what changed between the previous and latest analysis.

The goal is one connected decision trail, not duplicate disconnected reports.
