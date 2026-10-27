# Product scope

Evrida is an offline-first personal planning application for mobile. The intent is a coherent experience across short and long planning horizons, not a collection of unrelated feature demos.

## Core workflows

1. Capture an item with minimal taps.
2. Organize items by Day, Week, Month, Quarter, Year, Decade or Life.
3. Nest objectives while preserving unique identity and clear navigation.
4. View the same underlying item in horizon, board and calendar contexts.
5. Complete, reschedule, annotate, or revisit plans without losing history.
6. Review progress over time.
7. Export and restore personal data without depending on an account.

## Learning tracker and Learning Projects

Evrida already includes a self-rated Learning tracker: topics, 1–10 check-ins, notes, practice minutes, score history, weekly review, optional weekly reminders, target score/date, pace estimates and a link to an existing planning goal. A fuller resource-aware Learning Project remains planned: it would connect one outcome to books/videos, ordered units, estimated workload, scheduled study sessions and adaptive recovery.

- Define the outcome (for example, improving spoken English), optional target date, weekly capacity, preferred study days and session length.
- Add resources such as books, chapters, video series, courses, vocabulary sets and exercises. Each resource can be split into ordered units with estimated effort, prerequisites and completion state.
- Calculate remaining effort from unfinished units, practice and review. Show a provisional range and confidence, not a falsely precise completion date. Calibrate estimates against the user's actual session history.
- Turn the plan into linked Calendar Timeboxes and Focus sessions while preserving the same goal identity across Horizons, Boards and Calendar.
- Remind the user about upcoming sessions and review dates. If a session is missed, optionally replan flexible learning blocks into available time. Never silently move fixed commitments, active Focus sessions or user-locked blocks.
- Track content completed, actual minutes, assessment/recall results and long-range milestones. Time spent alone must not be represented as proof of mastery.
- Keep the core workflow local/offline. Resource parsing with AI, cloud sync and external calendar integration are later optional decisions, not prerequisites.

## Personal Finance & Money Goals (partially implemented, optional)

Evrida includes an initial lightweight, offline-first personal-finance workspace for manual balances, income, expenses, categories/tags, budgets, planned items and savings goals. Basic forecasts use explicit user-entered assumptions. It is not a full accounting or investment product; dated inflation-index data, finance reminders and native acceptance remain incomplete.

- Keep finance optional and onboarding progressive; core planning must work without financial data.
- Distinguish transaction type, category and cross-cutting tags; transfers between the user's own accounts must not count as income or expenses.
- Show monthly cash flow and spending trends only when enough recorded history exists.
- Let users allocate money explicitly to savings goals and forecast a completion window from current balance, contributions and assumptions.
- Show nominal amounts separately from inflation-adjusted purchasing power; distinguish general inflation from target-specific price growth.
- Make assumptions, source dates, uncertainty and missing inputs visible. Never fabricate current inflation data or promise an exact financial outcome.
- Keep financial records local/offline and include them in validated backup/restore. Bank connections, cloud sync, investment advice, tax workflows and AI categorization are deferred.

See [PERSONAL_FINANCE.md](PERSONAL_FINANCE.md) for the full specification and acceptance criteria.

## Capability map

| Capability | Initial milestone | Notes |
| --- | --- | --- |
| Navigation, states and appearance | M1 | Phone-first, accessible light/dark |
| Goal hierarchy and horizons | M2 | Core value; seven canonical horizons |
| Boards and ordering | M3 | References, not duplicate item records |
| Calendar and time blocks | M3 | Do not confuse due dates with blocks |
| Notes, recurring goals and habits | M4 | Rich editor choice deferred |
| Templates, guided plans and insights | M4 | Personal and offline |
| Personal finance and money goals | Partially implemented | Optional manual ledger, categories/tags, budgets, planned items, savings goals, assumption-based forecasts and budget-threshold alerts; dated CPI, bill/goal reminders and native acceptance remain incomplete |
| Notifications, widgets and quick-add | M5 | Native integration where necessary |
| Backup/restore | M5 | Must precede release |
| Localization and Jalali presentation | M5 | Logical storage separate from display |
| Server, sync and team collaboration | Deferred | No placeholder login screens |

## Non-functional requirements

- Offline by default; no account required to use core features.
- Data remains intact across restarts, migrations and ordinary device lifecycle events.
- Predictable navigation and no unresponsive gesture-only critical actions.
- Clear permission requests, minimum possible privileges.
- Reusable design components with text scaling and contrast checks.
- Avoid silent duplicates, orphaned hierarchy nodes and ambiguous time semantics.

## Out of scope for the bootstrap

No cloud architecture, backend services, auth, AI integrations, billing, team permissions, or production launch configuration. Do not add them speculatively.

## Completion standard

A capability is complete only when: functional UI, persistence, error/empty states, accessibility pathway, automated checks for its core logic and device verification all exist.
