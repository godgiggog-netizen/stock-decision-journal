# Stock Decision Journal

Investment memory system for recording why a position was opened, what would invalidate the thesis, and how the decision changes over time.

## MVP v0.2

- Portfolio positions
- Investment theses
- Append-only thesis versions
- Thesis break conditions
- 30/60/90-day reviews
- Decision history: Buy More / Hold / Reduce / Exit
- Supabase PostgreSQL schema with Row Level Security

## Stack

- React + Vite
- Supabase PostgreSQL + Auth
- CSS

## Core principle

> Every position should have a reason to own it and a reason to sell it.

Historical thesis versions are preserved instead of overwritten so future reviews can compare current thinking with the original decision.
