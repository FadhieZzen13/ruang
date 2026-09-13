# RUANG by GitingITDone

**Team:** Fio Rafi, Zen
**Problem Statement:** Stress & Workload Manager
**Video Presentation:** [\[YOUTUBE LINK\]](https://youtu.be/KaeVdYeu7-o)
**Presentation Slides:** [\[Canva Link\]](https://canva.link/d162j6j6gsx02f0)
**Repository:** [\[Github Repo Link\]](https://github.com/FadhieZzen13/ruang)

---

## 1. Project Overview

### The Problem

University students who are active in an organisation or working part-time do not burn out from one big thing. They burn out because four different people fill their week — a lecturer, a club committee, a part-time manager, and a groupmate — **and none of those people can see the others.**

So every request looks reasonable on its own. The student says yes. Nobody, including the student, can see the pile forming.

**The causes, as we understand them:**

1. **Work arrives from outside, not from the student.** Almost nothing in their week is self-assigned. It is handed to them by people they find hard to refuse.
2. **Each new arrival breaks whatever plan existed.** We interviewed seven students. Six said the same thing in their own words: _"I don't know where to start."_ When we asked why, the answer was always the same — something new had just landed.
3. **Requests arrive in group chats that get buried.** Students forget to open the group, or the message drowns in the volume, and they only find out when it is too late.
4. **Saying no is socially expensive.** It is not a time-management problem. It is a social one. So students keep saying yes.

**Stakeholders:**

- **Primary:** 2nd and 3rd-year university students who hold a committee position and/or work part-time
- **Secondary:** their groupmates, club committees, part-time managers and lecturers — all of whom currently make requests blind
- **Tertiary:** university counselling and wellbeing services, who see students only after the damage is done

### Similar apps, and why they fall short

| App                                  | What it does                                                         | Why it falls short for our user                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TickTick** (with AI voice and MCP) | Captures tasks by voice, answers questions about your list           | Its own API has **no workload or capacity awareness** and no webhooks, so it can never notice anything on its own. It only answers when asked.                             |
| **Notion**                           | A flexible workspace you build yourself                              | It has no built-in idea of capacity. You have to design the system first — and for students, building the Notion setup often becomes the procrastination.                  |
| **Motion / Reclaim.ai**              | Auto-schedules tasks into your calendar using duration and deadlines | **$29–$49 a month**, a steep setup, and built for office workers whose work already sits in a calendar. Users also complain about it reshuffling their day without asking. |
| **Google Calendar / Siri / Gemini**  | Shows events, creates events, moves events                           | They know when you are free. They do not know how much work you have. **Most student work is not on the calendar** — assignments exist as deadlines, not as blocks.        |

**The gap all of them share:** they are single-player and passive. Not one of them is present in the group chat where the work is actually handed to you, and not one of them notices anything until you open it and ask.

And these tools already exist and are mostly free. Two of the five students we asked have **never opened a productivity app in their life.** One had never even tried Google Calendar. The tools are not the problem. Nobody uses them.

### Our Solution

Ruang is a student scheduler with a listener in the group chats you already use. It watches the groups **you choose** for an incoming invite, checks it against your real week, and surfaces it to you privately in the app with an answer already prepared — the reason, and a counter-offer that works.

**Nothing is ever posted to the group until you tap.** That is the rule the whole product is built on: _it proposes, you decide, nothing moves on its own._ The bot is silent in the group until your approval; when the verdict goes out, it carries a day-granularity reason only (_"unavailable Thursday evening"_), never your exact commitments.

**What is built and demoable today:**

| Feature                                | What it does                                                                                                                                                                                                                                  | State           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **WhatsApp listener** _(main feature)_ | A real Baileys bot on your own number. Watches only the groups you list, detects an activity invite (day, time, title), checks free/busy, and surfaces it privately with a counter-offer ready. Posts the verdict only on your tap.           | **Built, live** |
| **Invitation tab**                     | The approval surface in the app. Polls the bot for pending invites, shows who asked and what clashes, and sends accept / decline / counter back through the gate.                                                                             | **Built**       |
| **Today dashboard**                    | _"Today, you will have 12 hrs work and 8 hrs free"_, a week strip of busy dots, the day's agenda with free gaps, a live NOW marker, and inline invitation previews. Computed from the real week, not mocked.                                  | **Built**       |
| **Schedule (month)**                   | Month grid, recurrence, add/edit, demo/clear — one tap from the dashboard.                                                                                                                                                                    | **Built**       |
| **Task → build a plan**                | Name the work and the deadline, pick a pace, and the planner places real sittings in the gaps you actually have — never double-booking itself, and saying so honestly when only part of it fits before the deadline.                          | **Built**       |
| **Plan sharing + calendar export**     | One `.ics` carrying every sitting (imports into Google/Apple/Outlook in one tap), a Google Calendar link per sitting, and a share link that opens the whole plan for someone who does not use Ruang.                                          | **Built**       |
| **Plan from the chat**                 | Say _"ruang, plan the group report due monday"_ in your own chat and the bot builds the schedule, asks at most one question if the deadline is missing, and posts it to the group only when you say `share`.                                  | **Built**       |
| **Ask (voice)**                        | Record a memo → browser speech-to-text → an LLM turns it into a proposed entry. If the slot is cramped it folds in the rebalance (_"that slot's packed — move it to Thursday?"_). Falls back to an offline parser with no key and no network. | **Built**       |

---

## 2. Ideation & Process

### 2.1 Ideas We Considered

| Idea                                                                             | Why it was dropped / kept                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Group-chat listener that prepares your answer (CHOSEN — main feature)**     | **Kept.** It is the only thing on this list a student genuinely cannot do themselves. They can track, plan and prioritise on their own. They cannot notice a message they have not opened, and they cannot say no gracefully, instantly, with an alternative attached. It is proactive — it acts before the student opens their phone.                                  |
| **B. Free/busy + planning engine (CHOSEN — the engine underneath)**              | **Kept.** Without it the listener has nothing to say. It is also the only piece of data no other app has: how much work is actually left, in real gaps. It is never shown as a dashboard for its own sake.                                                                                                                                                              |
| **C. Automatic deadline import from Moodle + Google Calendar**                   | **Dropped from the build, kept in the roadmap.** Two interviewees said typing tasks in was why they stopped using apps, so capture matters. But import depends on each university leaving the calendar export enabled, and it is not the mechanism being judged. We shipped the outbound half instead — one `.ics` that puts a whole plan into any calendar in one tap. |
| **D. Voice entry (CHOSEN, and now built)**                                       | **Kept as a second entry point, not a second feature.** It is the same engine and the same propose-then-confirm path, just a different door. It is built and works offline without a key.                                                                                                                                                                               |
| **E. Auto-schedule the whole week for you**                                      | **Dropped.** This is exactly what Motion and Reclaim already do at $29–49/month, and their most common complaint is the app reshuffling your day without asking. It also breaks our own rule: we propose, the student decides.                                                                                                                                          |
| **F. Session planner — break a task into work sessions**                         | **Kept, and it shipped.** It closes the loop between a deadline and actual hours. The end-of-session check-in ("what did you finish?") is still roadmap.                                                                                                                                                                                                                |
| **G. Workload visualiser with a "you're at 90% capacity" gauge**                 | **Dropped.** A percentage needs a denominator and nobody has a real one. It is also pure "track and report", which the problem statement explicitly warns against. We replaced it with a plain sentence: _"12 hrs work, 8 hrs free."_                                                                                                                                   |
| **H. Daily stress / mood tracker**                                               | **Dropped.** It adds a daily task to someone who is already failing because of tasks, and self-reporting is unreliable under stress. We read the load from real data instead.                                                                                                                                                                                           |
| **I. Habit tracker with streaks and XP**                                         | **Dropped.** Streak psychology is all-or-nothing: miss once, feel guilty, uninstall. For a burnout app that is the wrong mechanism.                                                                                                                                                                                                                                     |
| **J. Built-in Pomodoro timer**                                                   | **Dropped.** A 2025 study with 94 university students found Pomodoro did **not** beat self-chosen breaks, and actually produced faster fatigue and faster loss of motivation. We did not want to ship something the evidence does not support.                                                                                                                          |
| **K. AI assignment brainstorming — explain the purpose, give tips and steps**    | **Dropped as a feature, survives as one line.** Three interviewees asked for it, but it is what students already use ChatGPT for, free. All that remains is a short per-session note saying what that sitting is for — and the plan never waits on the model to produce it.                                                                                             |
| **L. Assignment "shelf" — one place for all the scattered task links**           | **Kept in the roadmap.** One interviewee said this was "significant banget", so we know it matters. It is supporting furniture, not the headline.                                                                                                                                                                                                                       |
| **M. Semester trend view — load over weeks, and when you last actually rested**  | **Partly shipped.** The `WEEK 4 OF 14` term line and the week strip of busy dots are the first sliver of it. The full trend view is roadmap.                                                                                                                                                                                                                            |
| **N. Message drafter — write the awkward message to your lecturer or groupmate** | **Evolved.** This became the listener. Instead of writing a message for the student to send, the bot prepares the verdict and posts it on their tap.                                                                                                                                                                                                                    |
| **O. Using GPA / CGPA as a capacity measure**                                    | **Dropped.** GPA measures past results, not current room. A student with a high GPA might be there _because_ they are burning out. It also needed a special case for first-years, which told us the input was wrong.                                                                                                                                                    |
| **P. Money and expense tracking**                                                | **Dropped.** One interviewee suggested it, but it belongs to a different problem statement.                                                                                                                                                                                                                                                                             |
| **Q. Travel and holiday planning as an extra function**                          | **Dropped.** Same reason. Adding it would make judges ask which problem statement we were answering.                                                                                                                                                                                                                                                                    |
| **R. ASMR, white noise, fidget toys, cozy-game elements**                        | **Dropped.** The most-built and least-differentiated features in this category. One interviewee also told us plainly that his emotional support comes from talking to family — a person, not an app.                                                                                                                                                                    |
| **S. The Travel Planner problem statement**                                      | **Dropped at the start.** It needs booking APIs, group preference syncing, budgeting and live pricing — four products. There are already more than ten funded AI trip planners. We also asked five students which of the two apps they would want, and every single one chose the workload app. One said: _"travel is still out of budget."_                            |

### 2.2 How We Got Here

**First, we picked our mentors.** We looked at the rubric and saw where the marks actually are in phase one: ideation, impact, presentation and design. Not code. So we listed all 18 mentors and matched them against those four things, and picked the ones who could really help us — people who would criticise the idea, give honest feedback, and push it further, not just tell us it was nice.

**Then we argued about the problem statement.** My friend wanted the travel planner because it is easier to build. I wanted the stress and workload manager because it has more impact — students would use it every day or every week, not once a year.

So instead of arguing, we went and asked. I interviewed my friends about stress: what makes it bad, and what kind of features they would want. At the end of each interview I asked which app they would rather have. **6 out of 7 choose the stress and workload manager.** One even said travel is still out of budget for a student. That settled it.

**What the interviews told us:**

| Finding                           | Who                    | Count  |
| --------------------------------- | ---------------------- | ------ |
| Don't know where to start         | NH, AR, KJ, AA, TA, me | 6 of 7 |
| Forgetting, things sinking        | AR, F, TA, KJ          | 4 of 7 |
| Work arriving suddenly, mid-chaos | AR, KJ, AA             | 3 of 7 |
| The group causes the stress       | TA                     | 1 of 7 |

The top row looked like the problem at first. But one student said something that changed how we read the whole table: _"the stress happens normally due to multiple work coming in at the same time and you have no idea where to start."_ Everyone quotes the second half. The first half is the cause. **"I don't know where to start" is the symptom. Work arriving suddenly is the cause.** They do not lack a plan — they lack one that survives the next thing landing.

**Then we brought our ideas to the mentors.** Each of us had our own version, so we took them to be torn apart. Qing Fung told us to keep it to one or two features and make onboarding almost nothing. Chiau Wen asked where our numbers actually come from, and whether the AI was doing real work or just decoration. Hong Bing told us to cut to **one** main feature, and said the group-chat part was the most interesting thing we had.

**Then we cut.** We had more than a dozen ideas on the table. We tested each one against four questions: can it be shown in 15 seconds, is it unexpected, does it need explaining, and could an existing app already do it? Most of them died on the last question. The group-chat listener was the only one that passed all four — and it was also the only thing on the list a student cannot just do themselves with more effort.

**Then we built it.** One app, one bot, one loop that works end to end.

![mentor mapping 1](images/mentor%20mapping%201.png)

_The 18 mentors mapped against the rubric, so we could pick the ones who would actually push the idea._

![finalized mentor](images/finalized%20mentor.png)

_These are the finalized mentor for our choice but we remove some due we already have answer and want to focus on the prototype instead_

![Interview map](images/interview%20map.png)
_The seven interviews, grouped. These are some of the screenshoots on the above._

_The final flow. An invite arrives in a watched group → the listener spots it → it shows up privately in the app with an answer ready → you accept, decline or counter → only then does the group see anything._

### 2.3 Mentor Consultation

| Date  | Mentor              | Feedback Received                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | What Was Changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 Sep | **Mah Qing Fung**   | Build the UI first with mock data — no backend needed. Aim for 1–2 core features only. You need a wow factor or a very complete product. Verify whether WhatsApp can give conversation context; Telegram is safer. You cannot auto-pull student Gmail. Voice input is more feasible than a chatbot and is a bonus point. Onboarding must be minimal.                                                                                                                                                                                                    | We stopped designing around Gmail access entirely. We cut onboarding down to a name and a week. We dropped the chatbot idea and made voice a single entry point instead — it is built, and it degrades to an offline parser with no key. On the platform question we went and checked it ourselves: **WhatsApp does give group context via the Web protocol (Baileys)**, so we stayed on WhatsApp, which is where our users actually are, and we name the ToS trade-off out loud rather than hiding it.                                     |
| 4 Sep | **Yeong Chiau Wen** | Pressed us on where the capacity number comes from and whether our AI is doing real work or is decoration. As a former lecturer, she also graded us against the rubric.                                                                                                                                                                                                                                                                                                                                                                                 | We dropped the universal "capacity score" and replaced it with numbers computed from the student's own real week — _"12 hrs work, 8 hrs free"_ — and with a planner that places sittings in actual gaps. We also drew a hard line on where the model is allowed to act: **the LLM only does language understanding** (reading a message, naming what a sitting is for). Every scheduling decision — conflict detection, free-slot search, counter-offers — is deterministic code with unit tests, and the plan is never gated on the model. |
| 7 Sep | **Sim Hong Bing**   | Cut to ONE main feature — three features in a two-minute demo is thirty seconds each, and a judge will think "just another one, next". The auto-negotiation in the group chat is the most interesting thing you have; make it the key feature. Be proactive, not passive. The pitch must have four parts: specific problem, specific user, existing solutions with real numbers, and impact. "Too practical means an average score" — you have to go all in. Build like a painted lamp: only the front needs to work. Always follow the judging rubric. | **This caused our biggest change.** We rebuilt the demo around the listener and made everything else the supporting week it answers from. We dropped the end-of-session check-in loop and the full semester trend view. We rewrote the pitch into his four-part structure and went and found real numbers for the competitor section. We took the painted-lamp advice for the _surface_ only — the listener itself is not painted. It is a real bot on a real number in a real group.                                                       |

**One piece of feedback we thought hard about before following:**

After Hong Bing's session we almost pivoted the whole product to the group listener on the strength of his enthusiasm. But when we checked it against our own interviews, only **one** of seven students had described a group-caused problem, while **six** had described a solo one. We nearly built something our users had not asked for.

We resolved it by re-reading the interviews more carefully. One student, said: _"the stress happens normally due to multiple work coming in at the same time and you have no idea where to start."_ Everyone quotes the second half of that sentence. The first half is the cause. **"I don't know where to start" is the symptom; uncontrolled arrival is the cause.** That is what earned the listener, rather than us just liking the idea — and it is also why the app works single-player from day one, for the six who described the solo problem.

We also did not follow Hong Bing's "painted lamp" advice all the way down, and that was deliberate. The one thing a judge will not believe unless it is real is a bot answering in a live group chat — so that is the part we refused to fake.

---

## 3. Design & Prototype

**UI Prototype:** [\[Figma Prototype Link\]](https://www.figma.com/design/wPmnygpfgsi9fYFrVTo2AJ/Untitled?node-id=0-1&t=qW9bllDlTdOR9qh9-1)
**Live app:** [\[VERCEL LINK\]](https://ruang-beta.vercel.app/)

---

## 4. What Makes It Different

**1. It notices first.**
Every other app in this space waits to be asked. Ruang is watching the place the work actually arrives, and it has your answer ready before you have read the message.

**2. It never posts without your tap.**
This is the line that separates a useful bot from a terrifying one. Exactly two code paths can post to a group, both behind an explicit approval, and both refuse any group outside the list you chose. The notification fires even when you are free — because a silence would become a signal, and then the bot would be making commitments for you.

**3. It never gives a bare "no".**
Every decline ships with a counter-offer that already works. This is what stops it being rude, and it is why the group is glad the bot is there.

**4. It protects your privacy inside the group.**
The reason it gives is day-granularity only — _"unavailable Thursday evening"_ — never the exact time, never what the other commitment is. The group sees the verdict, not your life.

**5. It knows an empty slot is not free time.**
Siri, Gemini and Google Calendar read your calendar. But most student work is not on the calendar — assignments live as deadlines, not as blocks. Ruang turns a deadline into real hours in real gaps, so "free" means free.

**6. It solves forgetting by removing the thing to remember.**
Not by reminding harder. The invite is answered, the plan is in the calendar, the group has the `.ics`. There is nothing left to hold in your head.

**7. It spreads without being installed.**
One student runs the bot in a group. Four groupmates get the answer, and the shared plan link opens for people who do not use Ruang at all.

### Comparison

|                                                  | TickTick        | Notion         | Motion / Reclaim | Google Calendar    | **Ruang**        |
| ------------------------------------------------ | --------------- | -------------- | ---------------- | ------------------ | ---------------- |
| Knows how much work is left                      | ✗               | You build it   | ✓                | ✗                  | ✓                |
| Notices things on its own                        | ✗ (no webhooks) | ✗              | ✓                | Reminders only     | ✓                |
| Present where you are asked                      | ✗               | ✗              | ✗                | ✗                  | **✓**            |
| Prepares your answer before you read it          | ✗               | ✗              | ✗                | ✗                  | **✓**            |
| Answers the group on your behalf, on your tap    | ✗               | ✗              | ✗                | ✗                  | **✓**            |
| Shares a whole plan with people who don't use it | ✗               | Link to a page | ✗                | One event per link | **✓ (one .ics)** |
| Cost to a student                                | Freemium        | Freemium       | $29–49/mo        | Free               | Freeium          |

---

## 5. Technical Architecture & Feasibility

### Shape

Two halves, deliberately separate:

```
ruang/   the app      — React + TypeScript + Vite PWA, phone-framed
bot/     the listener — Node + TypeScript, Baileys WhatsApp socket + a small HTTP API
```

The app talks to the bot over a handful of routes (`/pending`, `/decide`, `/schedule`, `/say`, `/plan`). Everything that can post to a group lives on the bot side, behind one gate.

### Tech stack

| Layer                      | Choice                                                                                                          | Why                                                                                                                                                                                                            | Constraint we name                                                                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chat listener**          | **Baileys** (WhatsApp Web protocol), Node + TypeScript                                                          | WhatsApp is where our users are. Baileys runs as a linked device on your own number — no Business API approval, no verified number, no cost.                                                                   | It is a POC on the Web protocol and against WhatsApp's ToS at scale; the production path is the official Cloud API. We say this on stage rather than being caught by it.                                                                                      |
| **Frontend**               | **React 19 + Vite**, PWA, mobile-first                                                                          | Fast to build and iterate, installable, works on every phone with no app-store approval, and screen-mirrors cleanly for the demo.                                                                              | A web app cannot give a true iOS lock-screen widget. We show that as a concept, not a claim.                                                                                                                                                                  |
| **App architecture**       | `domain/` (pure logic, no React) → `app/` (state, effects) → `ui/`                                              | The scheduling core is unit-tested without a browser (`planner`, `occurrence`, `ics`, `share-link`, `plan-parse` all have tests). It also keeps the model out of the maths.                                    | —                                                                                                                                                                                                                                                             |
| **State**                  | `useSyncExternalStore` + `localStorage`                                                                         | Single-user demo. No auth, no database, no sync to get wrong.                                                                                                                                                  | Single-device. A real product needs accounts and a server; that is a known next step, not a hidden one.                                                                                                                                                       |
| **Language understanding** | **DeepSeek** primary, an OpenAI-compatible gateway as fallback, both proxied server-side by the Vite dev server | Used narrowly: reading a chat message or a memo, and naming what a sitting is for. Keys are injected by the proxy and never ship to the browser.                                                               | The proxy only runs in dev; a static production build needs a small serverless route before the voice path works publicly. **If the model is missing or fails, everything still works** — an offline heuristic parser takes over and the card says "offline". |
| **Scheduling logic**       | Plain deterministic TypeScript                                                                                  | Conflict detection, free-slot search, counter-offers and session placement are arithmetic and rules, not a model. This is what Chiau Wen pushed us on.                                                         | The effort estimate is still a human guess — see limitations.                                                                                                                                                                                                 |
| **Calendar export**        | Hand-written `.ics` + per-session Google Calendar links                                                         | A Google Calendar URL can carry exactly one event. An `.ics` hands a phone a whole plan in one tap, and Google, Apple and Outlook all import it.                                                               | Times are written "floating" (no timezone), which is right for a study plan and sidesteps shipping a VTIMEZONE block.                                                                                                                                         |
| **Plan sharing**           | The plan encoded into the URL fragment (`#/p/<payload>`)                                                        | A fragment never reaches a server, so a shared schedule is not stored or logged anywhere. No backend row to keep.                                                                                              | Long URLs. Swapping to short ids is a change behind two functions, not a rewrite.                                                                                                                                                                             |
| **Hosting**                | **Vercel** (app) + **Docker on a self-hosted box** (bot)                                                        | Free, fast deploys for the static app. The bot holds a live WhatsApp socket, so it needs a process that stays awake — `restart: unless-stopped`, with the session bind-mounted so rebuilds do not log you out. | Two hosts to keep alive. The bot's API is behind a bearer token; the only public route is the `.ics` share link, on purpose.                                                                                                                                  |

### What is actually built

1. A **real WhatsApp bot** linked by QR or pairing code, watching only the groups listed in `WATCHED_GROUPS`.
2. **Invite detection** — day, time and title out of a free-text message, multilingual, and discriminating an invite from a statement or a question.
3. **Free/busy + counter-offer** against the week the app pushes to it.
4. **The approval gate** — two senders, both gated, both refusing unwatched groups, with a written regression test for the rule.
5. **The app**: Today dashboard, month calendar, task planner with real gap placement, `.ics` export, share links, voice entry, and the Invitation tab that drives the gate.
6. **Plan-from-chat** — your own message in your own chat builds a plan; the group only ever sees it when you `share`.

### What we deliberately did not build

- Moodle / Google Calendar **import** (we ship export instead)
- Accounts, a database, multi-device sync
- A native app or a real lock-screen widget
- The end-of-session check-in loop and the full semester trend view
- The official WhatsApp Cloud API path
- Multi-user capacity — in the demo one member has a full profile; the others are simplified

We would rather ship one loop that genuinely works end to end than five that only work in a screenshot.

### Known limitations

We would rather name these than have them found:

1. **Baileys is a POC path.** It is the WhatsApp Web protocol, not the official API. It works, it is real, and it is not what a production launch would use.
2. **The effort estimate is a guess.** The student taps "1–2 hrs / half a day / full day / 2+ days". We show our working — _"based on your estimate"_ — rather than pretending to be certain.
3. **Work we do not know about is invisible.** The bot always answers from what it can see, and says so.
4. **The bot's free/busy has no dates yet.** An accepted session reads as busy on every matching weekday. That over-blocks rather than under-blocks — it fails safe, and we chose that direction on purpose.
5. **Single device.** State lives in `localStorage`; there is no account and no sync.
6. **The voice path needs a backend in production.** In dev the Vite proxy hides the key; a static build has nowhere to put it. The offline parser means the feature never hard-fails.
7. **Our group-level evidence is thinner than our solo evidence.** Six of seven interviewees described a solo problem; one described the group directly. We built at the group because that is where the work _enters_ — and the app still works alone on day one, which is what the other six needed.

---

## 6. How to Use the Prototype

**Open it:** [\[VERCEL LINK\]](https://ruang-beta.vercel.app/)
**Enter the Group chat to TEST the bot** [\[Whatsapp Group Link\]](https://chat.whatsapp.com/Fg48tq0fCA90ljVuOrvl06)

you can also chat in the group if the bot is not working properly

This prototype proves that our idea is viable/feasible to implement

Nothing to install. It is a web app — open the link on a phone or in **Chrome / Edge** on a laptop (the voice tab uses the browser's built-in speech recognition). It renders as a phone frame, so it looks the same either way.

The WhatsApp bot is already running on our side, linked to our number and watching our demo group. You do not set it up; you see it answer.

### 6.1 The five tabs

| Tab                         | What it does                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Schedule**                | Opens on the **Today** dashboard — hours of work vs. free today, a week strip of busy dots, the day's agenda with the free gaps left in, and a live NOW marker. The **Month** toggle at the top gives the calendar: add, edit, recurrence, and Demo/Clear to seed a week       |
| **Task**                    | Your open tasks, then **build a plan**: name and deadline → pace (_finish it quickly_ / _take my time_) and effort → the proposed sittings. Nothing lands until **Accept this plan**. Then save all of them as one calendar file, share the plan link, or send it to the group |
| **Ask** (the centre button) | Hold and speak — _"badminton thursday 8pm"_. It proposes one entry; if the slot is busy it offers to move it. Nothing is written until you confirm. A "…or type a memo" box is there if the mic is unavailable                                                                 |
| **Invitation**              | What the bot is holding for you: who asked, what it clashes with, and the counter-offer it has ready. Accept, decline, or counter — this tap is the only thing that lets it post                                                                                               |
| **Profile**                 | Your name and the demo controls                                                                                                                                                                                                                                                |

### 6.2 Try it

1. **Ask** — speak _"study group thursday 8pm"_. It proposes; if Thursday is packed it offers Friday instead. Confirm, and it appears in the week.
2. **Task** — add something with a deadline, pick a pace, and watch it place real sittings in the gaps you actually have. Accept it, then save the whole plan to your own calendar in one tap.
3. **Invitation** — the live one from the group (see below).

Everything persists in the browser, so your week is still there when you come back. **Profile → Clear** resets it.

### 6.3 The bot, and how it is called

You never call the bot in a group. **It is already listening.** Someone just talks normally:

```
yo meet thursday 8pm to finish the slides?
```

Ruang says **nothing** in the group. It reads the day, time and title, checks the week, picks an alternative if there is a clash, and surfaces it privately in the **Invitation** tab. The notification always fires — even when you are free — so silence never becomes a silent yes.

Then you tap. Accept, decline, or counter. **That tap is the only thing that ever posts to the group**, and what goes out is the verdict with a day-granularity reason — _"unavailable Thursday evening"_ — plus a time that works. The group never sees what you were actually doing.

The one time you do address it by name is in your own chat, to plan:

```
ruang, plan the group report due monday
```

It builds the schedule and shows it to you first. The group gets it only when you say `share`.

### 6.4 What runs where

| Half        | Where                            | Why                                                                                                               |
| ----------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **The app** | Vercel — the link above          | Static, installable, nothing to set up                                                                            |
| **The bot** | Our own always-on box, in Docker | It holds a live WhatsApp socket on a real number, so it needs a process that stays awake. It cannot run on Vercel |

So the app is public and the bot is ours. If the bot is stopped, the Invitation tab says so and everything else — schedule, tasks, planning, voice, calendar export — keeps working.

### 6.5 If something looks off

| Symptom                            | What it is                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| The mic does nothing               | Not Chrome or Edge, or permission denied. Use the "…or type a memo" box — same path         |
| A card says "offline"              | The model could not be reached. The offline parser took over; only the wording is different |
| Invitation says the bot is offline | Our bot is not running at that moment. Nothing else is affected                             |
| The group message got no reply     | That is correct. It never posts without your tap                                            |
