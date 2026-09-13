# UI Improvement — Tasks Dashboard Redesign

Spec only. Nothing in this document is built yet — it's a precise record of six
mockup screens so they can be implemented later without re-deriving intent from
screenshots. Every string, color, and state below was read directly off the
mockups; anywhere the mockups were ambiguous, that's called out under
**Open questions** rather than guessed into the spec silently.

Reference images: 6 screens, in this order — Tasks list, Build-a-plan step 1/2/3,
Plan-saved/share, Home ("Today") dashboard.

---

## 1. What's changing, at a glance

- **Nav shell**: 4 tabs → **5 tabs**. `Voice` is renamed `Ask` and becomes a
  raised center FAB. `Invites` is renamed `Invitation`. A new **Profile** tab
  appears with no spec'd content yet.
- **Home screen**: the month-calendar `Scheduler` is replaced (or joined — see
  §9) by a **"Today" dashboard**: greeting, work/free-hours stat line, a
  7-day week strip, a live timeline with free-gap quick-add slots and a "NOW"
  marker, and an inline invitations feed.
- **Tasks tab**: gets a real list view (course tag, progress bar, due countdown)
  in front of the existing 3-step wizard, plus a **week/month/year** scope
  switch and a sort control — none of which exist in `Task.tsx` today.
- **New data needed**: a course/label per task with its own color, a computed
  progress percentage, a "term week" counter (`WEEK 4 OF 14`), and — on the
  home dashboard — per-day busy-dot colors and a live "now" position.
- **New color semantic**: cards are now colored by **course**, not by
  `Activity.kind` (class/meeting/activity/work). These are two different
  coloring systems and §6 spells out how they'd coexist.

---

## 2. Information architecture — tab bar

| Slot | Current (`App.tsx`) | New mockup |
|---|---|---|
| 1 | Schedule (calendar icon) | Schedule (calendar icon) — icon unchanged |
| 2 | Tasks (checklist icon) | **Task** (checklist icon) — singular label |
| 3 | Voice (mic icon, flat) | **Ask** — mic icon, **raised circular FAB**, no text label, floats above the bar line with its own shadow |
| 4 | Invites (envelope icon + count badge) | **Invitation** (envelope icon + count badge) — same badge pattern, renamed |
| 5 | *(none)* | **Profile** (person icon) — **new tab, no content specified** in any mockup |

The FAB treatment on `Ask` is the one structural change: today all four tabs
are equal-weight flat icons in `.tabbar`; the new bar has four flat icons and
one visually dominant center button. This needs its own CSS component
(`.tab-fab` or similar) — it isn't a variant of `.tabbar button`.

Active-tab styling in the mockups: the active tab's icon+label render in
`--accent` and bold; inactive tabs are gray. Confirmed on screen 1 (`Task` is
orange/bold while the rest are gray). Screen 6 doesn't make the active tab
obvious — see §9.

---

## 3. Component inventory

Net-new components implied by the mockups, named for what they'd become in
`index.css` / a screen file. "Reuses" notes where an existing pattern in this
codebase already covers part of it.

| Component | Where seen | Reuses |
|---|---|---|
| `.step-pill` — "Step X of 3" | Wizard steps 1–3 | none |
| `.back-link` — chevron + text | Wizard steps 1–3, share screen | `.btn-link` is close but that's centered/underlined, not a leading-chevron nav link |
| Segmented control, **pill-track** style | Tasks list ("This week / month / year") | none — new |
| Segmented control, **underline-tab** style | Home dashboard ("Today's Plan / Due This Week") | none — new, and a *second* segmented-control visual for the same job (see §9) |
| `.plan-banner` — big CTA card with icon badge + two-line copy | Tasks list ("Build a plan") | bigger sibling of `.add-btn`; that's a small pill, this is a full-width banner |
| Sort control — label + direction arrow | Tasks list ("sort by due date ↑") | none |
| **Task card** — tag pill, due date, title, progress bar, done-%, time-left pill | Tasks list | shares nothing with `.chip` (Scheduler's agenda entries) — different data (course, progress) |
| **Progress bar** — track + colored fill | Task card | none |
| Form field — label, input, helper text below | Wizard step 1 | `.add-input`/`.note-input` exist; the *helper text below the field* is new |
| Split deadline row — date field + time field, each with a trailing icon | Wizard step 1 | none |
| **Choice card** — icon badge, title, description, embedded 3-bar preview, caption, selected/unselected state | Wizard step 2 | `.neg-option` (Voice tab) is the closest relative — a bordered, tappable row with title+subtitle — but has no icon badge or bar-chart preview. `docs/features/task-plan.md` already documents step 2 reusing `.neg-option`; the mockup shows a visibly richer card than that. See §9. |
| Effort chip row — 4 single-select pills | Wizard step 2 | `.recur-toggle` is a single on/off chip; this is 4 mutually-exclusive chips, closer to `.kind-pill` from the Scheduler's add-event form |
| **AI info banner** — round "R" avatar + explanatory text, peach card | Wizard step 3 | conceptually the same job as the grayed AI text just shipped in Voice (an "AI is talking" marker), but a card treatment instead of gray text — see §6 |
| "Edit all" link | Wizard step 3 | `.btn-link` |
| **Session card** — colored left border, time range, duration pill, description, session-number pill, edit affordance | Wizard step 3, share screen | closest relative is `.neg-option`/`.chip`, but this is a new shape (see full breakdown in §5.4/§5.5) |
| Timeline day-marker — weekday abbreviation + big date number + connecting line | Share screen | none — the month calendar's `.cal-cell` is a grid day-number, not a vertical timeline node |
| Inline success row — filled checkmark circle + text | Share screen | none (the closest existing pattern, `.nothing-pill` in Voice, is a dot+text pill, not a checkmark) |
| `.btn-outline`-with-icon "Share" button | Share screen | `.btn-outline` exists (Voice's negotiation "Skip it"); adding a leading icon is new |
| Greeting header with inline colored stat spans | Home dashboard | none — first place body copy needs two colored inline spans in one sentence |
| **Week strip** — 7-day row, today circle-highlight, per-day dots | Home dashboard | a condensed cousin of `.cal-grid`/`.cal-cell`, but a single row instead of a month grid, and dots read as multi-colored busy indicators rather than the single-color `.cal-dot` today |
| Free-gap row — "Xam–Ypm · N hrs free" + dashed circular "+" | Home dashboard | none — this is the dashboard's version of "click a free slot to add something," which the Scheduler currently does differently (a global `+ Add` button, not per-gap) |
| "NOW" marker — horizontal rule with a time label | Home dashboard | none |
| **Course-colored event block** | Home dashboard timeline | visually plays the role of `.chip`, but colored by course/label, not by `Activity.kind` |
| Invitation preview card (dashboard) | Home dashboard | different from `Inbox.tsx`'s full invite card — this is a condensed teaser: sender, timestamp, message, one status line |

---

## 4. Screen-by-screen spec

### 4.1 Tasks list

**Purpose**: the Task tab's landing view — a scannable list of open tasks,
entry point into the wizard.

Top to bottom:

1. Eyebrow: `WEEK 4 OF 14` — small caps, tracked, `--ink-3`. **New data**: a
   "current week of N-week term" counter. Nothing in the app currently tracks
   a term length or week number.
2. H1: `Tasks` — bold, tight tracking, `--ink`.
3. **Plan banner** (`.plan-banner`): full-width rounded card, solid `--accent`
   fill, white text/icon, subtle shadow.
   - Left: a `+` icon inside a translucent-white circle badge.
   - Right, stacked: bold `Build a plan` (white, ~16px) over regular
     `Add a task and Ruang schedules it for you` (white at reduced opacity,
     ~13px).
   - Tapping it starts the wizard at step 1 (§4.2).
4. **Segmented control** (pill-track style): `This week` / `This month` /
   `This year`. Active segment (`This week` in the mockup) is a white pill
   with a soft shadow and bold black text, inside a light `--bg-dim` track.
   Inactive segments are plain text in `--ink-3`, no pill.
5. Row: `4 TASKS` (small caps, `--ink-3`, left) and `sort by due date ↑`
   (small, `--ink-3`, right, with a direction arrow — implies tapping it
   flips ascending/descending and/or opens a sort-field picker).
6. **Task cards**, vertically stacked, each:
   - Card background: a very light tint of the task's course color (e.g. pale
     pink for a red-tagged course).
   - Top row: course tag pill (left — e.g. `BIO 101`, colored text on a
     slightly deeper tint of the same hue) and due date+time (right, gray,
     e.g. `Wed 4 Sep · 9pm`).
   - Title: bold, `--ink`, one line (e.g. `Tutorial Slides`).
   - **Progress bar**: thin rounded track (light tint) with a colored fill.
     Fill color is **not always the course color** — see §6 for the two
     overlapping color systems this implies.
   - Bottom row: `{n}% done` (gray, left) and a pill (right) reading either a
     hours-left or days-left countdown (e.g. `7 hrs left`, `5 days`) —
     tinted to match the card, text in the more saturated version of the
     tint.
   - Four example cards seen: `BIO 101 / Tutorial Slides` (20% done, red
     fill, "7 hrs left" — due today, hence hours not days), `ENG 301 /
     Literature Review` (35% done, **green** fill despite a neutral gray
     tag, "5 days"), `MGT 204 / Group Report` (10% done, gold fill, "5
     days"), `MATH 210 / Problem Set 4` (mostly filled, cut off by the
     viewport — list scrolls, thin scrollbar thumb visible on the right
     edge).
7. Tab bar (§2).

### 4.2 Build a plan — Step 1 of 3

**Purpose**: capture — what the task is, what course it's for, and when it's due.

1. Top row: `‹ Tasks` back-link (left, returns to the list) and a `Step 1 of 3`
   pill (right, muted `--bg-dim` background, small gray text).
2. H1 (two lines): `What do you need to get done?`
3. Subtitle: `Ruang will fit it into your week.` — `--ink-3`.
4. Field — label `TASK NAME` (small caps eyebrow style, required — no
   "(optional)" suffix): white input box; example filled value `Thesis
   Introduction Draft` with a visible text-caret in `--accent` (i.e. the
   field is focused/active in the mockup). Helper text directly below the
   box, smaller and `--ink-3`: `e.g. Finish problem set, write lit review
   section`. **Open question**: is that helper line always visible, or only
   while the field is empty? The mockup shows it under a *filled* field, so
   spec it as always-visible unless decided otherwise.
5. Field — label `COURSE OR LABEL (optional)`: white input box, example value
   `ENG 401`.
6. Field — label `DEADLINE` (required): **two fields side by side**, not
   stacked — a wider date field (`Mon 9 Sep`, calendar icon trailing) and a
   narrower time field (`11:59 PM`, clock icon trailing). The rest of
   `task-plan.md`'s existing flow only captures a date, not a time — this
   mockup adds a **deadline time**, which is new.
7. Primary CTA, bottom-docked, full width: `Next →` — solid `--accent`,
   white bold text.

### 4.3 Build a plan — Step 2 of 3

**Purpose**: choose pacing (existing "quick" vs "relaxed" concept from
`task-plan.md`) and total effort.

1. Top row: `‹ Back` / `Step 2 of 3` pill.
2. **Context card**: white rounded card summarizing step 1's input so it's
   never lost crossing steps — small tag `ENG 401` top-left, bold title
   `Thesis Introduction Draft`, gray subtitle `Due Mon 9 Sep · 11:59 PM`.
   This card is new relative to `task-plan.md`'s description of step 2,
   which doesn't mention a persistent recap.
3. H2 (two lines): `How do you want to approach it?`
4. Subtitle: `This shapes how Ruang slots sessions into your week.`
5. **Choice card A — selected state** (`Finish it quickly`):
   - 2px `--accent` border, pale peach fill (distinguishing it from the
     unselected white card), filled orange circular checkmark top-right.
   - Icon badge (left): pale peach circle containing an orange star icon.
   - Text (right of badge): bold `Finish it quickly`, gray description
     `Ruang blocks longer sessions early — done before you know it.`
   - **Embedded 3-bar preview**: three horizontal bars, descending
     length/height, all in orange tones (dark→light) — a literal miniature
     of "front-loaded, tapering" distribution.
   - Caption under the bars: `Heavy early · lighter later` (small, gray).
6. **Choice card B — unselected state** (`Take my time`):
   - Thin neutral 1px border, white fill, no checkmark.
   - Icon badge: beige/tan circle containing a clock icon.
   - Text: bold `Take my time`, gray description `Even sessions spread over
     the week — less pressure, same result.`
   - Embedded 3-bar preview: three **equal**-length bars, in **sage/green**
     tones (not the badge's beige) — deliberately borrowing the app's
     existing `--sage` "calm/even" semantic rather than matching the badge
     color. This cross-color choice (badge ≠ bar color) is intentional in
     the mockup, not an inconsistency — keep it.
7. Label `ESTIMATED EFFORT` (small caps).
8. **Effort chip row**, 4 single-select pills in one row: `1–2 hrs`, `Half a
   day` (selected — solid `--accent` fill, white bold text), `Full day`,
   `2+ days` (all three unselected: light `--bg-dim` fill, gray text).
9. Primary CTA: `See proposed schedule →`.

### 4.4 Build a plan — Step 3 of 3 (proposed schedule)

**Purpose**: show the concrete plan before anything is written — matches
`task-plan.md`'s existing "nothing is written until Add these to my week"
trust rule, just with a new visual shell.

1. Top row: `‹ Back` / `Step 3 of 3` pill.
2. Eyebrow (plain text, not a card): `ENG 401 · DUE MON 9 SEP`.
3. H1: `Thesis Introduction Draft`.
4. **AI info banner**: pale peach rounded card — round orange badge with a
   white `R` mark (a "Ruang is talking" avatar) on the left, and on the
   right: `4 sessions across 4 days — each fits your free gaps. Tap a block
   to shift it.` This single card does two jobs: summarizes the plan *and*
   states the tap-to-edit affordance that `task-plan.md` already documents
   ("Any proposed session opens an inline editor").
5. Row: `PROPOSED BLOCKS` (small caps, left) / `Edit all` (link, right,
   `--accent` text — implies a bulk-edit mode, not currently in
   `task-plan.md`).
6. **Session cards**, 4 in a flat list, each with a colored left border
   (~3–4px):
   - Header row: date + time range in the border's color (e.g. `Thu 5 Sep
     3pm – 5pm`) and a duration pill, right-aligned, light gray (`2 hrs`).
   - One card in the mockup (session 2) additionally shows an `✎ Edit`
     text+icon on that same row instead of/alongside the duration pill —
     see §9, this may be a hover/press-state artifact of the mockup rather
     than something every card shows at rest.
   - Body: a specific, actionable description, sometimes phrased as a
     question (`Research & outline — what's your argument?`, `Draft the
     hook and context paragraph`, `Revise, tighten, add citations`, `Final
     read-through and submit`).
   - Small pill, bottom-left: `Session 1` … `Session 4`.
   - **Border color**: sessions 1–3 are `--accent` orange; **session 4 (the
     last one) is `--sage` green.** This mirrors the app's existing
     "sage = clear/done" semantic — the final, submission-adjacent session
     is marked distinctly from the three working sessions before it. Keep
     this distinction; it isn't a mistake in the mockup.
7. Primary CTA: `Accept this plan` — **no trailing arrow**, unlike every
   other primary CTA in this flow. Flag before building: intentional (it's a
   commit action, not a "next step") or an inconsistency to fix. See §9.

### 4.5 Plan saved (share screen)

**Purpose**: post-commit confirmation + sharing, reached after "Accept this
plan." Corresponds to the share step already described in `task-plan.md`
§"The share step," with a specific visual layout the doc didn't yet nail down.

1. Top row: `‹ Tasks` back-link (left — confirms this screen's "back" goes to
   the list, not into the wizard) and `⬆ Share` (right — an **outline**
   button: icon + label, `--accent` text/icon, thin border or transparent
   fill, not the solid-fill treatment every other CTA in this flow uses).
2. **Inline success row**: filled green circle with a white checkmark, next
   to `Plan saved · 4 sessions blocked` (gray/black, regular weight) — a
   lightweight, non-modal confirmation. No existing component in the app
   does exactly this (closest relative, `.nothing-pill`, is a dot not a
   checkmark).
3. H1: `Thesis Introduction Draft`.
4. Subtitle: `ENG 401 · Due Mon 9 Sep · 11:59 PM`.
5. **Timeline**, vertical, connected by a line down the left side:
   - Each row: a day-marker (small caps weekday, e.g. `THU`, over a large
     bold date number, e.g. `5`) sits on the timeline; to its right, a
     session card: time range + duration pill on top, a **short-form title**
     (`Thesis Intro` — truncated from the full `Thesis Introduction Draft`
     used everywhere else; this short form is new and needs its own
     generation rule, not just a CSS `text-overflow: ellipsis`, since it's a
     different string, not a clipped one), then the same description text
     from step 3.
   - Date-number color: orange for the first three days (`5`, `6`, `7`),
     **green for the last one (`8`)** — the same session-4-is-different rule
     as step 3, expressed here as the timeline node's color instead of a
     card border.
6. Primary CTA: `Alright, Thank you` — casual, conversational copy,
   deliberately unlike the imperative `Next →` / `Accept this plan` pattern
   elsewhere, because this button *dismisses* rather than *advances*. Keep
   the tone distinction when implementing copy elsewhere in this flow.

### 4.6 Home ("Today") dashboard

**Purpose**: the new landing screen — replaces (or sits alongside — §9) the
month-calendar `Scheduler`. Agenda-first instead of month-grid-first.

1. Eyebrow: `WEEK 4 OF 14` (same term-progress indicator as the Tasks list —
   confirms it's a global header element, not specific to one tab).
2. Greeting H1: `Good morning, Hana.` — time-of-day aware (`Good
   morning`/`afternoon`/`evening`), using the existing editable `name` from
   `app/store.ts`.
3. Subtitle, **with two colored inline spans in one sentence** (new pattern —
   nothing in the app currently colors words mid-sentence): `Today, you will
   have `**`12 hrs work`**` (orange) and `**`8 hrs free`**` (sage green).`
4. **Week strip**: a single row, `S M T W T F S` with date numbers below.
   Today (`W`, `4`) is a solid `--accent`-filled circle with white text.
   Other days show small dots beneath — plural, differently colored per day
   (e.g. two dots under Tuesday, one gold dot under Friday) — read as a
   compact busy-heatmap, richer than the single-dot-per-day the month
   calendar currently does (`domain/dates.ts` / `.cal-dot`).
5. **Segmented control, underline-tab style** (visually distinct from the
   Tasks list's pill-track control — see §9): `Today's Plan` (active,
   `--accent` text + underline) / `Due This Week` (inactive, gray, no
   underline).
6. **Timeline**, no connecting line (unlike the share screen's timeline),
   alternating:
   - **Free-gap rows**: `12am – 10am · 10 hrs free` in gray, with a small
     dashed-outline circular `+` button on the right — a per-gap "add
     something here" affordance. This is a materially different interaction
     than today's Scheduler, which only has one global `+ Add` for the whole
     selected day.
   - **Course-colored event blocks**: tinted background matching the
     course's color, small course tag pill top-left, time range top-right,
     bold title. Three examples: green `ENG 301 / Literature Review`
     (10am–12pm), gold `MGT 204 / Group Report` (2pm–4pm), a red/pink block
     for `MATH 210` (7pm–9pm, partially cut off by the viewport — scrolls).
   - **"NOW" marker**: a horizontal rule crossing the timeline at the actual
     current time, with `1:45 PM` and `NOW` on the line — splits the
     timeline into past (above) and future (below) at a glance. This needs a
     live clock, not just a static render.
7. Section: `INVITATIONS +1` (small caps label with an inline count) and a
   `+` button — **open question** on what that `+` does here (§9).
8. **Invitation preview card**: `Aiman · Futsal Crew` (bold, left) /
   `9:38 AM` (gray, right); message preview `Futsal Jumaat malam 8pm free
   tak?`; status line with a colored dot: `Busy Fri 8pm · Literature Review
   · tap to decide`. This names the *specific conflicting task* (`Literature
   Review`) — see §6 for why that's fine here and would not be fine if the
   bot said it to the group.
9. Tab bar (§2) — active tab unclear in this screenshot; see §9.

---

## 5. Data model implications

None of this exists on `Activity` or the task type today (`domain/task.ts`,
`domain/types.ts`). To build these screens as spec'd, something needs to add:

- **Term calendar**: current week number + total weeks (`WEEK 4 OF 14`).
  Global, not per-task — shown on both the Tasks list and the dashboard.
- **Course/label color**: today a course is just a free-text string
  (`COURSE OR LABEL (optional)` in step 1). The mockups imply each distinct
  label gets a stable color (seen: a red/salmon, a neutral gray, a gold, and
  a deeper red — at least 4 distinct hues cycling). Needs either a fixed
  palette keyed by a hash of the label, or a user-assignable color per label.
- **Progress percentage** per task, shown as `{n}% done`. `task-plan.md`
  currently tracks only `planned` — no progress state ("you tick things off
  by deleting the blocks, not the task"). This is a real gap: the mockup's
  progress bar has no defined source of truth yet. See §9.
- **Countdown label**: `7 hrs left` vs `5 days` — presumably hours when the
  deadline is today, days otherwise. A small pure function, not a stored
  field.
- **Deadline time**, not just deadline date — step 1 captures `11:59 PM`
  alongside `Mon 9 Sep`. `task-plan.md`'s current capture step only mentions
  a native date field.
- **Short-form task title** for the timeline's `Thesis Intro` vs the full
  `Thesis Introduction Draft` elsewhere — a generated abbreviation, not a
  second user-entered field (no field for it appears in step 1).

---

## 6. Cross-cutting concerns

**Two color systems on one app.** Today, `Activity.kind` (class / meeting /
activity / work) drives chip color everywhere (`.chip.class`, `.chip.gold`,
etc. — see `docs/design.md`). These mockups color by **course/label**
instead. Both can't drive the same element's color at once. Options: (a)
tasks/sessions color by course, while non-task activities (classes, shifts)
keep coloring by kind — the two systems just apply to different data, or (b)
`kind` is retired in favor of course-coloring everywhere. The mockups only
show task-derived content, so they don't resolve this — flagged for a
decision before implementation, not decided here.

**Two ways of marking "the AI said this."** The Voice tab just shipped
graying the AI's own text (`--ink-2`) to distinguish it from the user's words,
with no card and no icon. Step 3 of this wizard instead uses a bordered peach
card with a round "R" avatar badge. Both solve the same problem
("whose words are these") with different visual weight. Decide whether the
wizard should match Voice's minimal treatment or whether Voice should adopt
the avatar-card pattern — don't ship both conventions long-term without a
reason.

**The dashboard's invitation card naming a specific conflicting task is not a
RULE 3 violation.** `bot/src/rules.ts` RULE 3 governs what the bot tells the
**group** when declining — day-granularity only, never the specific
commitment. The dashboard card is private, shown only to the task's owner in
their own app; naming `Literature Review` there is exactly the extra detail
the owner is *supposed* to get privately, per `task-plan.md`'s existing
"Trust" section. Worth stating explicitly so nobody "fixes" this into
day-granularity by mistake, thinking it's the same rule.

**Two segmented-control visual styles for the same kind of job**: the Tasks
list uses a pill-track (`This week` gets a white pill inside a gray track);
the dashboard uses underline-tabs (`Today's Plan` gets colored text + an
underline). Same interaction, two different looks. Pick one before building
both screens, or state why they're deliberately different (e.g. "pill-track
= scope switch, underline = view switch" — a real distinction that could
justify keeping both).

---

## 7. Motion notes

Nothing in the mockups is animated (they're static), so this section proposes
motion consistent with the existing "calm, purposeful" language in
`docs/design.md` (no bouncy/squashy motion, minimal and intentional) — for
whoever builds this to have a starting point, not a mandate:

- Wizard step transitions (1→2→3): a small horizontal slide + fade, matching
  the direction of travel (forward = content enters from the right, back =
  from the left) — cheap, and it reinforces the `Step X of 3` progress
  already on screen.
- Choice-card selection (step 2): border-color and background transition
  only (`border-color`, `background` — both already animatable per existing
  `.recur-toggle`/`.neg-option` patterns), no scale/bounce.
- The "NOW" marker on the dashboard: no animation needed at rest; if the
  timeline is left open across the marker's position changing, a slow
  vertical slide (not a jump) as time passes would match the app's calm
  motion language — low priority.
- Session-card tap-to-edit (step 3): reuse whatever inline-editor
  open/close transition `task-plan.md`'s existing edit flow already has,
  don't invent a second one.

---

## 8. Open questions (resolve before building)

1. **Dashboard vs. month calendar**: does the new "Today" dashboard *replace*
   `Scheduler.tsx`'s month view, or does it sit in front of it (e.g. a toggle
   between "Today" and "Month")? The month calendar has real, shipped
   functionality (Demo/Clear, +Add, recurrence) this dashboard doesn't show
   any equivalent for.
2. **Progress %'s source of truth**: nothing today tracks partial completion
   of a task. Manual slider? Derived from sessions completed vs. total?
   Needs a decision, not just a UI.
3. **Course/label → color mapping**: fixed palette by hash, or user-chosen?
   How many hues in the palette (at least 4 are visible: red, gray, gold,
   deeper red — is gray a "no color assigned" default rather than a real
   hue)?
4. **Session card's "Edit" affordance** (step 3, session 2 only shows the
   text+icon): is this present on every card and only shown on tap/hover
   (mobile has no hover — so tap-and-hold? a swipe reveal?), or was the
   mockup just annotating the affordance on one example card for
   documentation purposes? As spec'd, don't assume every card silently shows
   it identically without deciding the trigger.
5. **`Accept this plan` missing its arrow**: every other primary CTA in the
   flow ends in `→`; this one doesn't. Intentional (final commit, not a
   "next" action) or an oversight to fix for consistency?
6. **Two segmented-control styles** (§6) — unify or keep both, and if kept,
   on what basis?
7. **Profile tab**: zero content specified in any mockup. Needs its own scope
   before it can be built — likely candidate for the existing tap-to-rename
   "Hana" name control currently living inline in `Scheduler.tsx`, plus
   whatever else a profile screen would hold (Demo/Clear? theme? account?).
8. **Dashboard's `INVITATIONS +1` `+` button**: add one manually, or jump to
   the full `Invitation` tab? Unclear from the mockup alone.
9. **Which tab is active on the dashboard screen** (screen 6): none of the 5
   tab icons show the bold/`--accent` "active" treatment screen 1 makes
   obvious for `Task`. Confirm this dashboard is reached from `Schedule`
   before wiring navigation.
10. **Deadline time field**: is a required time-of-day genuinely wanted for
    every task (adds a step for the user), or should `11:59 PM` just be a
    silent default and the time field dropped from step 1?

---

## 9. Reuse map

What already exists and can be built on directly, vs. what's net-new:

| Already exists | File | Reusable for |
|---|---|---|
| 3-step task wizard, `planSessions`, session editing, `.ics` export, share text | `ui/screens/Task.tsx`, `domain/planner.ts`, `domain/task.ts`, `domain/share-link.ts` | steps 1–3's underlying logic; the mockups are a visual layer on top of a flow that's already built and documented in `docs/features/task-plan.md` |
| Editable user name | `app/store.ts` (`name`, `setName`), inline editor in `Scheduler.tsx` | dashboard greeting's `Hana` |
| Month calendar, busy-dot-per-day, Demo/Clear | `ui/screens/Scheduler.tsx` | whatever the resolved answer to open question 1 is |
| `.neg-option` bordered choice row | `index.css`, used in `VoiceMemo.tsx` | closest starting point for the step-2 choice card, needs an icon badge + bar-preview slot added |
| `.recur-toggle`, `.kind-pill` single/multi-select chips | `index.css` | starting point for the effort chip row |
| Grayed AI text convention | `VoiceMemo.tsx`, just shipped | the "AI is talking" problem the info banner also solves — see §6 |
| Bot invite detail, day-granularity RULE 3 | `bot/src/rules.ts`, `Inbox.tsx` | dashboard's invitation preview card is a new, more compact view over the same pending-invite data `Inbox.tsx` already fetches |
| `.tabbar`, 4-tab bar | `App.tsx`, `index.css` | needs the FAB variant added, not a rewrite |
