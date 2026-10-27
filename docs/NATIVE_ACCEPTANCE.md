# Native acceptance gate — Android and iOS

Status: **prepared, not executed**. The current TypeScript / JS bundle / config CI is not evidence that a compiled Android or iOS app runs successfully. Never mark issue #2 as fixed merely because those checks pass.

## Automated simulator journey

The native QA build uses `EVRIDA_BUILD_VARIANT=qa`, which is already supported in `app.config.js`. Both Android and iOS use `com.nishef.evrida.qa`, while the normal build stays `com.nishef.evrida`. **All Maestro flows clear QA-app storage. Never point them at a personal installation.**

- Profile: `eas.json → e2e-test` (credentials-free APK / iOS simulator app).
- Workflow: `.eas/workflows/native-smoke.yml`.
- Flow A: `.maestro/navigation.yml` exercises Plan → Calendar → Boards → Review → Plan.
- Flow B: `.maestro/quick-capture.yml` creates a synthetic goal, changes tabs and verifies the goal remains visible.
- Repo CI checks that `app.config.js` produces distinct QA/production identifiers and that the expected flows/profile exist.

The workflow is **manual** and its Maestro job type is currently alpha. If the Expo account/EAS project has not yet been linked, the owner must perform the one-time authenticated EAS initialization; this repository intentionally does not invent an Expo project ID or commit an API token. From a machine authenticated to the right Expo account, use:

```sh
npx eas-cli@latest init
npx eas-cli@latest workflow:run .eas/workflows/native-smoke.yml
```

Only run `eas init` when linking a new project is actually necessary. If already linked, go directly to the workflow command. A passing Maestro smoke test verifies only the stated interactions, **not** the native SQLite stress scenario, backups, accessibility, notifications or store certification.

## Android P0 database crash reproduction

Issue: [#2](https://github.com/Nishef1/Evrida/issues/2). External Expo reports [#48999](https://github.com/expo/expo/issues/48999) and [#48995](https://github.com/expo/expo/issues/48995) are plausible related cases, not proof of identical causes.

1. Install an **isolated Evrida QA** Android APK on an emulator, create a synthetic goal and leave its editor with unsaved text.
2. Make sure `adb` is installed, then run `bash scripts/android-sqlite-stress.sh` from the project root. The script explicitly rejects physical devices, changes font scale/night theme, and restores their previous values on exit. It neither wipes data nor changes the main app's ID.
3. Review the local `.qa-evidence/` crash-buffer output, Android Studio logcat and device tombstones. **Do not upload unsanitized logs or personal data to public GitHub.**
4. Repeat with background/foreground, rotation, runtime reloads, active/paused Focus and a populated migrated v5→v8 database. Verify database integrity, preserved goal IDs and relationships across process restart.
5. If native `SIGSEGV`, `exsqlite3_step`, `pthread_mutex_lock`, NPE or duplicate close appears, keep P0 open with exact device/API/SDK version and native stack. A one-off clean run cannot close it.

The current source-level SQLite queue is a mitigation. It cannot guarantee safety against native shared-object teardown/garbage-collection races.

## Full journey — manual acceptance checklist

- [ ] Create and edit a Day goal; connect it to Quarter/Year/Life; verify its canonical path after restart.
- [ ] Use a Guided Plan, rename steps, move an Inbox step to Day and add a flexible Timebox.
- [ ] Start Focus from the Timebox; navigate every destination, background and resume, then pause, resume and stop. Verify history and local notification behavior, including denied permissions.
- [ ] Extend Focus time via Recovery preview, confirm only flexible reservations move, then test undo immediately and after expiration. Editing a moved block must invalidate the old undo.
- [ ] Complete a goal while Focus is running and paused; global mini-timer must disappear and history must persist without duplicate recordings.
- [ ] Inspect overlap and DST cases (23/25-hour local days), timezone changes, midnight rollover and date selection in both themes and at max font scale.
- [ ] Export a plaintext v2 backup to a deliberately chosen external destination, verify that destination really contains the file, then restore missing records on an isolated QA installation. Also validate v1 import, cancel and partial merge. Never use the user's only copy.
- [ ] On Android: TalkBack, font scaling, navigation bar, Gboard, exact-alert permissions, battery restrictions and native crash stress.
- [ ] On iOS: Simulator smoke, then real-device VoiceOver, date/time pickers, safe area, background notifications and native signing.
- [ ] On both: 100+ goals, dense Boards, long notes and slow hardware. Profile before adding virtualization or unnecessary caching.

## Release decision

Release remains **blocked** until P0 SQLite native stability, Android/iOS on-device acceptance, backup restore, accessibility and signing/privacy checks have recorded evidence. Current code and JavaScript export checks are necessary but not sufficient. No app store submission, signing credentials, or production migration is performed by this document.

## Under-tested contradiction matrix (source changes not a native pass)

- [ ] Keep a Recovery checkpoint on a flexible Timebox, start Focus on that Timebox, revisit Calendar: Undo must be unavailable; after stopping Focus test whether it becomes available inside the checkpoint window.
- [ ] Open a Move/Resize ghost, save the same reservation from another app route and return: ghost must show a stale-preview warning, not silently migrate to the edited reservation.
- [ ] Begin Quick Focus while intentionally queuing a long SQLite operation: the stored `started_at_ms` and deadline must reflect the actual start, not the time the user first pressed Start.
- [ ] With Review open, replace Focus on the same Timebox. The Focus log and Time Architecture's measured totals must reflect the ended session.
- [ ] Attempt a crafted-but-well-formed 25-hour block backup in QA: import should fail with no partial row changes.
- [ ] Test manual device clock jumps and slow OS time sync mid-Focus; this remains unresolved until on-device semantics are defined.

## October 15 edge-case native test matrix (not executed)

1. **Divergent restore:** On the QA app only, import a v2 fixture; change the title of one matching local goal, then import its earlier file. Preview must report one same-ID difference. Confirming must preserve the local title, insert only missing IDs, and never replace a live Focus session. Modify another matching row between preview and confirmation; expect a fresh-preview error.
2. **High-volume restore:** Create a valid JSON file near the 10-MB limit containing many goals, boards and Timeboxes; measure device RAM, transaction time and UI blocking on an entry-level Android device. Kill the process while the exclusive transaction is running, restart and run SQLite quick/FK checks. Ensure no partial merge.
3. **Android alarms:** Android 14/15 QA app with notifications granted and Special app access → Alarms & reminders denied; verify Focus remains active and a clear OS-setting notice appears. Then allow exact alarms, replace/stop/pause/restart Focus and examine scheduled notifications for 0 or 1 current reminder and delivery outcomes. Reboot, force-stop and battery-restrict separately.
4. **Clock changes:** With running and paused Focus, manually move device clock forward/backward while in foreground and after background/reboot. Compare displayed remaining time with a trusted external monotonic clock. **Do not claim this passes** until native acceptance or design change exists.
5. **Time zones / DST:** Create a 09:00 reservation in one zone and change device zone to another. Existing absolute instant remains fixed; local display changes. Validate 23/25-hour transition list and daylight fall-back ambiguity.
6. **Focus midnight / weekly cutover:** Keep Focus active across midnight, end it after date change and verify history is credited to its end day (as expressly disclosed in Review), while recorded focused minutes do not get duplicated.
7. **Timeline overflow:** Create four to twelve simultaneous reservations. Three-layer ribbon must disclose peak density and the full timeline must show all overlapping items without invisible title hit targets.
8. **Native OS backup:** Compare Android device-to-device/cloud restore with Evrida's in-app file import, ensuring users understand that account-managed device backups are separate. Do not delete personal app data.
