# Learning Projects

**Status:** First slice implemented (2026-10-27): self-rated mastery tracker (below). Resources, workload estimates and adaptive scheduling in this specification are still not started.  
**Product:** Evrida  
**Principle:** Every day with Evrida.

## Why this exists

A Learning Project turns a long-range outcome (for example, improving spoken English) into a resource-aware, measurable plan. It is not just a goal title, note, recurring task or percentage-complete badge. The project connects what the user wants to learn, the material they own, the time available, scheduled study, actual work and evidence of learning.

The existing Goals, Horizons, Boards, Calendar, Timebox, Focus and Review remain the shared foundation. Learning Projects should reference the canonical goal rather than create a second, disconnected copy of it.

## User workflow

1. **Define an outcome.** Name the skill or level to reach, choose an optional target date, and record how the user will recognize success.
2. **Add resources.** Add books, chapters, videos, courses, exercise banks, vocabulary sets or practice tasks. Resources can be split into ordered units and connected by prerequisites.
3. **Estimate the workload.** Provide page/chapter counts, video duration, exercise count, estimated effort per unit or a rough total. Evrida makes assumptions visible and asks for missing inputs rather than pretending to know an entire book or video from its title.
4. **Set capacity.** Choose preferred days, minutes per week, typical session length, unavailable periods and whether the target date is firm or flexible.
5. **Generate the first plan.** Divide remaining units into study sessions, review sessions and checkpoints. Link each session to the same goal in Horizons, Boards and Calendar.
6. **Work and record reality.** Use Focus/Timebox for a session; record what was covered, actual minutes, completion and optional recall/quiz/self-assessment results.
7. **Adapt.** Recalculate remaining effort and the likely completion window as observed pace changes. If a session is missed, apply the user's recovery preference.
8. **Review long-range progress.** Summarize milestones and trends by week, month, quarter and year, while keeping the day timeline useful for execution.

## Estimates: what Evrida can and cannot claim

### Workload estimate

Start with explicit user inputs and deterministic calculations:

- Remaining effort = unfinished unit estimates + planned practice + review allowance.
- Effective capacity = available study minutes per week after the user's unavailable periods and existing fixed commitments.
- Initial completion window = remaining effort distributed across effective capacity, with a buffer for variability and review.
- After enough sessions, update the estimate using the user's observed ratio of actual to estimated time, completion rate and recent consistency.

Show a best-case, likely and slower-case window when the input quality supports it. Otherwise show a clearly labeled provisional estimate and the assumptions behind it. Do not present an exact completion date when unit durations, available time or historical pace are unknown.

### Learning progress is not the same as time spent

Time and finished pages/videos are measures of activity, not proof of mastery. Where useful, let the user add retrieval practice, quiz results, speaking/writing checkpoints or a self-rating. Report separately:

- **Material progress:** units completed out of total units.
- **Effort progress:** actual minutes compared with estimated effort.
- **Retention/mastery evidence:** the latest recall or assessment signal, with date and method.
- **Forecast confidence:** based on the amount and consistency of observed data.

Do not infer a language level or guarantee fluency from hours alone. The user should be able to mark an assessment as unavailable rather than fabricate a score.

## Adaptive scheduling rules

- A user can choose **Suggest changes** or **Auto-replan flexible study sessions**. Suggestions are the safer default.
- When a study session is missed, schedule its unfinished work into the next feasible slots, respecting preferred study windows, weekly capacity, priority and target date.
- Preserve fixed commitments, user-locked blocks, completed history and an active Focus session. Never silently move these.
- If all work cannot fit before the target date, explain the shortfall and offer choices: extend the date, increase weekly capacity, shorten/de-scope the plan, or lower review frequency. Never overbook the calendar without consent.
- Avoid endless postponement: carry overdue work forward with an explicit recovery state and show when the plan is at risk.
- Use local notifications for upcoming sessions and review prompts where permissions permit. Permission denial must not make the core plan unusable.
- Replanning must be deterministic, previewable/auditable, reversible where practical and safe across app restarts. It must not overwrite newer user edits.

## Review and retention

The first version can use configurable review intervals and simple recall outcomes. Later, review timing can adapt to the user's answers and confidence. Use retrieval practice and spaced review as evidence-informed options, not as a claim that one schedule works identically for every subject or learner.

## Data and privacy

- Remain offline-first and account-free for the initial implementation.
- Store the project, resource units, estimates, session links, actual effort, review events and assessment records in versioned local storage.
- Include the new records in validated backup/export/import and migration tests before enabling the feature for real data.
- Keep imported resource text and AI output untrusted. Any future AI-assisted parsing of a syllabus, book outline or video chapters must show a preview and require user confirmation before creating or changing a plan.
- AI, cloud sync, subscription features and external calendar integrations are not prerequisites for the first version.

## Delivery slices

### LP1 — Manual resource-aware plan

- Learning Project outcome, target date, weekly capacity and session preferences.
- Resources and ordered units with explicit effort estimates.
- Deterministic remaining-work and completion-window calculation.
- Sessions created through existing Calendar/Timebox and linked to Focus.
- Material progress, actual effort, local reminders and manual rescheduling.
- Backup schema versioning and migration.

### LP2 — Personalized forecast and recovery

- Calibrate per-unit estimates from actual work history.
- Missed-session detection and opt-in re-planning of flexible study blocks.
- Capacity/conflict explanations and deadline-at-risk state.
- Weekly review of plan versus reality and long-range milestones.

### LP3 — Learning feedback

- Optional retrieval/quiz/self-assessment records.
- Scheduled review sessions and adjustable spacing.
- Mastery/retention signals separated from material completion and time spent.
- Evaluate resource import only after manual entry and planning are reliable.

## Acceptance criteria

- [ ] A user can create a learning outcome and add a book with chapters plus a video series with individual videos.
- [ ] Evrida shows remaining units, estimated effort, available weekly capacity and a completion window with assumptions.
- [ ] Study sessions link to the original goal and appear consistently across Horizons, Boards, Calendar and Focus.
- [ ] Completing a session updates progress once; restarting the app does not duplicate or lose records.
- [ ] A missed session follows the selected recovery mode and never moves a fixed/locked block or active Focus session.
- [ ] If the deadline is infeasible, Evrida explains why and presents realistic alternatives rather than silently overbooking.
- [ ] Session reminders work in supported native conditions; denied permissions and OS restrictions are communicated honestly.
- [ ] Backup/restore preserves learning projects, units, links, progress and review records without replacing conflicting local records.
- [ ] Large text, keyboard navigation, screen-reader labels, light/dark themes and offline operation are checked on Android before acceptance.
- [ ] Tests stay within the repository's 20-test budget by extending or replacing meaningful cases rather than adding redundant tests.

## Explicitly not promised

LP1 cannot know how long a learner will need to master a skill solely from a book title, page count or minutes studied. Estimates improve only when the user provides workload information and Evrida observes actual pace. Learning outcomes need evidence beyond task completion.

## Implemented slice: self-rated mastery tracker (Learning, schema v12)

Reached from Review → Learning. Optional and offline; nothing is required by planning.

- **Topics** grouped by a free-text subject (for example English → Past perfect), each with a description.
- **Check-ins**: the user's own 1–10 score, optional minutes practised, what was covered, notes and a date. Score bands are a personal guide, not a standard test. Practice time and mastery are stored and shown separately.
- **Trend**: scores over time on a fixed 1–10 scale; change since the previous check-in.
- **Weekly review**: per-topic result for the chosen Monday-based week, topics not yet rated, total practice time, and a note when long practice did not raise the score.
- **Next week's focus**: topics can be marked manually; suggestions come only from the user's own ratings (low or stale), never from an automatic assessment.
- **Target and pace**: an optional target score and date per topic. From three or more ratings over at least two weeks, a least-squares slope of the user's own recent ratings gives a rough likely date and a later one; with too little data or no upward trend it says why it cannot estimate. Always labelled provisional.
- **Weekly reminder**: an optional per-device repeating notification (day and hour). The OS delivers it, so battery saving or disabled notifications can delay or block it; it is re-armed when the Learning screen opens and contains no study data.
- **Backup**: backup format v6 / schema 12 (`learn_topics` with target fields, `learn_checkins`); v5 and older backups upgrade with empty or null values.

Not implemented: linking topics to goals or calendar sessions, resources (books, videos, units) and effort-based time estimates, adaptive scheduling, charts beyond the score trend.
