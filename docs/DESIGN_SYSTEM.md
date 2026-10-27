# Evrida design system

**Product name:** Evrida  
**Tagline:** Every day with Evrida

Direction: **Studio** — a personal planning workspace with neutral surfaces, restrained depth and clear time horizons. This replaces the provisional warm/green styling. It is an implemented direction awaiting user aesthetic review, not a release or accessibility sign-off.

## Visual grammar

- A cool neutral canvas supports white cards in light mode and graphite surfaces in dark mode.
- Use green to identify a selected destination, a connected parent, or a deliberate primary action. Avoid flooding every surface with accent color.
- Small layered shadows distinguish cards and selected controls. Dark mode relies primarily on border and surface separation. Shadows must never carry essential state alone.
- Keep controls precise: 12dp corners, 16dp cards, 28dp sheets. Nested radii should follow the actual inset rather than matching outer radii indiscriminately.
- Typography uses the native system family. Screen titles are 28–32sp, goal titles 15–16sp, ordinary copy 13–15sp. Supporting text may be smaller, while respecting dynamic font scaling. Decorative brand labels are secondary.
- Icons use Lucide vectors with consistent 1.5–2 stroke weights. Keep root navigation labels visible; a clever symbol must not replace the destination name.
- Use a 4/8dp spacing rhythm, 20dp screen gutters and generous separation between groups. Dense content still needs readable task titles and 48dp touch targets.

## Semantic tokens

`src/theme/tokens.ts` is the implementation source for palette, spacing, radius and depth.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#F6F6F8` | `#141517` |
| Surface | `#FFFFFF` | `#202226` |
| Inset/control group | `#EDEEF1` | `#292C31` |
| Primary text | `#24262B` | `#F2F3F5` |
| Secondary text | `#696D77` | `#ADB1BB` |
| Accent | `#35634D` | `#A3CEB5` |
| On accent | `#FFFFFF` | `#15251C` |
| Accent surface | `#EAF1EC` | `#26392F` |
| Border | `#E2E4E9` | `#34373E` |

Use `onAccent` for filled primary controls, not hard-coded white. Completion must also have a check and semantic accessibility state. Timeboxes retain a separate warm scheduling accent; calendar color never replaces exact times or labels.

## Navigation and daily planning

- Four labeled root destinations: Plan, Calendar, Boards, Review. Settings and Archive are workspace utilities.
- Plan groups Your plan / Horizons / Inbox in one segmented selector. Only one mode is visible at a time.
- The selected planning horizon opens a bottom sheet containing all seven canonical horizons. Previous/next and Now remain adjacent, with the selected period under the page title. Life has no meaningless previous/next controls.
- Inline capture saves a title in the current context; Inbox is explicitly unscheduled. The adjacent planning-details action carries the typed title into the editor. Cancel preserves the inline draft; successful creation clears only that matching draft.
- An open goal's organization sheet offers explicit Today, Tomorrow, This week and Inbox destinations, omitting its current destination. Repeating steps offer daily destinations only. After moving, show the destination. Keep deadline, calendar reservation and recurrence anchor independent of this planning move.
- Positional Move up/down belongs to the actual period list, not global search results or a mixed-horizon Inbox. The organization sheet scrolls on constrained screens and with larger fonts.
- Goal cards lead with the title and optionally show a compact connected-parent badge. Completion and organization have separate touch targets.
- Plan separates open goals from a collapsed Completed section with a real count and an explicit show/hide control. Completed goals stay searchable and can be reopened. The count describes the selected planning context, not when completion happened.
- A goal's next steps can expand inline: show up to three canonical children, their actual planning contexts and independent completion controls, with access to all steps through goal details. Read children on expansion and refresh an expanded preview after writes; avoid replacing the entire list during a same-context refresh.
- Capture names its destination above the input and announces a successful save there. Changing planning context must not carry a previous destination's success message. Keep the keyboard available for consecutive captures and retain the typed title when opening Details.
- Horizons displays the seven time scales along a quiet rail. The rail connects time scales, not arbitrary goal entities. Actual parent relationships are shown only from stored relationships.
- Empty states guide one useful action without fake progress, sample goals inserted into user data, or a second competing primary button.

## Goal detail and editing

- Title and planning period precede supporting context. Ancestor links remain directly navigable.
- Quick Focus offers 15/25/50 minutes on an existing open goal. Starting Focus creates a real Timebox and session. Completion remains an explicit, independent decision.
- The organization sheet also offers a labeled 25-minute Focus shortcut. It uses the same existing-session replacement confirmation as detail.
- The editor uses a stable frame with a fixed header and save area. Title and bounded, internally scrolling notes precede a collapsible planning summary; changing note length or expanding planning must not resize the sheet. Android form scrolling keeps the keyboard open; the title's Next key moves directly to notes.
- Creating a smaller step shows its parent in a context card and keeps that connection fixed during creation. The new step starts in Inbox without an invented date; optional planning remains available. Save and cancel return to the original detail path, with saved children reloaded. Reparenting remains available through ordinary goal editing.
- Planning dates, deadlines, repeats and optional reparenting use progressive disclosure. Horizon/repeat choices wrap rather than hide offscreen, and controls use consistent vector icons. Native date/time pickers preserve civil-date semantics.
- Save stays above the bottom safe area. Dirty drafts require an explicit discard choice on close/back/backdrop.
- Archive is reversible. Destructive or replacement decisions must explain the affected state before confirmation.

## Calendar, boards and review

- Calendar uses the same segmented-control grammar for Day/Week/Month/List. Exact timestamps, overlap lanes and an accessible list remain available.
- The calendar date heading opens the native date picker in every view, allowing a direct jump without repeated week/month paging. Today still returns to today's timeline.
- Untimed daily goals are distinct from midnight events. Horizon, deadline and time reservation are separate concepts.
- Boards reference existing goal identities. Board cards use a small folder emblem, readable title, description and real counts.
- Review uses recorded Focus time and actual completion history. No create/edit-count productivity score or compulsory streak. Empty progress is an invitation, not a wall of zeroes.
- An active Focus session remains above the dock. Its expanded sheet separates Pause/Resume/End from completing the goal.

## Platform and accessibility contract

- Respect safe areas, keyboard insets, dynamic fonts and platform back behavior. Touch targets aim for at least 48dp on both platforms.
- Honor system reduced motion for route and sheet transitions. Do not introduce decorative animation dependencies.
- Light/dark, populated/empty, editing/error and large-text states require rendered native review. Build/type/test success is not visual evidence.
- English is currently implemented. Persian localization, native RTL and Jalali presentation require separate implementation and acceptance; Persian planning content alone does not prove that support.
- Keep reference images, private research and temporary prototype renders outside the public repository. Use principles from references without copying third-party branding, artwork or exact compositions.

## Evidence boundary

The October 15 direction was grounded in a user-supplied reference collection and a three-screen scratch composition before production edits. Android release screenshots and sampled interactions are recorded in `ROADMAP.md` and `ANDROID_QA.md`. Aesthetic acceptance by the user, physical-device accessibility, and native iOS review must be stated separately.

## 2026-10-15 — Direct manipulation of time, without loss of control

- **Daily Timeline is the principal visual surface**, not a picture-only calendar. Precise wall-clock positions, overlap lanes, visible titles and Now line remain.
- Three zoom levels (56/76/104dp per hour) must scale empty-hour tap geometry too, not only visible grid rules. A press on a visually selected hour opens the correct hour's native editor.
- Visible, full-width blocks now use dedicated 48dp move and resize grips when physically tall enough. On compact or overlapping blocks, long-press opens the **same** accessible move/resize stepper; tapping still opens the full editor. Screen reader increment/decrement actions provide quarter-hour steps.
- Move, resize and Ripple are **preview-first**: manual direct changes render a dashed Ghost at the proposed time on the real day timeline; Recovery shows paired before/after bars scaled to the range affected by the changes. No persistence before Confirm.
- The existing goal remains linked to every schedule change. Manual editing changes only the timestamps, not the goal, title, completion, recurrence anchor, deadline or board membership. An active Focus block cannot be moved; a stale or newly colliding proposal is rejected transactionally.
- Semantic colors replace arbitrary per-goal hashing on the daily timeline: planned reservation = deep teal `#3F6C65`; warm Timebox = `#956C3F`; completed = muted graphite `#66716E`. Text and accessibility labels express type, fixed/flexible and completed state independently of color. Contrast: small white text against these surfaces meets at least 4.5:1; the small Now label uses darker amber `#9B5F30`.
- The day strip is a three-lane micro-overview, grouping simultaneous entries into distinct visible rows. Four large six-hour jump targets turn it into navigation rather than a decorative bar. The 23/25-hour DST exception deliberately omits this 24-hour simplification and retains exact List view.
- Week and Month measure **unique occupied wall time** rather than inflating capacity by counting overlaps twice. Week explicitly retains a conflict warning and Calendar List preserves exact timestamps.
- Short items cannot safely show two 48dp handles without obscuring neighbors; long-press and the full List/Editor are supported alternatives. Do not falsify visual heights to pretend 15-minute reservations last longer.
- Reduced-motion mode avoids decorative animation dependencies. Confirm/cancel control state is explicit; never depend solely on a swipe gesture.

**Evidence boundary:** TypeScript/JS exports and SQLite unit/integration tests have passed this source slice. Direct drag hit-testing, nested ScrollView negotiation, 130–200% font scaling, TalkBack/VoiceOver, keyboard, landscape and low-end device FPS still require rendered native interaction testing. No screenshot, prototype or build result should be called user aesthetic acceptance on its own.

## Source of truth for styling and calendar data (2026-10-15)

`src/theme/tokens.ts` is the only shared source for Studio palette, spacing, radii, depth, semantic schedule tones, feedback colors and the `Palette` type. Keep screen-specific layout and placement in its own `StyleSheet.create`; duplicate meaning, not all similar numeric values, is what should be eliminated.

`src/domain/timeblocks.ts` is the single place for interval clipping, overlap predicates, reserved duration and occupied-wall-time math. The Calendar screen performs one block-range read for the month grid containing the selected week, then derives Day/Week/Month slices from the result. Both cards and their parent header refer to occupied wall time. Never multiply-report overlapping Timeboxes as separate elapsed hours.

The CI source contract `scripts/check-design-ssot.mjs` blocks repeated Palette definitions, semantic schedule hex colors in feature code and independent Day/Week/Month block arrays. Read-only domain tests protect overlap math and contrast. This is source verification, not native font-scaling or device aesthetic acceptance.

### Remaining visual QA

- [ ] Font scaling at 100%, 130% and 200%; allow title wrapping and avoid truncating touch labels.
- [ ] Correct handling for calendar blocks shorter than 30 minutes and dense overlap, especially drag/resize affordances and 48dp interaction surfaces.
- [ ] Light/dark contrast of warnings and destructive links in Android TalkBack and iOS VoiceOver.
- [ ] Navigation, Month grid and Focus dock at small screen width and landscape.
- [ ] Manual screenshots/recordings and user review before calling the entire Studio design final.

## Density and truthful timing updates (2026-10-15)

- The 24h mini-ribbon has three visual lanes; when real peak concurrency exceeds three, show that peak explicitly and route the user to full Calendar. The interval sweep treats an exact end/start boundary as adjacent, not simultaneous.
- Starting Focus from a Timebox whose scheduled end is in the past must explicitly say that only a new Focus timer begins now and the historical calendar block remains unmoved.
- Travel across timezones alters display of stored instants; no hidden "floating 09:00" promise.
- Weekly Review groups entire sessions by end day, and cannot truthfully allocate paused segments across midnight until explicit activity-segment history exists.
