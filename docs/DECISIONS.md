# Decision log

Record significant decisions and reversals here. A future change should cite its reason and implications.

| Date | Decision | Reason | Status |
| --- | --- | --- | --- |
| 2026-10-14 | Android-first, iOS-compatible architecture | Deliver and verify the mobile experience before desktop | Accepted |
| 2026-10-14 | React Native + Expo SDK 57 + strict TypeScript | Shared mobile stack and well-supported tooling | Accepted, verify on device |
| 2026-10-14 | Local-first; no signup or cloud backend initially | Single-user offline core is the current priority | Accepted |
| 2026-10-14 | Independent UI and domain rules | Avoid carrying over weaknesses or licensing obligations from other products | Accepted |
| 2026-10-14 | Include only minimum starter dependencies | Lower upgrade cost and avoid speculative package adoption | Accepted |
| 2026-10-14 | Public-safe docs under `docs/`; no root README | Keep repository home intentionally minimal | Accepted |
| 2026-10-14 | SQLite with migrations when persistence begins | Durable local storage and controlled schema changes | Planned implementation |
| 2026-10-14 | Dedicated desktop build | Reassess after reliable Android/iOS product | Deferred |

| 2026-10-14 | Direct Expo SQLite v1 rather than introducing an ORM on day one | Small initial CRUD surface; migration and parameterized queries are straightforward | Implemented in source; unverified on device |
| 2026-10-14 | First slice: one horizon placement per goal, optional parent link | Deliver end-to-end behavior before multi-placement and advanced relationships | Temporary, revisit in M2 |

| 2026-10-14 | Pin React DOM 19.2.3 and Worklets 0.10.1 | npm ci exposed mismatched transitively selected peers; pin to Expo SDK 57 verified versions | Accepted, locked |

| 2026-10-14 | Editable parent relationship with guarded SQLite transaction | Prevent self-reference and descendant-parent loops while moving goals | Implemented, runtime verification pending |
| 2026-10-14 | Simple period picker before heavyweight calendar dependency | Small code footprint for seven horizons, day-specific exact date input | Implemented, further UX validation pending |
| 2026-10-14 | Keep Android controls at least 48dp and simplify first-run Horizons | Improve legibility, safe-area clarity and discoverability | Implemented in source, pending device review |

| 2026-10-14 | Build multi-horizon overview using existing SQLite and React Native | No extra dependency or duplicated goal data | Committed, Android QA pending |
| 2026-10-14 | Hard cap of 20 unique core automated tests | Prevent redundant and stale AI-generated regression suites | CI gate added |

| 2026-10-14 | Goal Path displays saved parent relationships and moved goals open at destination | Avoid disconnect between daily actions and long-term goals and misleading empty lists | Implemented in source; Android QA pending |
| 2026-10-14 | Prioritize reversible delete and basic ordering before drag animations | Correctness and data safety before visual complexity | Planned |

| 2026-10-14 | SQLite v2 additive migration with archived timestamp and sort rank | Keep v1 goals intact and support safe, offline lifecycle/order | Implemented in source; Android migration QA pending |
| 2026-10-14 | Archive active subtrees and restore only the same archive group | Preserve hierarchical context without resurrecting previously archived items | Implemented in source, SQL sanity checked |
| 2026-10-14 | Reorder with Move Up/Down before drag gestures | Accessible, deterministic and no new dependency | Implemented in source, Android UX QA pending |

| 2026-10-14 | Use a sticky Save footer and safe-area-aware modals | Existing form action clipped against Android system navigation area | Implemented in source, emulator verification pending |
| 2026-10-14 | Reduce empty-state and multi-horizon duplicate CTAs | Improve action clarity and preserve vertical screen space | Implemented in source |
| 2026-10-14 | Separate Archive from primary Focus/Perspective modes | Archive is a utility destination, not a planning mode | Implemented in source; user experience review pending |

| 2026-10-14 | Build a real Boards workspace before calendar/time blocking | First major missing personal workflow; many-to-many referencing existing goals without duplication | Committed to source; Android QA outstanding |
| 2026-10-14 | Additive SQLite schema v3 | Board deletion should never destroy underlying goal records or require new backend services | Committed; upgrade verification pending |
| 2026-10-14 | Remove automatic goal-title keyboard focus | Form appeared partially scrolled in emulator screenshot; preserve top-of-form context first | Committed; screenshot recheck pending |

| 2026-10-14 | Separate scheduled time blocks from Horizon placement in SQLite v4 | A life/year goal can reserve hours today without moving or duplicating its goal | Implemented in source, Android QA pending |
| 2026-10-14 | Support flexible blocks and fixed-limit timeboxes with a shared goal ID | Distinct user workflows; calendar scheduling must work across Horizons and Boards | Implemented in source, not an enforced timer |
| 2026-10-14 | Store scheduled instants in UTC; render local time and reject spring-forward gaps | Avoid ambiguous naive stored clock text and preserve events across device timezone changes | Initial support; fall-back disambiguation future work |
| 2026-10-14 | Allow overlapping planned blocks with split lanes, no heavyweight calendar library | Keep visual behavior correct for simple conflicts without overengineering | Initial timeline implemented |

| 2026-10-14 | Persistent labeled three-destination bottom navigation outside route Stack | Essential app destinations must be discoverable and available with one tap | Source implemented, emulator review pending |
| 2026-10-14 | Store one focus session with absolute deadline in SQLite v5 | Timer must remain correct across route changes and app suspension without a background JS loop | Implemented in source, Android lifecycle verification pending |
| 2026-10-14 | Do not automatically complete goals or claim background alarms on timer expiry | Focus time and outcome are distinct, and native notification reliability requires separate work | Product boundary documented |

## Open decisions

- Calendar rendering package vs dedicated implementation: verify on device.
- Rich-text editor selection: test RTL, selection, keyboard, large documents.
- Widget package vs Kotlin/Swift integration: verify power management and refresh reliability.
- Export format, encryption choice and attachment packaging.
- Precise package identifier and app-store naming before external release.


## 2026-10-15 — Personal planning and recovery

- Accept the compact Plan / Overview / Inbox direction and keep four labeled existing dock destinations: Plan, Calendar, Boards, Review.
- Use additive schema v7. `in_inbox` is authoritative for unscheduled goals, whose `period_key` is empty; the legacy horizon category is dormant until the user assigns a period. Never interpret an Inbox record as a dated daily goal.
- Store optional `due_date` as a floating civil date, independently of horizon and UTC time reservations.
- Record completion/reopen transitions transactionally. Do not infer historical completion from update timestamps or backfill unverifiable events.
- Create a recurring occurrence only when its source is completed, with a unique source reference. Reopening/recompleting does not duplicate its next occurrence. Copy notes and board references; do not duplicate children, deadlines or time blocks.
- Keep startup migrations on the single process-wide connection (not an exclusive second connection) to avoid the reproduced Android second-connection lock.
- Native JSON backups merge missing records atomically, preserve local conflicts, validate references/cycles before and after merge, and exclude transient running Focus sessions.
- Add SDK-compatible MIT-licensed Expo FileSystem, Sharing and DocumentPicker for real file recovery; explicitly configure the SystemUI plugin so native builds follow the existing automatic theme setting. The Android 35 picker/share workflow needs no runtime storage permission or backend.

## 2026-10-15 — Studio direction and two-platform preparation

- The user explicitly targets Android **and iOS** and prioritizes building the app over publisher/contact metadata. Only emulator hardware is currently available. Keep native Apple and physical-device gates visible; JavaScript export does not satisfy them.
- Replace the rejected provisional appearance with one coherent Studio grammar derived from the supplied visual references: neutral canvas, restrained depth, precise grouped controls, consistent line icons and purposeful green states. Keep private references outside Git. User aesthetic acceptance remains open.
- Adapt desktop reference principles to phone interactions: labeled four-destination dock, grouped Plan modes, a compact seven-horizon picker, linked time-scale overview and title-first goal details. Preserve canonical goals and time semantics.
- Prefer maintained native DateTimePicker and SVG/Lucide components over text-parsing-only date entry or font glyph icons. Use SDK-compatible versions and import only required icons.
- Use one root keyboard boundary plus separate modal boundaries. Hide root navigation during typing after full Gboard exposed an obscured quick-capture action.
- Keep QA release identifiers separate from the primary app, preserving user data. Local standalone QA builds use a debug certificate; store signing and publication remain separate gates and actions.

## 2026-10-15 — Living Timeline and recoverable plans

- Adopt a user-controlled, deterministic replanner instead of an opaque or server-dependent AI scheduler. Reflow never silently changes fixed reservations, complete goals, past segments, recurring anchors or goal dates.
- Make `time_blocks.flexible` opt-in, default false for migration and imported legacy backups. Preview changes separately; match the original SQLite day snapshot in an exclusive write transaction; preserve one local, guarded Undo checkpoint outside portable backups.
- Restrict first-pass Recovery to the current civil day with 24 actual hours; reject unresolvable overtime and daylight-saving transition days rather than silently shift clock times. The user can manually edit unusual dates using existing native pickers.
- Attribute new Focus history to both block and goal IDs; retain old history as unattributed. Do not infer identities from titles, which are mutable and non-unique.
- Use an explicit per-goal weekly minutes budget. Count saved reservations as planned, history as recorded and descendants along today's hierarchy; keep these quantities distinct. Avoid introducing an AI service, account, or new dependency.
- Export backup v2 while supporting strict v1 legacy import. Exclude active sessions and temporary Undo state. Device-level restore must be tested before calling migration release-safe.

## 2026-10-15 — Cohesive onramp and release-aware scope

- Add a small curated Guided Plans library using the existing canonical goals + Inbox relationships, not a second task model or new table. User-authored custom templates need a separately agreed persistence and versioned-backup contract.
- Improve Boards with clear computed Open/Scheduled/Done/All lenses without falsely suggesting independent saved sort order. Defer schema-changing board sections/reorder until Android/iOS interactive acceptance is solid.
- Separate summed reserved durations from unioned calendar occupancy, and show a compact schedule ribbon only on days with 24 actual hours. On 23/25-hour days use the more honest exact-time List view.
- Keep Undo deliberately short-lived (five minutes); rejecting stale Undo is safer than rewriting historical schedules hours later. No invisible automatic rescheduling.
- Make weekly capacity actionable through direct goal-linked calendar scheduling, not just an analytics chart.
- Refresh timezone-sensitive calendar queries and memoized layout after app foreground; note this is not proof that live Android theme/font SQLite native SIGSEGV is resolved.
- Do not add speculative background schedulers: Expo background tasks are deferred by the operating system and are not a reliable exact timer/reminder mechanism. Local Focus remains deadline-based with native notification fallbacks and separate OEM/permissions QA.

## 2026-10-15 — Native SQLite lifetime risk is a release blocker

- Public Expo issue #48999 and #48995 resemble, but do not prove the cause of, Evrida's earlier Android `exsqlite3_step/pthread_mutex_lock` SIGSEGV. Keep issue #2 open pending native replication.
- A lightweight per-handle JavaScript queue protects native statement lifecycles for all screen and Focus consumers, including exclusive transaction duration, without replacing the Expo SQLite provider or adding a second connection.
- The source mitigation deliberately does not claim to cure native shared-object GC/teardown races. Do not wholesale upgrade to Expo SDK 58 or invent a Kotlin patch without platform compatibility and physical-device verification.

## 2026-10-15 — Self-critique of the previous feature pass

- Existing Recovery used a time-frozen proposal that became unapplyable after 120 seconds without an obvious repair path. Offer explicit refresh and disable stale Apply instead of silently changing the proposed schedule.
- Keep Undo availability aligned with its five-minute checkpoint; hide the affordance rather than promise reversal that SQLite will reject.
- A goal starter behind a buried tool menu is not genuinely discoverable for first-time users. Introduce a secondary CTA in the existing empty state without adding intrusive onboarding overlays.
- Weekly time-budget guidance must be based on the user's own declared target, not a fabricated productivity score. "Unreserved" does not automatically mean "needs to be filled."
- Make the day’s Focus wording honest for overnight sessions: linked completed sessions are grouped by end time, not perfectly reconstructed into day slices because pause/resume segment history is not stored.
- Keep the canonical recovery comparison independent of locale collation so imported IDs behave as consistently as generated UUIDs.
- Place export staging in cache rather than Documents, retaining files long enough for native sharing recipients and pruning older copies on subsequent exports. This reduces unnecessary persistence but does not amount to encryption or secure erasure. Require actual recipient QA.
- Expose manual SQLite structure and foreign-key checks as a helpful integrity diagnostic, **never** as a claim that the Android native SIGSEGV has been fixed.

## 2026-10-15 — Whole-product feature gate and correctness before scope

- Do not add headline features while the existing Plan → Calendar → Focus → Review loop still has measurable correctness and native lifecycle gaps. Evrida already offers seven horizons, Boards, Guided Plans, a living timeline and user-controlled Recovery. More icons, dashboards or an AI scheduler do not close the Android expo-sqlite P0 or make native iOS acceptance real.
- Weekly capacity represents each goal's **occupied wall time**: compute the union of overlapping time reservations across the goal and its current descendants, not a double-counted sum. Distinct goals' budgets may overlap without subtracting one from the other; they are independently defined capacities. Focus history remains separately measured and old unattributed sessions are not backfilled.
- Keep the one-step Undo promise strict: store the applied block's timestamp, owner, type and intention. Decline Undo if any moved block was subsequently edited, completed, archived or assigned to an active Focus session; never silently overwrite a later user edit. Hide an unavailable Undo CTA using a read-only comparison, but require the transaction to recheck atomically before writing.
- Timebox-based and shortcut-based Focus must obey the same completion constraints. Completing the linked goal closes its running/paused Focus in the same SQLite transaction and persists an accurate stopped/completed record; Plan and Boards immediately refresh the globally visible Focus provider.
- Keep the 20-test automatic policy, extending meaningful real SQLite assertions rather than adding large synthetic regression suites. Native iOS, Android SIGSEGV stress, OS notification permissions and large-font/screen-reader UX still require direct device evidence.

## 2026-10-15 — Restore SSOT between calendar read model and style semantics

- Calendar previously had three overlapping SQLite queries and React state copies for its Day, Week and Month views; reduce to one visible-grid dataset with pure selectors. This reduces redundant reads and makes all three views originate from the same response. Separate canonical goals and Focus history remain intentional domain boundaries.
- Consolidate time accounting into shared `analyzeRangeLoad` / `analyzeDayLoad` with explicit reserved-versus-occupied semantics. Show uniquely occupied time consistently across summaries; display overlaps separately.
- Centralize meaningful semantic time/status and themed error/warning colors in `src/theme/tokens.ts`. A `Palette` type defined in thirteen screens was a real structural duplicate, now replaced by one exported type. Keep per-screen StyleSheets for genuinely different layout concerns.
- Use one small CI source guard to prevent reintroducing this specific drift, and tests on clipped overlap and readable status colors. Native contrast/large-font QA is not subsumed by source tests.

## 2026-10-15 — Fix real state boundary violations, not all duplicate state

- Preserve SQLite goals/time blocks/focus history as durable SSOT, short-lived form drafts as local UI state, and FocusProvider as the one live session presenter. Do not add a global cache/store until an actual invalidation contract justifies it.
- Guard the ordinary Timebox editor against stale edits with snapshot checks inside a single exclusive transaction, matching the safer Drag path. End-to-end browser/OS tests must prove the error state lets a user reopen the latest item.
- Use the Focus session identity change to invalidate Review's read-only report, avoiding both a parallel Focus store and every-second report queries.
- Show exact clock offsets in DST lists rather than drawing a structurally wrong 24-hour day for a 23- or 25-hour local civil date. Native timezone acceptance remains necessary.
- Any manual calendar mutation invalidates ephemeral Recovery Undo; safety beats an undo that might reverse something other than what the user last approved.

## 2026-10-15 — Cross-boundary contradiction audit

- Undo eligibility and implementation must enforce the same **meaningful** conditions: live Focus is an Undo blocker even when the checkpoint is younger than five minutes and its blocks match saved times. A malformed checkpoint should never advertise Undo.
- A direct-move preview is anchored to the SQLite `updated_at` of the block on first user interaction; do not silently retarget to refreshed records. The transparent ghost obeys the same overlap-lane geometry as the committed layout.
- Focus time is recorded when a transaction actually creates the running session, not when the action begins waiting behind unrelated serialized writes. Recovery checks freshness before and after acquiring the exclusive transaction. Fixed clocks are injectable for deterministic testing, without production time freezing.
- Budget rollups re-read persisted Focus records whenever the parent weekly history reloads. Session `startedAtMs` differentiates replacement of a running session with another session on the same Timebox.
- Portable restore is a separate data entrypoint that must not bypass domain scheduling duration rules. Enforce input bounds in `parseBackup` for legacy and current backup formats before any database mutation.
- Deliberately defer a monotonic cross-restart Focus clock solution pending OS/device research, and do not claim overnight attribution is exact; physical background behavior, native reporting and backup recipient reliability remain release gates.

## 2026-10-15 — Make cross-device merge and time guarantees explicit

- Keep the SQLite local record as authoritative on matching backup IDs; expose counts of incoming *missing*, *identical* and *different* records before restore. A user confirms any divergent local-ID content instead of discovering silent skips afterwards. Inspect candidate IDs only, in bounded query batches; recheck preview counts before inserting inside an exclusive transaction.
- Scheduling a new OS Focus reminder must not cancel an existing reminder *before* the replacement schedule succeeds. Android exact-alarm special access is independent of Notification permission and may be denied by default. No background notification is guaranteed; the SQLite Focus timer remains the source of truth.
- Existing Evrida reservations are fixed UTC instants displayed in the device's current timezone. Historical Focus rollups are grouped by **session end**; changing either semantic requires a deliberate data-model migration and revised reporting, not a UI-only switch.
- A three-layer 24h strip is explicitly a *summary*. Show its maximum concurrency when over three so it cannot hide that it is lossy; use the full overlap-lane timeline for detail.
- Preserve Android OS auto-backup defaults until privacy versus recoverability is decided with device QA; don't turn it off during a no-data-loss hardening pass.


## 2026-10-27 — Evrida brand and learning-planner direction

- Product name: **Evrida**. Tagline: **Every day with Evrida**.
- Learning should be modeled as a resource-aware project with units, workload estimates, scheduled sessions, observed pace and learning evidence, not as a note or an unstructured checklist.
- Initial estimates must be ranges with visible assumptions and confidence. Minutes spent are not a proxy for mastery; use recall/assessment signals where the user supplies them.
- Missed-session re-planning is opt-in. The scheduler may move only flexible learning blocks and must not silently move fixed commitments, active Focus sessions or locked blocks.
- Keep the first learning-planner implementation deterministic and offline-first. AI-assisted resource extraction is optional and deferred until the core workflow is validated.
