# Evrida development roadmap

Last reviewed: 2026-10-27
Status: **M0 complete; M1–M6 partially implemented and verified at the levels below. Store release is not approved.**
Release targets: **Android and iOS**. Native Android can be built locally; native iOS acceptance needs Apple tooling. Desktop is deferred.

This file is the single source of truth for **planned vs completed** work. It is public: record implementation milestones here, not private product research.

## Tracking rules

- `[x]` = merged to `main` and checked at the appropriate level.
- `[ ]` = not completed. An unverified file or mocked screen is **not** a finished feature.
- Mark work as `BLOCKED` with a reason and a specific next action.
- At the end of each implementation session, update these checkboxes and the next-three-actions section **in the same commit**.
- Do not mark a milestone complete until its exit criteria have evidence (build, test, screenshots, or device verification).
- Scope changes go in [DECISIONS.md](DECISIONS.md).

## Overall progress

| Milestone | Scope | State | Exit gate |
| --- | --- | --- | --- |
| M0 — Foundation | Documentation, repository hygiene, Expo shell | Complete — emulator screenshot + CI | Clean install, typecheck, successful device startup |
| M1 — Product UX | Information architecture, design tokens, prototypes | Daybreak refinement implemented; Android renders sampled; user aesthetic acceptance open | Approved screen map and verified interactions |
| M2 — Goals & horizons | Persistent data, hierarchy, seven horizons | SQLite v8; real SQLite integration and sampled native flows pass | Complete device acceptance matrix |
| M3 — Planning views | Boards, calendar, time blocks, fast capture | Implemented; native keyboard, time editing and cross-view Focus sampled | Full cross-view and device matrix |
| M4 — Personal systems | Notes, repeating items, habits, templates, reviews | Plain notes, recurrence, weekly Review and four guided starters; habits/user-saved templates and Learning Projects remain planned | Accepted offline workflow scope |
| M5 — Mobile integration | Notifications, widgets, localization, backup | Native picker/backup/reminders implemented; widgets/localization remain open | Physical-device and Apple acceptance |
| M6 — Quality & release | Performance, accessibility, testing, release build | Isolated Android release QA APK built; iOS JS export passes | Store signing, native iOS, physical-device and accessibility gates |

## Reference synthesis and completion hierarchy — 2026-10-27

Implemented the design synthesis of the current Daybreak app and the supplied light/dark planner reference. Kept the warm paper / ink-blue foundation, Fraunces, turquoise actions, horizon colors, glass dock and the four implemented destinations. Removed the duplicate unlabeled horizon strip; the labeled picker now scrolls and retains the seven horizon hues. A shared explicit completed/total indicator serves Plan, horizon overview, Boards and direct next steps. Goal titles precede parent badges, direct next steps precede Focus in details, and civil planning keys use human-readable period labels. Boards places its single create action in the header and keeps the selected board title beside Back.

Checked in this slice: TypeScript; all 20 domain/real-SQLite tests and the database/design source guards; QA identity check; standalone Android x86_64 release APK built and installed in place; iOS Hermes export. Sampled native light/dark Plan, Horizons, goal hierarchy and Boards; 320dp dark Plan/Boards at 130% text; 320dp Plan progress wrapping and picker scroll to Life at 200%; long quick-capture draft continuity into Details and back; completion/reopen changing Plan from 6/8 to 7/8 and back; child completion to 1/4 without parent auto-completion; saved child state after reinstall/cold start; and a newly started Focus timer restored after force-stop and still present in Calendar. This is emulator evidence, not physical-device, TalkBack, native iOS or user aesthetic acceptance. At 200% text, the header needs scrolling to reach task content; the controls and progress labels reflow rather than suppressing system text scaling.

The initial local native build failed because the SDK's copied WinLibs Ninja could not find matching runtime DLLs. Prefixing this build process's PATH with the existing WinLibs bin directory allowed the native build to complete, with no SDK files or dependency versions changed. The pre-existing App checks failure is still the Expo alignment gate: seven installed package versions differ from SDK recommendations. `deps:check` fails on this candidate too; other passing checks do not make CI green. Native SQLite issue #2 remains open for the physical/ARM acceptance matrix.

Learning mastery/resources/reviews and optional Finance remain planned product implementations. This design slice adds no placeholder destination, invented progress or schema; a task-completion bar does not claim subject mastery. Next: (1) resolve the existing Expo compatibility/CI decision and physical Android/ARM lifecycle acceptance; (2) complete native iOS and screen-reader/large-text acceptance; (3) implement Learning and optional Finance with domain data, versioned backup and their own device evidence before expanding root navigation.

## Plan interaction refinement — Oct 16, 2026

**Implemented in source; native visual and interaction acceptance remains open.** Plan now separates open goals and an explicitly expandable Completed section. Goal cards can preview up to three actual child goals, open or complete them directly, and lead to all steps in the existing detail sheet. Search retains completed results and labels their planning contexts. Quick capture names its destination and reports successful saves. The Studio palette and the existing goal, scheduling, recurrence and Focus contracts remain in use; no schema or dependency change was introduced.

Same-context reads retain mounted rows so expanded step previews can refresh after writes; changing the period or search still waits for its own result. Empty search results and a list containing only completed goals have distinct paths. These source behaviors require the native interaction checks below before UX acceptance.

Checked: TypeScript, all 20 domain/real-SQLite cases, the shared database/design source guards, Expo dependency alignment and Android/Hermes export. The local debug native build failed during CMake/Ninja generation (`build.ninja` remained dirty after 100 attempts, alongside long-path warnings). The existing Android development binary received the new Metro bundle; an isolated temporary database reached schema v8, but startup/initialization stalled and earlier cold starts produced Android ANRs. An existing QA native binary was also tried with the new Hermes bundle; that is not a successful Gradle build or native acceptance. No application data reset was used, and the temporary database-name source change was reverted.

- [ ] Verify inline child expansion, completion refresh, detail/back navigation and more-than-three-step access on Android.
- [ ] Verify Completed show/hide/reopen, a completed-only list, empty search, mixed-horizon search and changing periods without stale cards.
- [ ] Verify consecutive quick captures, Details draft preservation and destination feedback with the keyboard open.
- [ ] Inspect populated/empty light and dark renders, long titles, 130%/200% text and screen-reader behavior; verify persistence after restart.
- [ ] Native iOS and physical-device acceptance remain separate gates. No aesthetic approval or resolution of SQLite issue #2 is claimed.

## End-to-end edge-case execution — Oct 15, 2026

**User-approved scope: all listed edge cases.** The following are *source fixes* in this slice, not claims of full Android/iOS acceptance.

- [x] **Divergent backup preview**: Settings now reports genuinely missing, identical and same-ID-but-different records; restored existing records retain local values, and the user must explicitly confirm the merge. `restoreBackup` re-checks preview counts/tables inside the same exclusive transaction before any insert, aborting if the expected state changed.
- [x] **Bounded merge preview**: Only the incoming IDs are queried in batches of 150 (including composite board-membership keys), avoiding full-table reads for a small incoming backup. An existing SQLite integration scenario verifies a 152-board merge across the batch boundary.
- [x] **Background Focus reminders**: Reconciliation first schedules the *replacement* reminder before cancelling previously scheduled reminders; failure to schedule no longer discards an older OS reminder beforehand. Android's notification permission and exact-alarm special access are described separately. Android 14+ may deny exact alarms by default; native delivery remains unverified. See [Android official policy](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms).
- [x] **Backward clock jumps**: running Focus remaining time is capped at the remaining amount saved at the last start/resume boundary. This prevents displaying *more* countdown time than was last saved, but cannot guarantee real elapsed time after a forward/backward OS clock change without a durable monotonic source.
- [x] **Restore × Ripple Undo**: any successful backup merge that actually inserts new data invalidates the ephemeral Ripple Undo checkpoint *inside the same transaction*. A no-op merge leaves unrelated state alone.
- [x] **Overlapping Timeline mini-ribbon**: A domain peak-overlap sweep identifies 4+ concurrent plans; the three-layer summary now warns of overflow and directs the user to the full lane-aware timeline instead of silently presenting three layers as complete. Adjacent non-overlaps are not counted as simultaneous.
- [x] **Past Timebox → new Focus**: Explicit confirmation says the new timer starts now for the original duration but does **not** move an expired historical reservation. If another Focus is active, its replacement still requires a separate confirmation.
- [x] **Reporting & travel clarity**: Settings documents that reservations are UTC instants displayed in device-local time. Weekly Review states that a session spanning midnight is **credited to its end day**, including paused sessions; it is not an exact attribution of each day's elapsed work.

**Remaining platform or product-dependent gates, intentionally OPEN:**

- [ ] Clock tampering/reboot/suspend: a durable monotonic cross-restart clock has not been implemented, because native elapsed-time semantics, boot detection, date-change behavior, and persisted paused segments need proven Android/iOS API behavior. `Date.now` remains vulnerable to arbitrary manual jumps. A warning alone is not a verified timer fix.
- [ ] Exact-alarm permission and reboot: Test Android 14/15 with separate Notifications permission, Special app access → Alarms & reminders, denied/granted/revoked, force stop, restart and battery optimization. Evrida cannot guarantee OS delivery. Source now retains old reminder until new schedule succeeds.
- [ ] OS-managed backup: Expo Android defaults to `allowBackup: true`; Android may back up app SQLite independently of user-exported readable JSON (Apple's device backup is also OS-managed). **Do not turn off native auto backup without a privacy vs recovery product decision and native migration acceptance**; existing UI explains the possibility.
- [ ] Actual restore of a large 10-MB snapshot on weak Android hardware: benchmark CPU, UI responsiveness, corruption rollback, cancellation and process interruption, not only the 152-row SQLite CI sample. Batching currently optimizes *preview*, not native insert throughput.
- [ ] Review cross-midnight accuracy: current historical `focused_ms` aggregates paused/running segments but does not persist exact intervals per day. Precise split requires a schema migration, backup v3, and multi-zone semantics; don't invent per-day times from session start/end.
- [ ] Timezone “floating” scheduling mode: existing stable UTC instant is explicit; switching reservations to local 09:00 across travel would require a new timezone-anchor field and migration, not a cosmetic clock conversion.
- [ ] Concurrent navigation refresh and deeply overlapping Native gesture layouts: current React focus/revision guards and source overlap count reduce risk but don't replace EAS Maestro/device recordings.
- [ ] Real-world privacy of plaintext exported JSON and OS cloud backup status: verify with an isolated QA installation; never test destructive restore on the only copy of a user's plans.
- [ ] Android Native expo-sqlite P0 [#2](https://github.com/Nishef1/Evrida/issues/2) and visual/gesture Native acceptance [#3](https://github.com/Nishef1/Evrida/issues/3) remain release blockers.

**Self-critique:** Don't equate prepared test cases and passing TypeScript/SQLite simulations with real native reboot, wall-clock tampering, animation responsiveness, notification delivery or store readiness. Avoid adding more general-purpose state, sync or AI features until the native acceptance matrix is proven.

## Additional edge-case sweep — recovery, OS boundaries and UX truth (2026-10-15)

The prior cross-feature audit covered many happy paths. This pass checks *format fidelity*, large-but-valid identifiers and OS/user transitions that normal JS bundle tests cannot certify.

**Source defects fixed:**

- [x] A valid backup was measured as **compact** JSON in `exportBackup` and then written as **pretty-printed** JSON in Settings. Near 10 MB, that could create a file exceeding the **importer's own** size limit, rendering the saved copy unrestorable. Save the identical compact representation that `parseBackup` validated; no artificial new limit, encryption scheme or storage subsystem.
- [x] A Board membership used `JSON.stringify([board_id, goal_id])` as its in-memory composite uniqueness key but applied the single-ID 200-character limit to the **whole pair**. Two individually valid 120-character IDs made that pair invalid. Validate the two ID components independently, keep the collision-proof serialized tuple as the Set key, and cover it with an existing backup test.

**New cases that still require evidence or a product decision:**

| Area | Case | Next requirement |
| --- | --- | --- |
| Device time zone | A 09:00 reserved **instant** changes wall-clock display when the user travels across zones | Choose explicit “device-local display” versus “floating home-local reservation” semantics; test travel and DST transitions |
| Day boundary | Focus running across midnight and a weekly boundary currently contributes history to its **end** date rather than prorating elapsed work | Decide reporting contract, then write interval-split fixture tests if the UI promises daily Focus |
| Focus duration | User launches an existing Timebox days after its scheduled date | Define whether a Timebox is a reusable duration or a reservation in clock time; test in-app language |
| Clock manipulation | System clock jumps backward while Focus is running; deadline-based `Date.now` extends remaining time unexpectedly | Native monotonic-clock experiments, including restart and suspend; avoid assuming background JS execution |
| Notifications | Permission revoked, system reboot, OS exact-alarm limits, expired alert during rescheduling | Real Android/iOS tests with Focus stopped, paused and replaced; Expo notifications queue uses separate OS state |
| OS backups | Device backup may copy SQLite app database even if Evrida has no sync, depending on native backup settings | Verify app configuration and wording on Android 12+/iOS device backup |
| Large imports | A bounded valid 10-MB JSON backup may carry thousands of rows and slow a transaction or exhaust memory | Benchmark real native restore, interrupted import and “no partial write” rollback |
| App lifecycle | Two overlapping refreshes return data across a mutation; page may briefly pair stale goals with fresh blocks | Measure and decide whether an atomic read snapshot is necessary, rather than adding a second global store |
| Dense UI | Three-lane ribbon represents fourth+ overlapping items on an already occupied lane | Device screenshots with 4–12 overlapping reservations; show density/overflow rather than hiding actual conflicts |
| Long IDs and archives | Restoring a valid graph to a device with same IDs but divergent parent/board meaning | QA-only dry-run with safe user-facing merge/conflict summary; current restore preserves local IDs and values |

Keep P0 native expo-sqlite issue #2 and P1 visual/native gesture issue #3 open. The two fixed defects have JS/SQLite test evidence, but full backup export/share recipient, physical time shifts and actual restore UX remain unverified.

## Neglected contradiction audit — data lifecycle, time and truth in UI (2026-10-15)

This sweep is intentionally **cross-boundary**, not another palette refactor. It verifies the lifecycle Capture → Calendar → Timebox → Focus → Review → Backup against source, active SQLite tests and Expo/React Native/SQLite specifications.

### Source corrections (automated tests, not physical-device certification)

- [x] **Undo eligibility contradiction:** `canUndoReplan` previously offered a valid-looking five-minute Undo even if a moved reservation was now active Focus. It now checks the active Focus block and malformed before/after checkpoint shape, as well as the already-established block revision, completion and archive eligibility. Actual Undo remains transactionally guarded.
- [x] **Different editing safety by surface:** Drag/Resize preview now records the source block's `updated_at`, and its exclusive apply rejects a changed timestamp even when the visible content is identical. An in-progress UI drag remains pinned to that source revision instead of silently rebasing onto a new calendar state.
- [x] **Review split-brain:** Changing a Focus session on the *same* Timebox changes its start time but not its block ID; Review now keys reloads to the new session start. Its independently loaded Time Architecture budgets now refresh when the parent weekly history changes.
- [x] **Timer and preview time-of-check gap:** Quick Focus starts its absolute deadline inside the actual SQLite transaction rather than before waiting in the queue. Recovery validates the preview's two-minute freshness again *inside* the exclusive transaction. Existing test scenarios simulate the time advancing across this boundary.
- [x] **Visual overlap misrepresentation:** Ghost Preview now uses the same lane placement as existing reservations instead of rendering full-width over conflicts.
- [x] **Backup validation gap:** imported time blocks must obey the same 1-minute to 24-hour duration bounds as normal scheduling, not merely end-after-start. Existing tests reject both fabricated 25-hour and sub-minute entries prior to SQLite writes.
- [x] **Misleading copy:** the editor no longer describes all ordinary reservations as both "protected" and freely movable; only explicit Flexible opt-in grants Recovery permission to move them.

### Open blind spots, deliberately not marked fixed

| Priority | Blind spot | Evidence necessary |
| --- | --- | --- |
| P0 | Native Android expo-sqlite lifetime crash | Reproduce, capture native stack and verify on Android OS/SDK matrix, including settings transitions and process restart — issue #2 |
| P1 | Nested ScrollView drag/responder behavior, long-press and screen-reader adjustable grips | Native video, font 100/130/200%, portrait/landscape, VoiceOver/TalkBack — issue #3 |
| P1 | Backup restore to populated/diverged device and plaintext cache/sharing recipient behavior | Destructive tests **only** on isolated QA, with externally verified saved copy, cancellation and v1/v2 roundtrip |
| P1 | Wall-clock tampering/time synchronization during a running Focus timer | Native suspend/restart/manual clock-change experiments; current deadline-based model uses `Date.now`, not a durable monotonic clock |
| P2 | Large-data responsiveness and expensive list/layout operations | Measure CPU/memory/scroll jank on midrange devices with realistic 100–1000-goal fixtures before adding cache or virtualization |
| P2 | Analytics semantics across midnight / history imported from another timezone | Validate explicitly that completed sessions are grouped by **end date**, not sliced into exact local-day work segments |
| P2 | Bounded 10-MB portable backup export | Stress legitimate large goals/notes and surface a clear capacity fallback before product scale increases |

**CTO rule:** never confuse passing 20 automated *test cases* with completeness. Large lifecycle cases still contain many assertions but cannot certify native interactions, performance, real restore recipients, or all clock changes. Prefer adding a targeted test when a distinct invariant requires one rather than preserving an arbitrary case-count as a quality metric. Avoid a duplicate state manager or sweeping CSS rewrite; these fixes belong to the existing SQLite, domain and React Native boundaries.

## Systems-level self-audit — data and lifecycle coherence (2026-10-15)

**Scope:** Capture/Plan → Calendar/Timebox → Focus → Review → Backup. Rather than create a global client-state library or a second event store, repair the three actually inconsistent hand-offs.

- [x] **Ordinary Timebox editor:** pass its originally loaded block into `saveBlock` and verify ID, goal, time range, type, flexibility, intention, and `updated_at` inside an exclusive transaction. The previously added Drag preview already guarded stale edits; normal edit now has the same safety promise.
- [x] **Completed goals:** never create or move a Timebox onto a completed/archived goal. Historical reservations remain readable, and Focus history remains durable; avoid letting another writer schedule a task that is already done.
- [x] **Recovery/Undo:** any explicit Timebox save or delete invalidates a prior replan checkpoint in that very same transaction; manually edited reservations must not leave a misleading or unsafe Undo promise.
- [x] **Focus → Review:** Review now refetches weekly history when the shared active Focus block identity changes, including ending a timer while Review itself is open. No second provider or mirrored Focus state.
- [x] **DST:** on 23/25-hour days disable the misleading 24-hour Day timeline, render List explicitly, and include UTC offsets on saved instants to distinguish duplicated local clock times. Keep the selected mode control aligned with the actual rendered view.
- [x] Extend existing real SQLite assertions for stale editor writes and completed-goal scheduling. Do not inflate the fixed 20-test budget with speculative suites.

**Open system-level risks:** Android SQLite native SIGSEGV (#2), gesture/rendered acceptance (#3), native iOS, accessible fonts, real-data restore and independent release signing. Dense board/calendar lists could merit FlatList/SectionList only after profiling on constrained devices. The current offline, single-user architecture does not justify cloud sync, an AI scheduler, complex global state management or a second theme layer.

**Self-critique:** The new `TimeBlock.updatedAt` is deliberately optional for synthetic/local read models, but authoritative SQLite-loaded blocks contain it. The production editor passes the original snapshot; direct domain callers not passing an expectation are still responsible for their own stale-write policy. Native screenshot, screen-reader and device stress acceptance remain unverified, and source CI passing is not store-readiness proof.

## SSOT and StyleSheet review (2026-10-15)

**Code-level findings resolved:**
- [x] Calendar's header previously summed overlapping reservations while Week and Month cards displayed unique occupied wall time. Day, Week and Month headers now use `analyzeRangeLoad` / `analyzeDayLoad` from `src/domain/timeblocks.ts`, with both `reservedMinutes` and `occupiedMinutes` available but the on-screen label explicitly saying **occupied**.
- [x] Calendar previously executed three overlapping block-range SQLite reads and kept three independent React arrays. It now loads the visible month-grid range **once** into `calendarBlocks`, and derives Day/Week selections using one common `blockOverlapsRange` predicate. The selected week is always inside the selected month's Monday–Sunday grid. Focus-history and goals remain separate canonical datasets.
- [x] Month no longer carries an extra local overlap calculation; Week and Month both reuse domain time accounting. The daily list and weekly/monthly cards agree on interval inclusion.
- [x] Shared semantic schedule colors are defined in `src/theme/tokens.ts`, not repeated as literals in Timeline, Calendar List, time-allocation bars and Now line. Completion no longer fades the *entire block* and therefore does not reduce its already-small label's contrast.
- [x] Light/dark warning and danger ink use explicit theme variants. Critical destructive actions and Focus alert text no longer rely on one color that was hard to read in one scheme.
- [x] The duplicate `Palette` union used in thirteen screens/sheets was replaced by a single exported type.
- [x] Month activity count increased from 8dp to 11dp with more vertical room. Existing zoom levels and large touch controls remain unchanged.
- [x] Real domain tests cover clipped overlaps and the 4.5:1 white-text contrast of primary schedule surfaces. `scripts/check-design-ssot.mjs` runs in Domain CI to reject palette-type duplication, reintroduced inline semantic colors and multiple calendar event collections.

**Deliberately not generalized:** React Native's `StyleSheet.create` is local to each screen by design: flex structures and page-specific dimensions are not duplicated concepts just because their numeric values match. A global "CSS class for every row" would add complexity and conceal intent. Standard `colors`, `spacing`, `radius`, `depth`, `semantic` and the shared `Palette` type are the appropriate cross-screen contract.

**Remaining acceptance and risks:** Text at maximum OS font scale may still need responsive restructuring (not blanket fontSize replacement), especially Calendar ribbon, compact blocks, Board lens and Review graph. Native dynamic font scaling, TalkBack/VoiceOver, clipped flex layouts and gesture negotiation must be checked on Android/iOS. The native SQLite SIGSEGV remains [P0 issue #2](https://github.com/Nishef1/Evrida/issues/2), unrelated to StyleSheet tokens. UI appearance has not been physically screenshot-reviewed. This source audit is not a claim of full visual polish or store readiness.

## Premium daily time interaction: design correction pass (2026-10-15)

- [x] Repair the zoom-dependent empty-hour hit target: its actual pressable height now follows the displayed zoom-level hour height.
- [x] Add native React Native responder-based move and resize grips for long single-lane blocks, a long-press/stepper path for dense or short blocks, and screen-reader adjustable increment/decrement actions.
- [x] Move and resize in 15-minute snapped increments; show a live dashed Ghost on the day timeline, with explicit Apply or Cancel. No change is persisted during a drag.
- [x] Add a dedicated exclusive SQLite guarded write for direct timeline previews. Validate the original reservation, active Focus, completion, date, minimum duration and live overlap count. A confirmed manual edit invalidates stale Recovery Undo.
- [x] Show Ripple before/after times as a pair of visual tracks on a time scale fitted to the affected range; preserve exact textual labels for assistive technologies.
- [x] Replace arbitrary per-goal timeline tones with semantic Timebox/planned/completed colors and readable status labels.
- [x] Make the compact 24-hour ribbon multi-lane and tappable for six-hour jumps. Keep the DST 23/25-hour fallback to exact List.
- [x] Week and Month bars now represent unique occupied wall time, and weekly conflict text explicitly flags overlap.
- [x] Restore a direct Open Goal link in the move/resize panel after changing long-press semantics. Expand Now/Zoom controls to 48dp and correct the Now pill's white-text contrast.
- [x] Extend existing 20-test domain/SQLite policy with quarter-hour math, preview bounds and atomic stale-edit checks. CI confirms JavaScript bundle/type validity, not gesture success on a device.
- [ ] Android native touch test for long drag grips vs parent scroll, short/dense item long-press, cancel, and Save after zoom; run at 56, 76, 104dp/hour, 100%, 130%, 200% fonts, both themes, TalkBack and landscape.
- [ ] iOS Simulator/real-device review for responder negotiation, VoiceOver's increment/decrement actions, day ribbon safe area, low-end rendering and reduced-motion.
- [ ] Visual user acceptance: live screenshots/videos of Plan, Boards, Calendar (empty/dense) and Review; no automatic claim that these changes make every screen finished.
- [ ] The Android SQLite native lifecycle P0 [issue #2](https://github.com/Nishef1/Evrida/issues/2) remains open; successful CI does not clear release.

**Self-critique:** Native long-block grips are not identical to a polished physics-based draggable calendar. The deliberate fallback for sub-hour and overlapping blocks is a stepper / exact editor so controls do not occlude data. Gesture latency, accessibility, hit-testing and user aesthetic preference have not been confirmed by on-device recordings.

## Native gate enablement and SQLite access audit (2026-10-15)

**Implemented and verified in source/JS CI, not yet accepted on an Android/iOS device.**

- [x] Resolve a real missed raw SQLite access in `AppDock`: goal-path reads now use the same guarded per-handle connection as Plan, Boards, Calendar, Focus, Review and Settings.
- [x] Add a zero-dependency source rule (`scripts/check-database-access.mjs`) to the domain workflow and npm script. A new feature component cannot silently bypass `useEvridaDatabase`.
- [x] Keep the already-existing `app.config.js` QA variant, without introducing duplicate native configuration. Add an EAS `e2e-test` profile and CI assertion that both QA IDs have a `.qa` suffix while production IDs remain unchanged.
- [x] Prepare separate Android APK and iOS Simulator build/test jobs through EAS Workflows and isolated Maestro navigation/quick-capture flows; outputs target `com.nishef.evrida.qa`. See [NATIVE_ACCEPTANCE.md](NATIVE_ACCEPTANCE.md).
- [x] Add emulator-only Android font/theme stress script, native crash-buffer collection and local-only `.qa-evidence/` ignore rule; never alter phone settings or wipe main app data from scripts.
- [ ] **EAS project authentication/linking** and actual native Android/iOS smoke run. Existing CI validates the files and identities; it does not execute the EAS Maestro jobs.
- [ ] Reproduce/diagnose issue [#2](https://github.com/Nishef1/Evrida/issues/2) with emulator/physical native evidence before a release or any claim of crash resolution.
- [ ] Complete manual Focus, Recovery, backup, accessibility and store signing gates in [NATIVE_ACCEPTANCE.md](NATIVE_ACCEPTANCE.md).

**Self-critique:** Passing TypeScript and exporting Android/iOS JavaScript previously allowed the team to overestimate coverage. Native E2E workflows are now prepared, but it would be inaccurate to call them passing until an actual simulator/device build is run. The QA variant existed already; rebuilding it from scratch would have been redundant and riskier than extending its EAS profile.

## CTO feature gate — whole-product audit (2026-10-15)

**Decision: improve the shipped core, do not add another headline feature in this slice.** The seven horizons, editable goals, Boards, day/week/month Calendar, global Focus, Review, Guided Plans and protected Recovery provide a sufficiently complete first-version workflow. More feature inventory does not solve unverified Android SQLite lifecycle or native platform acceptance. See `docs/CAPABILITIES.md` for implementation boundaries.

| Area | Existing value | Main gap and next gate | Decision |
| --- | --- | --- | --- |
| Horizons, Inbox, Guided Plans | Capture, editable long-term goals, starter paths | Native first-run discoverability, many-goal performance and keyboard/screen-reader acceptance | Refine, no new goal model |
| Boards | Shared goal collections with open/scheduled/done lenses | Persistent independent board order/sections would require schema and new backup contract | Defer feature; test current UI |
| Calendar & Living Timeline | Detailed day, week, month, measured linked Focus and overlapping reservations | Native UI, DST, overnight attribution and Recovery safety | Improve and validate |
| Ripple/Recovery | Explicit Flexible flag, safe preview, guarded apply and temporary Undo | Avoid overwriting later edits and never suggest an unusable Undo | **Fixed in source** |
| Focus | Persistent running/paused session and recorded outcomes | Completed-goal Timeboxes were inconsistent with Quick Focus; global panel could show a stale session | **Fixed in source** |
| Review & Time Architecture | Goal-linked Focus and user-set weekly capacity | Overlapping same-goal reservations overstated actual occupied weekly time | **Fixed in source** |
| Backup, settings & privacy | Offline v2 export, strict legacy v1 import, local health checks | Unencrypted cache files and device recipient/cancellation acceptance | Native test before claiming safe |
| Mobile integration | Native navigation, pickers and notifications | P0 expo-sqlite crash, native iOS, VoiceOver/TalkBack, OEM notification behavior | **Release blockers** |
| Next-wave ideas | Habits, widgets, capture from shares, Jalali/RTL, saved templates | Platform/API or schema investment without verified core journeys | Defer; reopen only after release gates |

**Reliability changes in this slice:**

- [x] Weekly Time Architecture counts the union of each goal's own reservations and descendants' reservations, rather than double-counting overlapping periods; independent goal budgets remain independently scoped.
- [x] Undo checkpoints retain the applied block's timestamp, owner, type and intention. Undo rejects changes made after the preview and does not reverse newly completed or archived goals.
- [x] The Undo action now checks that all moved reservations are still eligible, instead of showing a button until a transaction fails; SQL transaction remains the definitive guard.
- [x] Timebox-based Focus now rejects completed goals, matching the existing Quick Focus rules. Completing a goal closes its active Focus within the completion transaction, keeping recorded history.
- [x] Plan and Boards refresh the shared Focus provider after completion so the cross-screen Focus panel does not continue displaying the closed timer.
- [x] Real SQLite/Node test coverage extends existing test scenarios for overlapping weekly allocations, protected Undo following a later edit, and Focus completion behavior; retain the 20-test suite policy.
- [ ] Native Android/iOS verification of completion while running/paused Focus, Expo notifications, and corrupted/recreated Undo checkpoints.
- [ ] Native Android SQLite SIGSEGV P0 issue #2. Source fixes and JavaScript bundle CI do **not** close this blocker.

**Remaining product decision:** Next engineering capacity should go to native QA and the data lifecycle; do not prematurely add AI suggestions, habits, team sync, or more navigation destinations. After P0 and Android/iOS acceptance, evaluate localization/Jalali and share-to-capture with user tests and explicit platform scope, then saved templates or habits. If Core journeys fail, return to fixes before growth features.

## Self-critical reliability and usability pass (2026-10-15)

**This pass intentionally improves previous work instead of adding a parallel subsystem.**

- [x] Recovery previously kept a frozen preview open beyond its two-minute validity window. Added explicit Refresh and disabled Apply after expiry, with foreground awareness.
- [x] The Calendar Undo action previously stayed visible after its underlying five-minute checkpoint expired. It now rechecks availability while present and hides the expired affordance.
- [x] Guided Plans were hidden behind a workspace menu: provide a direct, accessible starter from an empty planning horizon.
- [x] Weekly time budgets previously reported numbers without an interpretive next action. Show exact difference versus the user's own target and link directly to Calendar without assigning a moralized score.
- [x] Existing focus time totals could imply all recorded minutes occurred on the selected civil day when a session crossed midnight. Label displayed totals as linked Focus and distinguish sessions ending here from active time; full paused-segment day allocation is deferred.
- [x] Recovery snapshot equality previously compared locale-aware JS ID sort against SQLite binary ordering. Compare canonical binary-sorted snapshots, including backup-imported IDs.
- [x] Add an on-demand, non-destructive, local SQLite `quick_check` plus `foreign_key_check` to Settings. Automated testing confirms an orphan can be detected even when structural quick check reports `ok`.
- [x] Backup exports no longer leave plaintext JSON in the permanent Documents directory; stage in app cache and prune only older temporary exports on subsequent sharing to avoid disrupting external receivers.
- [ ] Native sharing acceptance: test Save to Files, cloud-drive recipient, cancellation, slow external import, and cleanup of cache exports after 24 hours. A closed share sheet is not proof an external copy was saved.
- [ ] P0 Android SQLite crash remains unresolved. A passing on-demand health check is not a native lifecycle stress test.
- [ ] End-to-end Android/iOS native accessibility and screen orientation checks remain open.

**Self-criticism:** The extra on-screen budget guidance is deliberately deterministic and descriptive. It does not claim to predict energy, psychological productivity or task urgency. Cached plaintext JSON is still readable until the OS clears it or a later export cleans up; Evrida does not implement end-to-end encrypted backup or secure deletion.

## Cohesive planning follow-up — source and CI slice (2026-10-15)

**Completed in source / CI checks (not phone acceptance):**

- [x] Four Guided Plans: quarter/week/month canonical parent goal and four genuinely editable, undated Inbox children, created in one SQLite transaction; invalid choices or titles cannot leave partial data.
- [x] Board lenses for Open, Scheduled, Done and All reference the same goal identities; changing completion from a board still updates Plan and Calendar.
- [x] Day-level ribbon makes the distribution of reservations visible before scrolling the exact timeline; days with 23/25 actual hours omit this simplified overview rather than hide DST ambiguity.
- [x] Count reservation duration separately from actual occupied time; expose overlapping scheduled time rather than treating simultaneous blocks as independent elapsed hours.
- [x] Connect Time Architecture allocations to Calendar's existing goal-aware scheduling route.
- [x] Bound last-replan Undo to five minutes, with a guarded rollback if the underlying reservations changed.
- [x] Refresh Calendar and layout when returning after a timezone change, even if the local date still has the same YYYY-MM-DD key.
- [x] Maintain the existing 20-case test budget; add guided-plan atomicity and overlap math assertions to existing test scenarios.
- [ ] Native Android/iOS acceptance for Guided Plans modal, list filters, day ribbon, timezone refresh, overlapping scheduled blocks and focused screen-reader actions.
- [ ] Test large goal lists/board lists on constrained phone hardware and implement virtualized/grouped lists if profiling warrants it.

**Release blockers, unchanged:** Native Android SQLite SIGSEGV on live theme/font configuration transition (issue #2) needs reproduction and fix; physical-device Focus/notification checks, iOS native build and accessibility validation remain open. Source and JavaScript bundle acceptance cannot replace these gates.

**Strategic scope remaining:** complete habits with explicit skip rules, saved user-defined templates, independent persistent Board ordering/sections with a versioned backup contract, RTL/Persian and Jalali display, home widgets and share-to-capture. These require their own schema/platform/QA decisions; do not treat unsaved UI sorting as persistent order or software-only bundling as a widget.

## Adaptive daily planning — implementation slice (2026-10-15)

The following items describe code merged into `main`, **not independently accepted device behavior**.

- [x] Add schema v8 without discarding goals, boards, time blocks, Focus history or completion history. Old blocks remain protected; old Focus events remain unattributed.
- [x] Mark each saved Calendar reservation protected or flexible in the native editor. Carry the flag through backup format v2 and accept validated legacy v1 backups as fixed, unattributed records.
- [x] Implement Living Timeline measured Focus progress for attributed sessions and show fixed/flexible distinctions in Calendar.
- [x] Add deterministic recovery for today's future flexible blocks, a 15-minute breathing buffer, and 15/30-minute extension previews. Show old/new times and require confirmation.
- [x] Apply only if the preview still matches SQLite state; block active Focus edits; checkpoint and transactionally undo the last replan. No silent mutation of goal identity/deadline/horizon.
- [x] Add weekly goal time budgets, including planned reservations versus measured Focus, and a small Goal Impact overview in Review.
- [x] Extend existing 20 tests with real SQLite apply/undo, weekly budget and legacy-backup checks, plus deterministic scheduler constraints.
- [ ] Validate complete Recovery UI on a real Android device/emulator (font scaling, keyboard, overlapping time blocks, Focus running/paused, canceled dialogs, app suspension, undo).
- [ ] Validate iOS native runtime and VoiceOver; do not treat JavaScript export as iOS certification.
- [ ] Validate daylight-saving transition days, timezone changes, overnight sessions and backup migration from native test data.
- [x] Regenerate locked Expo 57/Expo Router patch dependencies; clean npm ci, SDK compatibility, TypeScript, 20/20 tests and both JS exports passed in the one-time verification workflow.
- [x] Introduce a per-handle SQLite statement/transaction serialization boundary shared by all seven feature/Focus consumers; maintain 20 tests including a 40-call concurrency assertion. Source-only crash mitigation, not a native fix.
- [ ] Reproduce, diagnose and close the observed Android native SQLite configuration-change crash. P0 tracked in [issue #2](https://github.com/Nishef1/Evrida/issues/2); SDK 57 native lifetime reports are suspicious but not proven identical.

**Product boundary:** No AI scheduler, automatic task deletion, invisible reshuffle, implicit promotion of existing events to flexible, or cross-midnight move is implemented. The current week budget is a target, not a hard restriction; overlapping planned reservations are not deduplicated. Older Focus entries without goal IDs cannot be retroactively assigned reliably.

## Current verification — Studio and native planning (2026-10-15)

This section is the current acceptance summary. Earlier dated slices below preserve implementation history; their pending statements are not new evidence against later checked work.

- [x] Ground a coherent mobile direction before code changes; implement neutral surfaces, restrained layered depth, vector icons, consistent segmented controls and labeled navigation. Keep private references and synthetic screenshots outside Git.
- [x] Sample actual Android release renders for Plan, Horizons, goal details, Focus, Calendar, Boards and Review, including populated goals, parent context and a board. This is builder review, not independent or user aesthetic approval.
- [x] Sample Plan in automatic light/dark and at 130% system font scale; open all seven horizon options and navigate to Year without clipping those sampled states.
- [x] Reproduce quick capture hidden behind full Gboard, fix root and modal keyboard avoidance, and hide the dock while typing. With full Gboard visible, create two separate daily goals; goal editor Save remains above the IME and dirty-close shows the discard choice.
- [x] Reproduce the quick-title loss when opening Details on the previous standalone Android QA build. Carry the title into the editor; native close retains the inline draft, reopen/save creates one visible item and clears that matching draft.
- [x] Add organizer shortcuts for Today / Tomorrow / This week / Inbox and direct 25-minute Focus. On Android QA, move the same synthetic goal through each destination and return to Today, then start and stop Focus. Sample the organizer in light at default text and dark with 130% text; verify substring-search results expose planning/Focus actions without misleading positional ordering. Real SQLite checks preserve parent, deadline, board references, reservations and recurrence anchor, and reject archived/completed/invalid moves.
- [x] Add native date jump from the calendar heading; on Android select October 22, 2028, verify the Month view reflects October 2028, cancel a second picker and return through Today. Display the year when outside the current year.
- [x] Rework smaller-step capture with a stable editor frame, parent context, title/notes first, bounded note scrolling, vector controls and optional wrapped planning choices. On Android QA, sample multi-part typing, Next-to-notes, long notes, saving above Gboard, one canonical undated child, return to parent after save/cancel, and Keep editing. Sample expanded planning in dark mode at 130% text. This is sampled layout stability, not certification of every keyboard/configuration sequence.
- [x] Add 15/25/50-minute quick Focus as an atomic reservation plus session; archive of the active goal/subtree closes its session with history. Extend the existing real SQLite test rather than exceed 20 cases.
- [x] Replace civil-date/time text entry with native pickers. On Android edit a Timebox end from 13:40 to 13:16; unsaved changes disable Start until Save, then the saved one-minute duration is used.
- [x] Fix the first notification prompt on Android: SDK 57 can return denied before the first system request. Verify the actual Allow prompt, the no-alert timer path, pause/end and recorded history.
- [x] Receive a real generic Focus-expiry notification after a one-minute session while the QA app is backgrounded. Exact-alarm access was explicitly allowed for this emulator sample and restored afterward. A denied exact-alarm path scheduled the SDK's inexact fallback; delivery timing in that path is not certified.
- [x] Restore a synthetic graph through the native file picker into the separate QA app: five goals, one board and eight total records, preserving canonical relations. Existing primary-app data remains untouched.
- [x] Build/install a standalone Android QA release with embedded Hermes and launch without Metro or network access. Check ZIP 16KB alignment and all 50 native ELF libraries' LOAD alignment for arm64-v8a/x86_64. The APK uses a debug certificate and a separate QA identifier; it is not store signed.
- [x] Pass TypeScript, SDK dependency alignment, 20/20 domain/real-SQLite cases and the current iOS Hermes export. CI also validates Android/iOS generated config; none of these is a native iOS runtime pass.
- [x] Add data-preserving startup Retry, malformed/oversized native-link guards, an unknown-route recovery page, reduced-motion support, initial app assets and isolated preview/production build profiles.
- [ ] Fault-inject and verify startup Retry on native builds; perform full Focus lifecycle/re-arm, permission denial, locked idle and OEM battery tests on physical devices.
- [ ] Verify TalkBack/VoiceOver, maximum text sizes, small-phone landscape/keyboard variants, reduced-motion behavior and native iOS render/interactions.
- [ ] Investigate the Android native SQLite crash observed while changing system font scale and theme with an editor draft open (SIGSEGV in `exsqlite3_step` / `pthread_mutex_lock`). Saved data survived restart; the live configuration-change path remains a release blocker. Do not treat static 130% render acceptance as a pass for this lifecycle path.
- [ ] Resolve remaining dependency advisories and store permission/privacy requirements. Current audit: 22 affected dependency entries from three root advisories; see ENGINEERING.md for reachability and mitigation boundaries.
- [ ] Configure store signing and public release metadata when the core app is ready. Publisher/contact details remain deferred at the user's request. No store upload or publication has occurred.

Next three actions: (1) reproduce and fix the native SQLite configuration-change crash (issue #2) despite the per-handle JS serialization mitigation, then exercise the full Android Recovery/Guided Plans/Board lens flow; (2) verify native iOS/VoiceOver, Focus permissions and backup restore with real device data; (3) after release blockers close, prioritize Persian/Jalali, native quick capture/widgets, habits, saved templates and independent board ordering through separately scoped design contracts. Widgets, native localization/Jalali, share-to-capture, templates and calendar drag remain unimplemented roadmap work.

## M0 — Foundation

- [x] Initialize repository on `main`, without a root README.
- [x] Create the public-safe documentation in `docs/`.
- [x] Add Expo + React Native + strict TypeScript starter source.
- [x] Add a minimal visual token file and starting screen.
- [x] Resolve dependencies and commit a real `package-lock.json` through a successful GitHub Actions npm installation.
- [x] Verify final `npm ci` reproducibility in CI (GitHub Actions passed).
- [x] Run `npm run typecheck` and `npx expo install --check` successfully in GitHub Actions.
- [x] Add dependency-free Node domain tests and a CI workflow; tests passed on GitHub Actions.
- [x] Launch the initial shell on Android emulator (screenshot supplied on 2026-10-14).

**Exit gate:** a reproducible clean install, no type errors, no Expo dependency mismatches, and a usable shell on Android. Source files alone do **not** pass this gate.

## First implementation slice (source delivered, runtime verification pending)

- [x] Add an interactive seven-horizon screen and previous/next period controls to source.
- [x] Add create/edit/complete/reopen/delete dialogs and a next-step entry flow to source.
- [x] Add SQLite schema v1, goal queries and writes, and a database startup migration to source.
- [x] Add tests for ISO weeks, date navigation, validation and migration guards.
- [x] Verify domain tests run successfully in CI.
- [x] Confirm TypeScript typecheck, Expo SDK alignment, and Android Metro export in CI (native APK build still pending).
- [ ] Verify actual create/edit/persist/restart on Android.
- [ ] Verify modal transitions, child relations and keyboard on a phone.

This inventory records committed implementation, **not completion of the M1/M2 exit gates**.

## Next implementation slice — Horizons 2.0

**Priority:** complete the relationship and scheduling foundations before introducing Boards or Calendar.

- [ ] Verify create/edit/complete/reopen/delete and persistence across emulator restarts.
- [x] Implement child-goal navigation with back-stack and editable nested goal details in source; Android interaction verification pending.
- [x] Implement parent selection/reparenting with recursive-cycle validation inside a SQLite exclusive transaction; device verification pending.
- [x] Implement period stepper, current-period jump and precise YYYY-MM-DD entry for daily goals; device verification pending.
- [x] Keep stable goal IDs across Focus/Perspective/parent context; multi-placement schema remains future work.
- [x] Implement seven-horizon Perspective overview with goal counts, previews, direct navigation and context-aware Add Goal (code committed; device review pending).
- [x] Add actionable empty-state guidance and align core action/touch-target dimensions in source.
- [ ] Validate Android status/system bars, keyboard, touch targets and modal behavior after new UI changes (not yet run on device).
- [x] Add pure unit tests for saved-period parsing, date input and parent-option descendant exclusion; integration/device tests still pending.
- [ ] Add SQLite integration tests for reparenting transactions and persistence.
- [ ] Run the entire workflow on the Android emulator and record findings.

**Exit gate:** create a Life goal, link smaller goals in multiple horizons, move and edit them without duplication, and reopen the app with the structure intact. No placeholder screen counts as complete.

## M1 — Product UX & design

- [ ] Inventory all major screens, actions, empty states, errors and navigation transitions.
- [ ] Define primary navigation for phone and adaptive layouts for tablet.
- [ ] Design Horizons for thumb operation; test tab switching and long lists.
- [ ] Define reusable typography, spacing, color, elevation, radius and motion tokens.
- [ ] Create accessible light/dark states, keyboard behavior and RTL examples.
- [ ] Validate interactive prototypes on at least one mid-range Android device.

**Exit gate:** real screen-flow specification, prototype/screenshots and clear acceptance rules. Do not clone proprietary visual assets.

## M2 — Data model, goals & horizons

- [x] Implement SQLite with transactional versioned migrations (v1 → v2); Android upgrade verification pending.
- [x] Stable IDs, parent relationships and persistent manual ordering implemented for the current single-placement model; multi-placement remains pending.
- [x] Create/edit/complete, reversible Archive/Restore, and safe subtree handling implemented in source; permanent deletion intentionally deferred.
- [x] Support Day, Week, Month, Quarter, Year, Decade and Life horizons.
- [ ] Implement zoom/navigation and moving items between horizons.
- [x] Prevent hierarchy cycles and accidental duplicate records with transactional validation and SQLite coverage.
- [x] Separate Horizon, UTC scheduled time blocks and optional civil-date deadlines in SQLite v7.
- [ ] Test date boundaries, leap years, DST, changing time zones and week starts.
- [ ] Restore saved data after force-close and restart.

**Exit gate:** a real complete offline flow from creating a life goal to seeing and completing related daily steps, with repeatable automated tests.

## M3 — Boards, calendar & capture

See [CAPABILITIES.md](CAPABILITIES.md) for the full implementation inventory, including features we have **not** built.

### Board vertical slice (schema v3)

- [x] Add additive v2 → v3 SQLite migration for boards and `board_goals` join table with foreign keys.
- [x] Create, rename, describe and delete a board without removing its goals.
- [x] Link/unlink existing active goals; a goal can be in multiple boards without being copied.
- [x] Create a new goal directly inside a board with an atomic goal + membership transaction.
- [x] View board progress and toggle completion of the underlying goal.
- [x] Open original goal details in Horizons and refresh board data on return.
- [x] Repair goal-editor initial scroll/autofocus and empty-parent-picker presentation.
- [x] Adapt three existing migration tests to v3; stay within the 20-test budget.
- [ ] Test upgrade of an existing v2 database, board membership, completion, archive filtering and navigation on Android.
- [ ] Decide whether boards need ordered sections, grouped lists or saved filters; in-context goal creation is implemented.



- [x] Build the first real Boards workflow: local boards with many-to-many references to existing goals. Device QA pending.
- [ ] Implement drag/reorder with accessible non-drag alternatives.
- [x] Build daily, weekly and monthly calendar views, plus List.
- [x] Implement time blocks separate from deadlines.
- [x] Add editor rescheduling, conflict display and inline capture; drag remains deferred.
- [ ] Ensure editing from any view updates all others consistently.

**Exit gate:** cross-view operations retain ordering and data after restart, verified with device interactions and persistence tests.

## M4 — Notes, recurrence & reflection

- [ ] Add notes and formatting only after editor selection is proven on-device.
- [x] Add completion-triggered daily/weekly/monthly/yearly recurrence; advanced exception calendars remain deferred.
- [ ] Implement habits and flexible progress measurement.
- [ ] Build reusable templates and guided multi-step plans.
- [x] Add actual completion/Focus history and weekly Review with explicit earlier-period decisions.
- [ ] Handle recurring-item edits, DST and skipped occurrences safely.

**Exit gate:** recurring and rich-content workflows work fully offline, including app restarts and history preservation.

## M5 — Mobile completeness

- [x] Implement local reminders and user-initiated Android permission flows; physical-device delivery acceptance remains open.
- [ ] Implement homescreen widgets and quick-add entry points.
- [ ] Add Persian/English locale behavior and RTL UI.
- [ ] Add Jalali/Gregorian display modes without changing stored instants.
- [x] Add versioned JSON export/import and atomic merge; real SQLite and sampled native file restoration pass.
- [ ] Audit privacy, permissions and accessibility across both themes.
- [ ] Check iOS compatibility when Apple tooling is available.

**Exit gate:** data recovery demonstrated on a clean install; notifications and widgets checked on real devices, not only in an emulator.

## M6 — Release quality

- [ ] Test navigation, focus, gestures, screen readers and reduced motion.
- [ ] Establish and measure launch, scroll and drag performance budgets.
- [ ] Profile long histories and thousands of saved items.
- [ ] Fix crashers, data-integrity bugs and high-severity usability issues.
- [ ] Produce a signed Android release build and preserve verification evidence.
- [ ] Record release notes and known limitations in `docs/`.

**Exit gate:** a reproducible build and completed acceptance checklist. Publishing to a store is a separate explicit decision.

## Learning Projects — planned product milestone (2026-10-27)

**Status: specified, implementation not started.** The current Guided Plans are four fixed starter paths; they are not a resource-aware learning planner.

- [ ] Model a Learning Project and ordered resources/units (books, chapters, videos, courses, exercises) linked to one canonical goal.
- [ ] Ask for weekly capacity, preferred days, session size, optional target date and per-unit effort; produce a transparent initial effort and completion-date range.
- [ ] Schedule linked study sessions through the existing Calendar/Timebox/Focus system and use local reminders where permissions allow.
- [ ] Add opt-in missed-session recovery: propose or automatically place only flexible learning sessions; preserve fixed/locked blocks and explain when the target date is no longer feasible.
- [ ] Record actual time and meaningful learning evidence (recall/quiz or self-assessment); recalibrate estimates from observed pace without equating time spent with mastery.
- [ ] Add spaced review sessions and long-range progress rollups across week/month/year horizons.
- [ ] Version backup/import and add a schema migration before storing learning resources; preserve old Evrida and legacy Eonward backups.
- [ ] Keep the 20-test budget: extend/replace existing meaningful tests rather than adding redundant cases. Complete Android native persistence, notification and accessibility acceptance before calling the feature reliable.

**Product guardrails:** no mandatory AI, login, cloud backend or new bottom-navigation destination for the first version. The first release should use explicit user inputs and deterministic scheduling; optional resource extraction can be evaluated after the workflow is proven.

## Personal Finance & Money Goals — planned product milestone (2026-10-27)

**Status: specified, implementation not started.** This is an optional capability, not a requirement for using Evrida. Full product rules and acceptance criteria live in [PERSONAL_FINANCE.md](PERSONAL_FINANCE.md).

### Finance 1 — Trustworthy manual ledger

- [ ] Add progressive optional finance setup with explicit currency/unit and opening balances.
- [ ] Record income, expenses, transfers and adjustments with minimal taps.
- [ ] Add editable category hierarchy, multiple tags, notes and optional goal links.
- [ ] Correctly handle transfers, refunds, split transactions and card payments without double counting.
- [ ] Show monthly income, expenses, net cash flow and category/tag breakdown; do not treat missing months as zero.
- [ ] Include finance records in versioned backup/restore and schema migration before real use.

### Finance 2 — Budgets, recurring costs and money goals

- [ ] Add optional monthly/category budgets, recurring bills, opt-in reminders and irregular-expense reserves.
- [ ] Add savings-goal allocations, target dates and planned monthly contributions.
- [ ] Calculate required contribution and estimated completion window from explicit balances and assumptions.
- [ ] Add monthly review and 3/6/12-month spending trends only when enough history exists.

### Finance 3 — Inflation-aware forecasts

- [ ] Show nominal amounts separately from purchasing-power-adjusted real values with a stated base date.
- [ ] Support dated price-index history when a trustworthy source is available, plus clearly labeled user-entered future scenarios.
- [ ] Keep general inflation separate from target-specific price growth (for example, housing-price growth).
- [ ] Compare a small number of scenarios for inflation, income changes, one-off costs and monthly contributions.
- [ ] Show data coverage, missing inputs, assumptions and a forecast range; never fabricate current inflation or a guaranteed completion date.

**Product guardrails:** manual-first and offline-first; no mandatory AI, login, bank connection or cloud backend. Finance setup is skippable. Do not add a new bottom-navigation destination until usability evidence justifies it. Bank sync, investment/tax features, multi-currency aggregation and automatic AI categorization remain deferred. Preserve the 20-test budget by extending/replacing meaningful cases rather than adding redundant tests.

## Deferred (not quietly added to the current scope)

- Authentication, accounts, cloud sync and realtime collaboration.
- Paid subscriptions, hosted backend, commercial releases.
- AI coaching or remote model integrations.
- Dedicated desktop UI; revisit after mobile quality is established.

## Automated test policy

- Hard limit: **20 focused named automated tests total** across the repository (**20** currently).
- `scripts/check-test-budget.mjs` blocks CI for over-budget cases or duplicate names.
- Replace outdated tests and merge redundant coverage instead of accumulating regression cases.
- Avoid disposable snapshot tests, generated test batches, or tests without a meaningful failure mode.
- TypeScript, SDK alignment and bundling are build checks, not test cases.
- Manual emulator acceptance remains required and is not an automated test.

## Verification — Horizons 2.0 source

- [x] GitHub Actions domain tests passed on commit `34710e0`.
- [x] GitHub Actions locked `npm ci`, Expo package compatibility, TypeScript and Android Metro export passed on commit `34710e0`.
- [ ] Actual Android emulator UX regression of editor, hierarchy and keyboard remains outstanding.

## Self-review and revised implementation plan (2026-10-14)

**Critical findings:**
- The first Perspective implementation showed period groups, but did not reveal a goal's *actual* parent lineage. We built Goal Path rather than another page.
- Editing into another horizon could leave the user on an empty previous period. Focus now follows the saved destination.
- We moved faster on screens than on Android end-to-end QA. Passing TypeScript and Metro is not proof of keyboard, modal or SQLite persistence behavior.
- Goal ordering was not user-controlled and deletion was irreversible. Source now has Move Up/Down and Archive/Restore; device verification remains.
- A single `period_key` is not a due date or time block. No claim of full feature parity is justified.

**Priority order:** (1) Verify existing-data migration plus archive/order and earlier CRUD on Android; (2) fix concrete UX bugs; (3) strengthen time/placement semantics; (4) consider gestures; (5) new calendar/board surfaces. No new libraries or automatic tests unless they address a demonstrated risk.

## Goal Path slice — source complete, runtime pending

- [x] Resolve actual ancestors through a bounded recursive SQLite query; root-first.
- [x] Show parent context in Focus and Perspective, with tap-to-open ancestor chips.
- [x] Follow a moved goal to its saved target period while in Focus.
- [ ] Confirm deep navigation, reschedule, keyboard and restart behavior on Android.

## Self-review of Android action menus

React Native Android Alert supports at most three actions. The first proposed four-option organizer was unsuitable. Replaced it with a lightweight in-app action sheet before user delivery; it has Move Up/Down only when valid, Archive, and Cancel. No new package and no additional automated test. Review sheet position and dismissal on Android.

## Data safety & ordering slice — schema v2

- [x] Add transactional SQLite v1 → v2 migration: nullable `archived_at` and stable `sort_rank` (without resetting user data).
- [x] Implement Archive/Restore of an active goal subtree, preserving already archived descendants.
- [x] Add Archive view accessible alongside Focus/Perspective; remove destructive Delete action from goal details.
- [x] Add Move Up/Down actions that persist ordering, with an Android-safe custom action sheet and no new dependency.
- [x] Update existing migration checks to version 2; remain at **12/20** automated tests.
- [ ] Verify these workflows and migrations on Android with an actual v1 populated database (SQL sanity verification completed separately; emulator QA outstanding).
- [ ] Review performance/visual clarity with a large goal list, then assess whether drag-to-reorder is worth adding.

## Screenshot-based mobile UX cleanup — October 14

**Evidence received:** Android emulator screenshots show all three empty states and the Create Goal sheet; they do not establish that goal persistence, migration or archive/restore interactions succeed.

- [x] Move Create/Edit Goal's primary Save action outside the scrolling form into a persistent bottom safe-area footer; leave inputs scrollable.
- [x] Add safe-area-aware modal layouts for Editor, Details and Organize actions without adding dependencies.
- [x] Remove the repeated empty-state CTA that was partially hidden under the Focus bottom action bar; keep one consistent New goal action.
- [x] Hide the redundant bottom New goal bar in Perspective (each horizon already offers Add goal).
- [x] Keep Focus/Perspective as primary modes; demote Archive into a separately styled utility shortcut.
- [x] Condense Android manual QA to ten meaningful scenarios instead of continuing a sprawling repetitive checklist.
- [ ] **Verify these layout changes with fresh screenshots on the Android emulator**, both with and without the keyboard.
- [ ] Test real goal CRUD, archive/restore, ordering and data persistence; screenshots of an empty state do not prove these.

**Self-critique:** Our earlier modal design relied on a long scroll to reach Save, and even duplicated a first-goal call-to-action below a fixed footer. Both are avoidable design errors; fixing layout and action hierarchy is more valuable than another feature screen. The grey/blue floating Tools gear in the screenshot is not rendered anywhere by Evrida's source; investigate the emulator/development overlay separately if it interferes with testing.

## Current implementation checkpoint

The new Board route is a **functional source implementation** rather than a placeholder card. It uses one persistent goal entity and an indexed, unique membership table. CI validates the migration and build; screenshots and user interaction are required for UI sign-off.

The initial Create Goal form was appearing partially scrolled in a screenshot; initial autofocus has been removed, scroll position resets when opened, and empty parent-option lists no longer reveal a pointless selector.

## Calendar and focused time — schema v4

**Product principle:** a time block is a scheduled occurrence *of an existing goal*, not an additional goal entity. The same goal ID is displayed in Horizons, Boards and Calendar. This is local on-device navigation/data-sharing, not cloud/device sync.

- [x] Add additive SQLite v3 → v4 `time_blocks` migration with goal FK, UTC start/end instants, kind and optional intention. Existing goals/boards preserved by design.
- [x] Schedule, edit and unschedule multiple local-day time blocks against the same active goal; no new dependency.
- [x] Separate flexible Time Block from fixed-limit Timebox, with a written target for the latter; no active timer or alert yet.
- [x] Add day navigation, daily agenda and visually sized time blocks in a 24-hour calendar timeline, including overlapping lanes.
- [x] Link Calendar from Horizons and Boards; open original goals from scheduled blocks.
- [x] Display the next active time block in relevant Focus, Perspective and Board goal cards.
- [x] Add two meaningful domain tests (strict date/time and overlap lanes); update the existing migration checks. Total **14 of 20**.
- [ ] Test v3 → v4 migration on a populated Android emulator **without uninstalling**.
- [ ] Verify saving, changing and unscheduling across all three views plus force-close/restart.
- [ ] Test daylight-saving transitions on a device/time-zone change, including ambiguous fall-back times.
- [ ] Add explicit due date separately from scheduled time; handle overnight/multi-day blocks in a later slice.
- [ ] Add a real focus timer/stop reminder for Timebox when Android and background behavior are verified.

**Self-critique:** the previous roadmap delayed scheduling until Boards was fully polished, despite time blocking being an important part of the user's desired workflow. This slice makes shared scheduling functional before adding animations or secondary features. It is *not* a mature calendar: week/month grid, drag-to-resize, reminders, recurrence, due dates and external calendar integrations are still missing.

## Daily Timeline redesign — screenshot review

- [x] Move the scrollable 24-hour schedule above the fold; keep the week strip, day title and quick actions visible.
- [x] Live current-time marker, Jump to Now, day/week navigation and initial positioning near now/first event.
- [x] Draw actual start/end times and goal names in proportionally sized, color-coded blocks with side-by-side overlaps.
- [x] Add separate accessible List view for short blocks and quick creation by tapping an empty hour.
- [x] Keep the same goal IDs and SQLite v4; no new library; automated suite remains 14/20.
- [ ] Verify Android dark/light, small screen, keyboard, 15-minute blocks, 3+ overlaps, scheduling and persistence.
- [ ] Validate accessibility, date rollover, time zones and long-press navigation before gesture-heavy enhancements.

**Self-critique:** the original Calendar buried its essential 24-hour schedule after a large header and long agenda in one enormous scrolling page. It looked like an afterthought. The new hierarchy puts visual scheduling first; List is an intentional fallback for short items, not a second copy of goals. Premium means clear time geometry and reliable actions, not more decoration.

## Persistent focus session and primary navigation — schema v5

**Why this slice:** Calendar, Horizons and Boards are now equally important destinations, but the existing interface required header-level navigation and Timeboxes did not execute. This slice makes daily focus usable, not merely scheduled.

- [x] Add one **persistent three-destination bottom dock** for Horizons, Calendar and Boards in the shared app layout.
- [x] Remove redundant header shortcuts and leave the bottom inset to the shared dock.
- [x] Add additive SQLite v4→v5 `focus_session` table; **do not reset existing goals/boards/blocks**.
- [x] Start a real focus countdown from a saved Timebox in Calendar List or its editor.
- [x] Persist timer deadlines, pause state and remaining time in SQLite; only one session can run at a time.
- [x] Keep a compact timer visible while switching pages, with expandable pause/resume/end controls.
- [x] Use absolute wall-clock deadlines so returning from background or reopening the app yields accurate remaining time.
- [x] Separate ending a focus session from marking its goal complete (no implicit goal changes).
- [x] Adapt existing database migration checks and add **two focused domain cases**, keeping **16/20** total.
- [ ] Verify v4→v5 upgrade, navigation, modal safe areas, pause/resume and process restart on Android emulator.
- [ ] Provide native notifications and optional foreground-service integration only after real device testing; there is no background alert or sound in this slice.
- [ ] Record completed focus-session history after checking what Insights should count as a meaningful session.

**Engineering self-critique:** This root-level dock corrects page isolation, but it is not yet a native tab navigator with per-tab state preservation. The timer is accurate across pauses/background because it stores its deadline, but the JavaScript rendering loop is not guaranteed to run while Android suspends the app. Do not claim notifications, a background service, or an enforced stopping alarm. Color, typography and touch targets still need screenshot-based QA; CI is not UI acceptance.

## Next three actions

1. Upgrade an existing populated v4 Android install to v5 without reinstalling; start a 15-minute Timebox from Calendar, switch to Horizons and Boards, and force-close/reopen.
2. Test pause/resume and automatic deadline expiry after backgrounding the app, modal safe areas and global bottom-dock navigation in both themes.
3. Resolve real interaction findings before adding session history, background notifications, Insights or drag-and-drop.

## Progress log

| Date | Change | Verification |
| --- | --- | --- |
| 2026-10-14 | Repository documents and minimal Expo source added. | Remote file inspection only; install/build/device testing pending. |
| 2026-10-14 | Seven-horizon UI, SQLite goal CRUD, child steps, migration source and Node unit tests added. | Domain tests, npm installation, typecheck and SDK alignment passed in GitHub Actions; device verification pending. |
| 2026-10-14 | Dependency conflict fixed by pinning React DOM 19.2.3 and Worklets 0.10.1; lockfile regenerated. | Expo alignment, typecheck and Android Metro export passed. |
| 2026-10-14 | Final lockfile-based CI run verified. | npm ci, Expo alignment, typecheck, Android Metro export and domain tests all passed; native APK/device testing remains. |
| 2026-10-14 | Initial Horizons shell shown running on Android emulator; Horizons 2.0 priorities set. | User-provided screenshot verifies emulator launch only; goal CRUD, hierarchy and persistence still require runtime testing. |
| 2026-10-14 | Horizons 2.0 initial implementation: nested navigation, reparenting validation, period editor and visual refinements. | CI checks passed on commit 34710e0; Android UI QA remains outstanding. |
| 2026-10-14 | Built Focus/Perspective mode with local seven-period overview and test-budget enforcement. | CI passed on `2c1f8e8`: 12/20 tests passed, zero failures; npm ci, Expo alignment, TypeScript and Android Metro export passed. Emulator UX pending. |
| 2026-10-14 | Added a goal ancestor trail, immediate-parent hints and destination-following edits; reviewed sequencing and gaps. | Code committed pending CI; Android UX pending; still 12 core tests. |
| 2026-10-14 | Added schema v2, archive/restore UI and stored ordering; updated existing migration tests. | GitHub Actions domain and app checks passed on `8b5e606`; Android migration/interaction QA pending; 12/20 tests. |
| 2026-10-14 | Refined Focus/Perspective/Archive hierarchy and modal safe-area/footer behavior based on four emulator screenshots. | Source changes, CI and fresh Android screenshots pending; 12/20 automated tests unchanged. |

| 2026-10-14 | Board workspace added: schema v3 with reusable goal references and atomic in-board goal creation; fixed goal editor initial scroll/parent selector. | Final code commit `f8c3fd1`: 12/20 domain tests, npm ci, Expo version checks, TypeScript and Android Metro all passed; Android board interaction and migration QA pending. |

| 2026-10-14 | Added connected Calendar/Time Block and Timebox slice, schema v4, day timeline, and navigation from existing goals. | Source implementation committed pending CI/device verification; 14/20 tests. |

| 2026-10-14 | Rebuilt Calendar as a visible premium day canvas with stable seven-day header, live Now, goal color, quick hour scheduling and separate List. | Source and CI pending, emulator visual and interaction QA required; 14/20 tests. |

| 2026-10-14 | Introduced root-level mobile dock and local, deadline-based persistent Timebox focus sessions (SQLite v5). | Commit `0c66e33`: 16/20 domain tests, npm ci, Expo alignment, TypeScript and Android Metro passed; emulator focus lifecycle still unverified. |

## Focus reliability and Insights — SQLite v6 (2026-10-14)

- [x] Add an additive v5→v6 migration: persistent local focus-session history with immutable title snapshots.
- [x] Track active time across pause/resume without counting paused intervals or overrunning the Timebox limit.
- [x] Transactionally record `completed`, `stopped`, or `replaced` outcomes on finalization.
- [x] Snapshot the current session before deleting its Timebox and disallow editing an actively running Timebox.
- [x] Add Insights as a fourth global navigation destination with all-time totals, a seven-day focus chart and recent session history.
- [x] Keep automated test budget at **17/20**; old database migrations still covered.
- [ ] Verify upgrades from a populated SQLite v5 app (both running and paused session states) and Force Stop/relaunch on Android.
- [ ] Native reminder/expiry notification permission flows remain intentionally unimplemented pending real device verification.

**Metric definition:** Insights counts finalized sessions only. A session reaches `completed` when its actual countdown expires and is finalized; this does not mark the goal completed. Existing v5 sessions preserve prior active seconds through their saved remaining time; the original wall-clock start time across earlier pauses can only be estimated.

## Calendar correctness and weekly planning — 2026-10-14

- [x] Show blocks that **overlap** the selected local day instead of only those starting inside it; continuing overnight blocks now appear on both relevant days.
- [x] Clip overnight blocks to the current day's visible 00:00–24:00 timeline geometry; display the original time range and continuing marker in List.
- [x] Explicit "End on next day" choice in the editor; verify local date/time, DST spring gaps and duplicated fall-back clock times instead of silently coercing them.
- [x] Add a seven-day overview with time budgets, linked goal previews and overlap warnings; select a day to open its actual timeline.
- [x] Add **two** focused time-boundary tests, reaching **19/20** total. No new third-party dependency or schema change.
- [ ] Test the existing-data calendar screens on an Android device through midnight and DST changes in different configured time zones.
- [ ] Drag/resize gestures, month navigation, recurrence and local notifications still require separate implementation and verification.

## Monthly overview — source implemented (2026-10-14)

- [x] Access the calendar month grid from the visible date heading without adding a fifth root navigation destination or hiding the daily timeline.
- [x] Browse adjacent months with month-correct arrows and open any date straight into its day timeline.
- [x] Aggregate actual overlapping month-day windows, display per-day activity bars and summarize planned hours/active days.
- [x] Reuse the existing `time_blocks` data and v6 schema; no new package or additional automated test.
- [ ] Verify month/year boundaries, small-screen grids and navigation return states in Android emulator.

## Cross-screen capture: Calendar → Goals (2026-10-14)

- [x] Reuse the full existing Goal Editor directly from Calendar; a goal can be created without navigating away.
- [x] Empty Calendar quick-add opens goal creation instead of forcing a navigation to Horizons.
- [x] After saving the goal, offer a direct "Schedule time" action with its new stable goal ID preselected.
- [x] Refresh the same shared SQLite goal collection; no duplicated goal entities, package additions or new schema version.
- [ ] Confirm Android modal transition and small-screen keyboard behavior on-device.

## Day timeline time-scale controls (2026-10-14)

- [x] Add three accessible time-density levels (56 / 76 / 104 pixels per hour) to the daily canvas without extra dependencies.
- [x] Keep event placement, work-hour background, time rulers and Now line on the same adjustable scale.
- [x] Preserve the user's approximate viewport time when changing zoom instead of snapping back to the morning.
- [ ] Verify actual Android scroll position, 15-minute cards, touch-target overlap and accessibility at each zoom level.

## Calendar lifecycle hardening (2026-10-14)
- [x] Refresh the selected-day "Today" affordance across midnight and on return from background.
- [x] Refresh the live Now marker on Android foreground resume without trusting JS background ticks.
- [ ] Verify midnight rollover and foreground return with device-clock simulation on Android.

## Reliability review — October 14 follow-up

- [x] Load the full six/five-week month grid, including real scheduled blocks on grey days belonging to adjacent months.
- [x] Avoid overlapping touch targets for adjacent short Timeblocks at compact Timeline zoom by assigning lanes according to *rendered* height, not only chronological collisions.
- [x] Fix the 23:00 quick-add default: one full hour ending at 00:00 next day, not an arbitrary 59 minutes.
- [x] Consume Calendar goal deep-links so the same Goal can be opened for scheduling repeatedly.
- [x] Guard Calendar writes synchronously against duplicate tap-created blocks/goals.
- [x] Reject overlapping Focus mutations instead of quietly resolving a skipped Start/Pause/Finish operation as if it succeeded.
- [ ] Real-device Android validation is still required for gesture targets, saved SQLite lifecycle, permission prompts and modal transitions.
- [ ] Local background-expiry notifications remain unavailable until `expo-notifications` is integrated and Android permissions and exact delivery behavior are verified with a development build.

## Consistency audit, post-v6
- [x] Month grid loads neighboring-day schedules consistently with the visible calendar cells; monthly totals exclude those neighboring days.
- [x] Correct daily "goals done" semantics: each completed Goal is counted once regardless of the number of its scheduled blocks.
- [x] Guard against fast duplicate writes and falsely successful overlapping Focus actions.
- [x] 23:00 quick-create generates a genuine overnight 60-minute block.
- [x] Use visual collision lanes at dense zoom so adjacent 15-minute blocks do not obscure one another.
- [x] On 23/25-hour DST days, warn that the Timeline displays wall-clock geometry and link directly to List for unambiguous exact timestamps.
- [x] Extend two existing calendar/domain tests without exceeding the 20-test policy.
- [ ] Verify device focus/navigation/keyboard/notification behaviors: GitHub Actions cannot substitute for physical Android acceptance.

## Source audit and correction — 2026-10-15

- [x] Timebox editor does not silently start the *old* saved Timebox while unsaved edits are visible. Save before Start; disable editing the actively focusing Timebox with an explicit explanation.
- [x] Continue an overnight block with only the **visible local-day segment** in the Day Timeline. The preceding day's end is labeled 24:00, not 00:00 of the next day.
- [x] Add domain assertions for overnight segment labels without inflating the fixed 20-test suite.
- [x] Show a recoverable retry prompt if Focus persistence cannot be read rather than quietly hiding the timer.
- [x] Refresh Insights seven-day window after local midnight and after returning from the background.
- [ ] **Not done:** Android notification scheduling: Expo SDK 57 requires a locked `expo-notifications` install and platform permissions. Do not claim background expiry alerts from JavaScript countdowns.
- [ ] **Not done:** hands-on Android interaction/regression pass and notification/exact-alarm grant/deny scenarios. CI only proves test, type and bundle integrity.

## Native Focus expiry reminders — source implementation (SDK 57)

- [x] Lock the SDK-compatible `expo-notifications` dependency with npm in isolated CI rather than editing the lockfile by hand.
- [x] Configure an Android Focus channel and a user-controlled `SCHEDULE_EXACT_ALARM` manifest permission.
- [x] Request visible notification permission only when the user initiates Focus. A refusal **never** stops the timer.
- [x] Schedule one device-owned local reminder for a running session; deduplicate across reloads and force-close recovery.
- [x] Cancel stale reminders on Pause, Stop, Replace, deletion and expiry; reschedule after Resume using the persisted deadline.
- [x] Keep the lock-screen message generic so private goal titles are never displayed in reminder previews.
- [x] Surface notification/alarms configuration problems as explicit non-fatal warnings in the Focus UI.
- [ ] Android 13/14/15 physical-device acceptance: test notification denial, special alarm access denied/granted, notification delivery after app force-stop/idle, resume and replacement. **Exact delivery is not guaranteed solely by a successful JS bundle.**
- [ ] Play policy review for exact-alarm permission before store release. If approval is not appropriate, implement an inexact fallback and update the UX.


## Personal planning refinement — 2026-10-15

Target: implement the approved compact personal-planning direction and real offline workflows. This is not an M6/release completion claim.

- [x] Replace the oversized Horizons introduction with a compact Plan header, labeled Plan / Overview / Inbox views and inline capture.
- [x] Keep seven planning horizons; simplify empty overview rows and preserve canonical goal details and hierarchy.
- [x] Add local search across titles, notes and parent names; consume goal deep links so the same goal can be opened again.
- [x] Add non-destructive v6→v7 migration: Inbox state, optional deadline, recurrence metadata and actual completion/reopen history.
- [x] Keep startup migration on the already-open SQLite connection; the previous exclusive second connection reproduced a startup lock during the native upgrade.
- [x] Generate exactly one next recurring occurrence per completed source, including board memberships; retain original monthly/yearly day anchors.
- [x] Add weekly Review with recorded completion count, actual Focus history and explicit Keep / Move / Archive decisions for previous-period open goals.
- [x] Make Month an explicit Calendar view and offer scheduling for daily goals without a time reservation; reduce repeated calendar explanation/header chrome.
- [x] Fix the native month grid wrapping into six columns: render explicit seven-day rows, and use readable accent foregrounds for selected dates in Month/Week.
- [x] Add file export/share and file-picker restore, strict snapshot validation and all-or-nothing merge of missing IDs; no current local record is overwritten.
- [x] Fix foreground contrast on accent surfaces in light/dark; explicitly configure the Expo SystemUI plugin after native inspection exposed a forced-light resource default.
- [x] Keep the automated suite at 20 focused cases, replacing redundant migration mocks with a real SQLite planning/restore workflow.
- [x] Pass TypeScript and Expo dependency compatibility checks; build and install the Android debug APK with native backup modules.
- [x] On Android, verify schema v7 and run actual Expo SQLite recurrence + backup/restore (including duplicate restore and corrupt-reference rejection).
- [x] Sample Android inline capture, completion, Inbox, Overview and Review; open the native export share sheet and file-picker restore preview. Keep screenshots and probe results outside the public repository.
- [x] Verify native automatic dark theme after rebuilding with SystemUI. Finish file-picker restore through success: one deliberately missing QA goal restored; repeated import adds zero records and preserves six existing goals.
- [ ] Full IME/keyboard matrix remains open; emulator samples do not establish physical-device keyboard acceptance.
- [ ] Release-build startup profile, physical-device alerts/idle behavior, TalkBack, large text and native RTL/Jalali remain unverified.
- [ ] Widgets, incoming share capture, timeline drag/resize and external calendar sync remain separate platform work.

Next three actions after this slice: (1) physical Android lifecycle/notification and accessibility acceptance; (2) decide and implement localization/calendar preferences; (3) implement widget/share capture against the stable capture workflow.
