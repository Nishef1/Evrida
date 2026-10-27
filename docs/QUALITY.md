# Acceptance and quality checklist

This document describes whole-gate validation. Sampled current evidence is in ROADMAP.md and ANDROID_QA.md; a partial emulator pass does not check off a whole release gate. Both Android and iOS are release targets.

## Adaptive planning and guided onramp

- [ ] Current Goal/Board/Calendar detail links resolve one canonical goal without duplicates.
- [ ] Guided Plans create an atomic root with undated, editable steps; an interrupted write leaves no partial plan.
- [ ] Replan never moves fixed/past/active-Focus blocks, changes are previewed, and Undo rejects stale checkpoints.
- [ ] Daily schedule visualizations distinguish summed reservations and actual occupied time when blocks overlap.
- [ ] Device timezone and locale changes preserve stored UTC instants and civil planning keys.
- [ ] Board filters and weekly budget actions behave reliably with empty and populated data.

## Native E2E tooling status

- [x] CI rejects opening or providing a SQLite handle (`useSQLiteContext`, `SQLiteProvider`, `openDatabase*`) outside `src/storage/connection.ts`.
- [x] EAS smoke definitions, isolated QA profile and Maestro flows are source-controlled, with a CI check that the QA IDs cannot overwrite the production app IDs.
- [ ] Actually execute Maestro on native Android/iOS artifacts; record pass/fail and resulting device evidence. A source-controlled flow is not test execution.
- [ ] Exercise the Android issue #2 font/theme lifecycle reproduction on an emulator and capture the native crash buffer. See [NATIVE_ACCEPTANCE.md](NATIVE_ACCEPTANCE.md).

## Native SQLite release blocker

- [ ] Android (including live font/theme/rotation transitions with dirty forms) passes native SQLite lifecycle stress without SIGSEGV/NPE. Track [issue #2](https://github.com/Nishef1/Evrida/issues/2).
- [ ] Focus/Calendar/Boards/Plan concurrent read/write workloads show no hidden corruption, deadlock, or permanently poisoned cached handles; check data after relaunch.
- [ ] The JavaScript serialization mitigation has a passing concurrency test, but does not substitute for a real-device pass.

## Domain and persistence

- [ ] No cycles, duplicate IDs or orphan child references.
- [ ] Accurate Day/Week/Month/Quarter/Year/Decade/Life boundaries.
- [ ] Correct leap-year, week-start, time-zone and DST handling.
- [ ] Save/edit/delete operations remain atomic.
- [ ] Data survives force stop, device reboot and app updates.
- [ ] Backup restores all implemented snapshot fields and relationships. Attachments/preferences are not currently implemented backup fields.

## UX and accessibility

- [ ] Primary flows work on a midrange Android phone.
- [ ] Screen reader labels and logical focus order verified.
- [ ] Controls usable with larger text sizes.
- [ ] All drag features have an accessible alternate action.
- [ ] Light/dark contrast and reduced-motion behavior verified.
- [ ] RTL and LTR layouts checked without changing time semantics.

## Mobile platform integration

- [ ] Notifications work under denied permission and battery restrictions.
- [ ] Widgets refresh correctly across restarts and time-zone changes.
- [ ] Android back handling and keyboard resizing tested.
- [ ] iOS regression pass once Apple tooling is available.

## Release gate

- [ ] Locked clean install and compatibility check.
- [ ] Static typecheck, automated domain tests and launch smoke test.
- [ ] No secrets or private user data in repository.
- [ ] Signed build and documented versioning.
- [ ] Known limitations explicitly recorded.

## Calendar SSOT / StyleSheet review

- [x] One derived calendar event collection feeds Day, Week, Month; domain interval predicates are shared. In-memory source contract checked in CI.
- [x] Consistent occupied-time summaries with explicit overlap handling and clipped-range assertions.
- [x] Shared `Palette` type and semantic schedule/warning/error tokens, including static text contrast checks.
- [ ] Check at 100/130/200% OS font scale, TalkBack/VoiceOver, tiny screens, dense overlaps and dark/light on actual native builds.
- [ ] Confirm touch interactions in native runtime; TypeScript and JavaScript export acceptance cannot certify gestures or screenshots.

## Broad cross-feature invariants (source implemented; device acceptance open)

- [x] UI ordinary Timebox edit receives the original persisted snapshot, and the SQLite write rejects stale state before any mutation.
- [x] A manual calendar write removes the previous Recovery checkpoint in the same transaction.
- [x] Completing a goal prevents new reservations for it while preserving existing recorded Focus history.
- [x] Ending or replacing a Focus session triggers Review reload even when Review stays visible.
- [x] DST clock-transition dates render offset-labeled exact List instead of falsely displaying 24 elapsed hours.
- [ ] Verify two-screen edit conflict and recovery of an unsaved draft in Android/iOS native builds.
- [ ] Verify Review updates after stopping Focus from the global dock, including background/foreground and denied notification permission.
- [ ] Compare clock-transition presentation in spring/fall IANA zones and accessibility readout on Android/iOS.

## Cross-boundary blind spot tests (2026-10-15)

- [x] `canUndoReplan` hides Undo while a moved block is live Focus and on structurally unusable checkpoints; SQL Undo remains the final atomic guard.
- [x] Drag/Resize and Ripple reject stale `updated_at` snapshots even after an edit restores identical on-screen values.
- [x] Recovery freshness rejects a preview that expires after a queue wait, before touching any reservation.
- [x] Portable backup parser rejects a 25-hour or 30-second reservation.
- [ ] Test replacing Focus on the same saved Timebox while Review stays focused: both headline and Time Architecture budget bars must update.
- [ ] Native Quick Focus under artificially slow database transactions: timer should begin at creation time and not consume minutes waiting for a lock.
- [ ] Native Undo while Focus active/paused on the moved block and after it stops, across both OS implementations.
- [ ] Native same-source drag revision conflict, overnight/week transition and actual cloud/file share recipients.

## Latest edge-case correction verification (2026-10-15)

- [x] Restore preview enumerates absent, identical and conflicting records for user confirmation and validates the expected summary again at the SQLite transaction boundary.
- [x] Preview queries use up to 150 imported IDs per SQL group; real SQLite test crosses the batch boundary with 152 boards.
- [x] Focus alert replacement is scheduled before older reminders are removed; Android permission denial produces a distinct, actionable warning rather than corrupting Focus state.
- [x] A five-event synthetic interval fixture proves the three-lane mini-ribbon signals a peak of four concurrent reservations (and treats adjacent intervals as nonoverlap).
- [x] Historical Timebox reuse requires explicit confirmation that new Focus does not move the old calendar reservation.
- [ ] Android exact-alarm/notification/suspend/restart matrix with local OS logs; no source-only proof.
- [ ] Large 10-MB backup benchmark and QA-only restore with diverged local IDs, process kill and disk-low simulation.
- [ ] Travel and midnight UI acceptance in at least two real IANA timezones; do not assert exact per-day active Focus without per-segment storage.
