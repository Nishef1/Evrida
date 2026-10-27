# Current architecture status (2026-10-27)

Cross-feature invariant: canonical goals and Timebox instants live only in SQLite; transient edit/preview state stays local to the screen. The FocusProvider is the single active-session presenter and Review rereads persisted history whenever that active-session identity changes. Native Timebox editors and direct-manipulation previews guard against concurrent changes in exclusive transactions. Explicit manual writes invalidate the ephemeral Ripple Undo checkpoint. The Calendar uses one date-grid read with domain-derived Day/Week/Month slices; 23/25-hour dates use offset-labeled List instead of a misleading 24-hour grid.


The current database is schema **v13**. It includes the original seven-horizon planning model, Boards, Timebox/Focus history, flexible-block recovery, weekly time budgets, optional personal-finance tables (schema v9–v10) and the self-rated Learning tracker (schema v11–v13). Portable backup format **v7** includes finance and learning records, validates and normalizes older Evrida/Eonward backups, and excludes the temporary recovery checkpoint and active Focus session. See CAPABILITIES.md for current scope and verification boundaries.

Earlier version-specific sections below describe historical slices, not the current capability boundary. The resource-aware Learning Projects workflow, historical CPI import, full native restore matrix and complete Android/iOS acceptance are still unfinished. See CAPABILITIES.md and ROADMAP.md for current status.

v7 adds explicit Inbox state (`in_inbox = 1`, empty planning key), optional civil `due_date`, repeat rule/anchor/source metadata, a unique recurrence-source index, and `goal_activity` completion/reopen transitions. Existing goals, boards, reservations and Focus history are preserved. Startup migration uses `withTransactionAsync` on the provider connection; ordinary multi-record writes use exclusive transactions.

A recurring occurrence is a new goal identity representing a genuinely new step, generated atomically with its predecessor's completion and copied board memberships. Source IDs enforce idempotence. UTC time blocks and civil planning/deadline dates remain distinct.

Backup format v1 contains strict schema-v7 allowlisted rows for goals, boards, memberships, time blocks, focus history and goal activity. Restore validates complete graphs and cycles, then merges missing IDs in a single transaction with deferred FK validation. Existing rows are never overwritten; active timers are not restored. The native file picker copies input into cache; only that copied file is removed after reading.

Quick Focus creates the real UTC Timebox and running session in one exclusive transaction, after validating an open active goal. Explicit replacement records the previous session first. Archiving an active subtree closes a contained Focus session atomically with its history before applying archive state.

`src/storage/connection.ts` opens one process-wide native handle and never closes it from React. `EvridaDatabaseProvider` renders a loading fallback, throws a startup failure to the root error boundary, and a failed open is not cached so Retry re-attempts it. The failed startup connection is closed before the error propagates. Native failure injection remains an acceptance item.

The app shell owns keyboard avoidance and hides the dock while typing. Native modal forms own their separate keyboard/safe-area boundary. Date/time inputs use system pickers without changing civil-date or UTC-instant semantics; Jalali is a display/input option while stored date keys remain Gregorian. Learning stores self-rated check-ins separately from practice minutes; Money remains optional and manual-first. Shared palette/depth tokens and individually imported Lucide vectors define the Studio presentation without introducing parallel planner state. The app uses Expo SDK 58-compatible dependencies. CI covers TypeScript, domain/real-SQLite tests and JS bundles; Android SQLite native lifecycle issue #2 and the full native gesture/accessibility matrix remain release blockers.

# Original architecture proposal and historical slices

The proposal below includes the historical v2 baseline. Current implementation and verification are described above and in CAPABILITIES.md; draft entities are not a claim that separate tables exist.

## Stack

- React Native with Expo SDK 57, Expo Router, TypeScript strict mode.
- Android as the first verification target; compatible iOS layout from the beginning.
- Expo SQLite for local persisted data; transactional v1 → v2 migration, goal CRUD, Archive/Restore and ordering implemented. Drizzle is not installed.
- Reanimated / Gesture Handler only when complex interaction work begins; basic interactions currently use Pressable.
- Kotlin/Swift extensions only for capabilities that cannot be implemented reliably through maintained Expo modules.
- No backend, user accounts, network dependency, or telemetry requirement in the initial application.

## Boundaries

```
app/                Expo Router entry points and navigation only
src/theme/          Design tokens
src/features/       Horizons view and goal sheets
src/domain/         Pure period keys, navigation and goal input validation
src/storage/        SQLite migration v1 and goal repository
src/platform/       Notifications, widgets, file sharing (when added)
docs/               Public-safe project documentation and progress tracker
```

Route files should be thin. UI components must not issue raw SQL. Domain functions should be testable without booting the app.

## Implemented data model (v2)

`goals` stores stable UUID, title, notes, horizon, period key, optional parent ID, completion flag and timestamps. Parent references use `ON DELETE SET NULL`; deleting a parent keeps descendants as independent goals.

Schema v2 adds `archived_at` (nullable timestamp) and `sort_rank` (integer) to existing goals with SQLite ALTER TABLE. The current design uses a single placement per goal. Multi-placement, time blocks, boards, recurring instances, archive and recovery are **not implemented yet**. Do not confuse this vertical slice with the final schema.

## Draft data concepts

| Entity | Purpose |
| --- | --- |
| Item | Stable ID, type, title, content metadata, status and timestamps |
| ItemRelation | Directed parent/child relationships; no cycles |
| HorizonPlacement | An item placed in a time horizon, period key and sort order |
| Board / BoardEntry | A customizable view and reference to existing items |
| TimeBlock | Specific planned start/end instants |
| RecurrenceRule | Local recurrence definition with zone and exceptions |
| OccurrenceState | Completion/skips for each recurrence occurrence |
| Note / Attachment | Rich content and local file metadata |
| ActivityEvent | Minimal audit history necessary for insights |
| Preferences | Theme, language, calendar presentation, start of week |

**Never equate horizon, deadline and time block.** An item planned for a month can have no exact deadline. One item may have multiple presentations without copied records.

## Time and calendar correctness

- Use unique IDs; persist UTC instants for timed events and an explicit IANA time zone where relevant.
- Store calendar dates separately when the concept is a floating all-day date.
- Treat week start and display calendar as configurable; Jalali is a presentation/calendar conversion, not a rewrite of stored timestamps. Implemented in `src/domain/jalali.ts` (pure conversion, parsing, formatting) with the per-device choice in `src/features/shared/calendarStyle.ts` and the display helpers in `src/features/shared/dates.ts`; no schema or backup change.
- Explicitly test DST gaps/overlaps, leap days, week/year rollover and long-horizon calculations.
- A recurrence rule and an individual occurrence are separate records/concepts.

## Local-first integrity

- Transactions for multi-record changes and migrations.
- Foreign-key integrity; no orphaned relationships.
- Non-destructive upgrades; backup format has schema version.
- Conflict resolution is deferred because there is no sync layer.
- Avoid premature interfaces/classes without at least two concrete users.

## Dependency policy

Prefer platform/Expo primitives; introduce a third-party library only after checking maintenance, compatibility, license and the device-level behavior we need. Record substantive dependencies in [DECISIONS.md](DECISIONS.md).

## Validation plan

1. Test pure domain rules with deterministic date/time fixtures.
2. Test persistence across process restarts and upgrades.
3. Validate touch/drag interactions on midrange Android hardware.
4. Only then scale the feature to notes, boards, and calendar.

## Horizons 2.0 work-in-progress

- The editor can select a parent across horizons and can change the planning period without moving the item through another screen.
- The schema is v2: one stored horizon placement per goal with archive state and ordering. Multi-placement still is not implemented.
- Goal editing uses an exclusive transaction with recursive descendant inspection to reject cyclic parent changes.
- The available-parent filter is pure domain logic; it helps UX but database validation remains mandatory.
- Nested detail navigation is UI state (back stack); there are no duplicate records.

## Archive & sorting semantics

Archiving an active parent also archives its currently active descendants as one unit. Restoring that unit does not restore descendants archived earlier with different timestamps. A child cannot be restored while its parent remains archived. The archive list shows recoverable roots, keeping a single hierarchy rather than duplicate records. Manual Move Up/Down applies within the same period and completion group and persists ranks in an exclusive SQLite transaction. This is deliberately simpler than drag-and-drop.

## Boards / schema v3

- Additive migration to `boards` and `board_goals` tables; do not drop or reset goals.
- Board membership is a **many-to-many reference** with composite primary key `(board_id, goal_id)`. A goal may belong to several boards; each board may reference many goals.
- `ON DELETE CASCADE` on board deletion removes membership only; deleting a board never removes the goal itself.
- Archived goals are hidden in board views and excluded from active board counts, but their memberships remain until the underlying goal is permanently deleted.
- Board read models provide counts and completion from the same saved goals; no synchronized copies.
- Route `/boards` opens the workspace; opening a board item navigates to the canonical goal detail on the Horizons route.
- SQLite migration v3 preserves the existing v2 schema and is executed in the current exclusive transaction. Android upgrade verification remains mandatory.

Creating a new goal inside a board uses the existing goal-creation transaction with an optional board ID; the goal insertion and membership insertion succeed or roll back together. This prevents an unlinked orphan goal if adding board membership fails.

## Time scheduling v4

- Goals remain single canonical entities with stable UUIDs, no copies per page. `time_blocks` has `id`, `goal_id`, ISO UTC `start_at`/`end_at`, `kind` (block or box), optional `intention` and timestamps.
- Migration is additive v3→v4 in the existing exclusive transaction. Goal FK uses `ON DELETE CASCADE`; archived goals' blocks are hidden until restored, preserving planned times.
- Multiple blocks can reference one goal and one goal can appear in several boards. Completing a goal from any view updates the same database record.
- SQLite stores absolute instants, while daily navigation, captions and input show device-local times. Day bounds are computed from adjacent local midnights rather than adding 24 hours, so 23/25-hour DST days can be queried.
- Local calendar input rejects impossible civil dates and non-existent spring-forward clock times. Fall-back repeated clocks are currently resolved by the platform's default; explicit timezone/offset selection remains future work.
- Initial Time Blocks and Timeboxes must fit within one local calendar date. Overlap is permitted and laid out in horizontal lanes, with no silent overwrite.
- Calendar UI uses existing React Native components; no calendar/drag package, sync layer or server introduced.

**Remaining data modeling work:** due dates are **not** schedule start times; recurring occurrences, travel/timezone UX, availability/conflicts and an active Timebox countdown need separately defined contracts.

## Focus session v5 and global app shell

- The process-wide connection in `src/storage/connection.ts` owns local data; FocusProvider is mounted once above the Stack and bottom dock so route changes cannot reset a running focus session.
- A single-record `focus_session` table references one existing Timebox ID and stores running/paused status, original duration, deadline and frozen paused remainder in integer milliseconds. No duplicate goal record or cross-device service.
- Exclusive SQLite transactions start, pause and resume; the current session is reread from SQLite on app foreground. Session replacement is explicit and confirmed.
- The app-level mini-bar survives navigation. When the background freezes JS, elapsed time is recomputed from the stored deadline on return, not accumulated per timer tick. An expired session remains visible until explicitly finished.
- Ending the timer is not equal to completing a goal or logging a finished work interval. Notifications, background execution, activity tracking and history are not yet implemented.
- The labeled dock currently mounts next to the Expo Router Stack. It replaces redundant per-screen shortcut buttons but needs Android checks for bottom insets and deep-link back-stack behavior.
