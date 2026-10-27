# Android acceptance: concise critical path

For the new isolated APK/iOS Simulator Maestro smoke paths, manual EAS setup, crash-buffer evidence and device gates, see [NATIVE_ACCEPTANCE.md](NATIVE_ACCEPTANCE.md). The automation files are prepared but native jobs have **not** been run as part of the existing JavaScript CI.

## System coherence acceptance — pending native QA

- [ ] Open a Timebox editor, change that reservation through another path, then try saving the stale editor: expect a non-destructive error and no overwritten user data.
- [ ] On a completed goal, scheduling a new Timebox must fail without mutating the calendar; previously completed Focus history must remain intact.
- [ ] Apply Recovery and then manually create/edit/delete a reservation: the old Undo must disappear. Repeat with a concurrent active Focus session.
- [ ] Keep Review open while stopping Focus from the persistent dock: the weekly stats and history must refresh without route navigation.
- [ ] On a 23-hour spring-forward and 25-hour fall-back date, selecting Day must use exact List with UTC offsets. No 24-hour absolute-time canvas should appear.

**Status: sampled standalone release QA on Android 35, 2026-10-15; full device acceptance remains open.** Current evidence is summarized in ROADMAP.md. Plan/Horizons/details/Calendar/Boards/Review renders, light/dark, 130% Plan text, full Gboard capture and dirty draft close were sampled. Native restoration and one-minute background notification delivery were exercised. None certifies the entire matrix below.

These **manual checks** are the remaining acceptance matrix, not additional automated test cases. A sampled subflow does not check off its whole matrix row. Keep synthetic screenshot evidence outside Git and record a reproducible failure when a check fails.

Additional October 15 friction pass: reproduced quick-title loss before the change; verified title transfer, cancel preservation and successful matching-draft clearing after it. Exercised organizer Today/Tomorrow/This week/Inbox destination navigation, direct 25-minute Focus and End, dark organizer with 130% text, substring search with contextual actions, calendar jump to October 22, 2028, Month picker cancellation and Today. These are sampled Android 35 QA-release interactions; they do not certify native iOS, all font sizes or screen-reader behavior.

Smaller-step pass: the previous percentage/content-sized editor moved its header when Gboard opened and discarded the parent detail context on cancel. The revised editor retained header/title bounds across keyboard opening and multiple title chunks; title Next focused notes. Short and long notes retained identical 120dp field bounds and surrounding layout, Add step saved above the IME, and the parent reloaded with one Inbox child. Empty cancel and Keep editing were exercised; expanded horizon/date controls were sampled in dark mode at 130% text. Continuous title jumping in the user's original typing sequence was not reproduced in the baseline short-title sample, so these results certify only the exercised sequence.

## New planning slice — unverified native acceptance matrix

- [ ] Plan → Tools → Guided Plans: select each starter, rename the parent, create once. Check exactly one goal in its specified horizon and four undated children in Inbox, including after process restart. Cancel a selection and verify it makes no writes. Test very long/blank titles, rapid tapping and full Gboard.
- [ ] From a populated Board, switch Open/Scheduled/Done/All. Confirm counts, empty states, keyboard/TalkBack labels, links to original goals and completion visibility across Plan and Calendar.
- [ ] Calendar Day: verify 24h ribbon positions and focus bar alignment at all zoom levels; add concurrent 09:00–10:00 and 09:30–10:30 blocks and confirm 120 minutes reserved but only 90 occupied with 30 minutes of overlap. Verify DST notice/list route and suppressed ribbon on 23/25h days.
- [ ] Review weekly goal budget → Plan time should open Calendar scoped to the correct canonical goal, and show updated reservations upon return. Test zero open goals: Allocate must be disabled, not an inert button.
- [ ] Recovery preview: try late/expired previews, blocked active Focus, fixed commitments, Undo immediately and Undo after five minutes. Verify no hidden mutations and app restart behavior.
- [ ] Foreground after switching time zone without changing calendar date: week/month/day reservations and clock labels must be reread without restarting. Repeat with an editor draft and ensure saved data remains intact.

## 2026-10-15 — Living Timeline and premium UX acceptance (unverified native)

- [ ] On Day, verify + controls target the correct visible hour at zoom levels 1/2/3 (56/76/104dp per hour); after zoom, press the 00:00, 06:00, 12:00 and 18:00 ribbon targets and confirm scroll reaches the expected wall time.
- [ ] Move a 90-minute single-lane block using its vertical grip, Resize from the lower grip and ensure each snaps to 15-minute increments. Preview must not persist until Apply. Cancel/restart must restore the original time.
- [ ] Long-press a 15/25/30-minute or overlapping block; stepper must offer Move/Resize with accessible 48dp +/- controls, exact hours, cancel and Open Goal.
- [ ] Try previewing past midnight, negative or 0 duration, DST day, completed goal and active Focus. The change must be disabled or safely rejected; older goal links/history must remain.
- [ ] Create a conflict while a preview is open from another screen: saving stale preview must be rejected without overwriting newer reservations. Run full rollback and backup check afterwards.
- [ ] Recovery Ripple sheet: compare before/after dual bars against exact times, test overlapping reservations and 15/30-minute extension with font size 200%, and VoiceOver/TalkBack narration.
- [ ] Week and Month: make overlapping reservations and verify unique occupied time matches the 24h/weekly results while conflict warnings remain visible.
- [ ] Check semantic colors and white text contrast under light/dark and accessibility contrast settings. Screen-reader announcements must communicate plan/timebox/fixed/flexible without depending on color.
- [ ] Test reduced-motion mode, Gboard opened above the dock, keyboard back dismissal and long day scrolling on budget Android hardware.

## Self-critical usability and privacy checks (unverified on devices)

- [ ] Keep Recovery open for over two minutes. Apply must be disabled, Refresh must recompute from current time and work after app background/foreground; Undo must disappear when its five-minute checkpoint expires.
- [ ] Empty Day/Week/Year horizon: Guided Plans entry visible and keyboard-safe; creating a starter still produces a single parent + four Inbox steps without duplicated records.
- [ ] Weekly allocation: half-hour targets format as 30m, over/under-reserved statements refer to the user's target, and tapping Plan time opens the exact linked goal.
- [ ] Settings health probe: verify no data modifications, clear no-issues/error semantics, offline operation and no false inference about crash safety.
- [ ] Export to Files and third-party share targets (including slow receiving apps); check cancellation and cache eviction. Confirm there is no persistent new plaintext JSON in Documents, and 24h-old cached copies are eventually pruned.
- [ ] Calendar overnight Timebox: linked Focus label must not imply every minute was performed within the currently selected local day.

## SQLite native stress gate (P0 · [#2](https://github.com/Nishef1/Evrida/issues/2))

- [ ] Use Android 35 and 36/16 hardware or emulator with saved populated v8 data; leave a dirty editor open, then change font size, theme and rotation repeatedly while backgrounding/foregrounding. Record all `exsqlite3_step`, `pthread_mutex_lock` and Java/Kotlin SQLite failures with logcat/tombstone.
- [ ] Navigate all four destinations while starting/stopping Focus and editing calendar entries, and try rapid goal creation/movement/restore; check native lifecycle behavior, not merely rendered screens.
- [ ] Development build runtime reload 10–20 times and repeat SQLite startup probe; capture if cached handles become unusable. Validate Startup Retry works without deleting the database.
- [ ] Compare saved IDs/relations before and after, perform an exported backup round trip and run `PRAGMA foreign_key_check`/integrity inspection. Never run these destructive tests on the user's main app data.
- [ ] Mark issue #2 closed only with documented device evidence, or after proving a tested native SDK fix.

**Open native failure:** changing live system font scale/theme while a draft was open caused a native SQLite SIGSEGV on Android 35 (`exsqlite3_step`, `pthread_mutex_lock`). The app restarted and the previously saved child remained. Changing settings while the app is stopped permits static large-text review but does not verify or repair this lifecycle failure; investigate before release.

- [ ] **Native Focus reminder:** Install a fresh native/development build after the notification plugin change (Metro hot reload cannot install new native modules). Grant or deny Android 13+ notifications; grant or deny Android 14+ Alarms & reminders separately. Start a short Timebox, background and lock the device, and verify one native alert. Pause/Resume, Replace, End, delete a Timebox and force-close/relaunch to check stale alerts are canceled. Confirm no private goal title appears on lock screen. Log OS version and whether exact-alarm special access is granted.
- [ ] **Focus history and Insights (v6):** Upgrade populated v5 without uninstalling, including an already paused timer. Stop early, replace another timer, let a third expire and finalize, then delete an active Timebox. Ensure each finalized entry appears exactly once in Insights, elapsed time excludes pauses, active Timebox edits are rejected and results persist after force-close.
- [ ] **Editing an active Timebox:** Start Focus, open its saved Timebox in Calendar and verify editing is disabled with a clear reason; modify another saved Timebox and verify Start waits until those edits are saved.
- [ ] **Overnight labels and timer failure:** Create a 23:30–00:30 Timebox; first day should show 23:30–24:00, next day 00:00–00:30. Simulate an SQLite read error and confirm a retry action appears in the dock.
- [ ] **Persistent Focus Timer and app dock (v5):** Upgrade a populated v4 app to v5 without uninstalling. Start a 15-minute Timebox from Calendar List and its Edit sheet; use Horizons/Calendar/Boards bottom navigation while the mini-timer stays visible. Pause for two minutes, resume, background/foreground the app, and force-close/reopen; confirm remaining time is correct. On expiry, verify Time's up UI, finish the session, and confirm goals remain unmodified. Verify small-screen keyboard and both themes.
- [ ] **Calendar goal capture:** From an empty database use Calendar + to create a Day goal, then choose Schedule time. Confirm exactly one goal in Horizons and the corresponding calendar Timebox. Repeat from the Goal+ action with populated goals; test modal transitions and keyboard.
- [ ] **Calendar date navigation:** Select Month, page across December/January, verify day bars and monthly totals, then tap a day. From every view, tap the date heading and jump directly using the native date picker; cancel preserves the date and Today returns to today's timeline. Test 35- and 42-cell months on a small screen in dark and light mode.
- [ ] **DST 23/25-hour day notice:** Change emulator timezone to America/New_York, open March 8 and November 1, 2026, verify List shortcut and the warning; ensure saved instants remain correct.
- [ ] **Midnight / resume:** Keep Calendar open across midnight, then background and reopen; confirm Today dots, Now marker and correct timeline controls without a forced restart.
- [ ] **Timeline zoom:** Zoom in/out through all three levels while scrolled to the afternoon. Ensure labels, colored blocks, Now marker, empty-hour tap targets and content position stay aligned on Android.
- [ ] **Overnight and weekly calendar:** Create a block 23:30→00:30 with Next day enabled; confirm it renders in both days and weekly overview, with correct half-hour height and a continued label. Confirm invalid same-day ordering and spring/fall DST inputs are rejected. Verify overlap warning and weekly-to-daily navigation after restarting.
- [ ] **Compact timeline and quick add:** Create 3 adjacent 15-minute blocks at compact zoom, verify none obscures another; tap 23:00 and confirm the default is 23:00–00:00 next day (one full hour). Check repeat deep links to the same goal and rapid double-tap on Save.
- [ ] **Calendar/timebox cross-screen and visual canvas:** Upgrade a populated v3 install to v4 without reset; schedule from Horizons/Boards and use the week strip. With three overlapping entries and one 15-minute timebox, verify exact start/end positions, readable List fallback, current-time marker and Jump to Now; tap an empty 14:00 hour for a prefilled block. Edit, remove and reopen after force-close in light/dark mode. Check long-press to open the original goal.
- [ ] **Boards end-to-end:** On a populated v2 install create/edit/delete a board, create a goal directly within a board, add another existing goal to two boards, toggle completion, open the original detail, remove a membership without removing the goal, archive the goal and verify active board counts; restart the app and confirm everything persists.
- [ ] **Keyboard and safe area:** Create Goal with keyboard visible, scroll through its fields and tap fixed Save; verify system navigation never covers it. Open/close Details and Organize sheets.
- [ ] **Single first action:** Focus empty screen exposes New goal without duplicate clipped CTAs; Perspective shows per-horizon Add without a sticky bottom footer.
- [ ] **End-to-end goal:** Create, edit, complete and reopen a goal; close and relaunch Evrida; the item, its notes, and status persist.
- [ ] **Seven horizons:** Switch Focus/Perspective, add from a Horizon card, change its period, find exactly one saved item at the intended destination.
- [ ] **Hierarchy:** Create Life → Year → Month → Day, navigate Goal Path, reparent safely, and reject cycles.
- [ ] **Archive lifecycle:** Archive a parent and active children; separately archive a child before the parent and ensure that child stays archived after the parent is restored.
- [ ] **Ordering:** Use Move Up/Down in Organize, verify no invalid moves between completed/open groups, and verify order after restart.
- [ ] **Existing data migration:** Upgrade a populated v1 install to v2 without uninstalling or resetting the emulator; preserve goal IDs, notes and relationships.
- [ ] **Screen variants:** Review light/dark theme, large text, small screen and top/bottom system bars, including the three modal sheets.
- [ ] **Practical scale:** Create ~20 goals and navigate, edit, archive and restore without rendering or interaction failures.

Do not put personal goal content or private screenshots into the public repository. Use synthetic names for evidence.
