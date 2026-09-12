RUANG — corrected summary (post-grill)

1. The product, in one sentence

An app that takes the work off your plate — it listens to your voice and your group chats, and instead of showing you the pile, it clears it.

(Say "app," not "agent." "Agent" reads as an AI buzzword and it's the trust-scare you're defusing. The wow is what it *does*, not what it *is*.)

2. The user

2nd and 3rd-year students who are active in an organisation and/or working part-time.

The defining trait, and the line to say on stage:

"Their week is built by three or four other people — a lecturer, a club, a manager, a groupmate — and none of them can see the others. So every request looks reasonable on its own, and the pile is invisible to everyone, including the student."

3. The problem — with your actual evidence

Finding / Who / Count

Don't know where to start — NH, AR, KJ, AA, TA, you — 6 of 7
Forgetting, things sinking — AR, F, TA, KJ — 4 of 7
Work arriving suddenly, mid-chaos — AR, KJ, AA — 3 of 7
The group causes the stress — TA — 1 of 7

The bridge quote — AA, unprompted:

"the stress happens normally due to multiple work coming in at the same time and you have no idea where to start."

Everyone quotes the second half. The first half is the cause.

"I don't know where to start" is the symptom. Uncontrolled arrival is the cause. They don't lack an ordering — they lack one that survives the next thing landing.

4. The core — what the app actually is

An agentic scheduler. You see your class schedule, meetings, and activities. The AI transcribes your voice, moves things, and makes new entries — but only ever with your confirmation ("it proposes, you decide; nothing moves on its own").

Four features, one arc:

1. Scheduler — the base. Your week, class + meetings + activities.
2. Voice / agentic — record a memo, the AI transcribes and acts (move / create), you confirm.
3. Chaos feature — when your week is cramped, the agent looks at the pile and *suggests decisions* ("drop this tonight, because X") and reflects them into the calendar. It doesn't show the pile; it rebalances it.
4. WhatsApp listener — the wow.

The one thing tying them together: the chaos feature and the WhatsApp listener are the *same wow from two sides*. Both are "the agent notices the pile and acts on it before you have to." One does it against your calendar; the other against incoming group messages. The question the whole product answers is "does it reduce the pile, or just display it?" — and the answer is it reduces it.

5. The wow factor — the WhatsApp listener

WHAT

A WhatsApp listener added to the group chats you choose. It silently watches for activity-type words (meeting, meet-up, sports, "gotcha", "kopo", etc.), reads the date and the description, and surfaces a brief summary to you privately in the app. You negotiate in the app — accept, decline, or counter with a new time. The verdict posts back to the group, only with your tap.

WHY it's the wow

Ask of every feature: could the student do this themselves given time and energy?

Track tasks — yes. Plan a schedule — yes. Notice they're behind — yes.
Say no gracefully, proactively, without anyone having to watch — no.

Competitors (Siri, Google Calendar, TickTick, Notion, Rencana) are passive — they wait to be asked, and when asked they're "biased to what we want and just say ok." This one notices first.

That's the monopoly, and monopolies dominate.

6. How it works (the trust model)

- Platform: WhatsApp via Baileys (open-source WhatsApp Web client). Runs as a session on your own number — no Business API approval, no verified number. This is the POC path.
- The one-line answer if asked: "It's a proof of concept on WhatsApp's own Web protocol; the production path is the official Cloud API."
- The listener only watches the group chats you choose. It never reads anything else.
- The bot never posts to the group without your tap. Ever.
- When there's a conflict, the reason is given at day granularity only ("unavailable Thursday evening"), never the exact time — the group sees the verdict, not your other commitments.
- The notification always fires, even when you're free — a silence would become a signal, and the bot would start making silent commitments on your behalf. You stay the sole decision-maker every time.

7. The flow

Something arrives in the group → the listener detects it → a private notification surfaces in the app → you decide (accept / decline / counter) → the verdict posts to the group with your tap → cut to your phone, already handled.

Two shapes of the same app screen, keyed off free/busy:

- Free: "Thursday 8pm? You're clear. [Yes] [Maybe] [No]"
- Busy: "Thursday 8pm — you've got something that evening. [Friday 7pm] [Override anyway]"

8. The demo — 3 minutes, four beats

1. Open the scheduler — show the week.
2. Voice memo → transcribe → it creates a new activity. (Fold the chaos feature in here: "you're cramped Tuesday, I'll move this to Thursday — ok?" So it's not a fifth stop.)
3. WhatsApp group message arrives → the listener surfaces it in the app.
4. You decline / propose Friday (or accept) → confirm in the group.

9. The pitch — Hong Bing's four parts

① The specific problem
"Students don't fail because they're disorganised. They fail because four different people fill their week and none of those people can see each other."

② The specific user
"2nd and 3rd-year students holding a committee position while working part-time."

③ Existing solutions and their shortcomings — with numbers
"Motion and Reclaim do capacity scheduling — at $29 to $49 a month, for knowledge workers whose work already lives in a calendar. TickTick's own API has no workload awareness and no webhooks, so it can't notice anything on its own. Gemini in Google Calendar has no conflict detection and no priority awareness. And even the best productivity apps hold only 12–18% of users at day 30, against a 4% industry average. Two of the five students we interviewed have never opened a productivity app in their life. The tools exist. Nobody uses them."

④ The impact
"We don't show you your workload. We clear it. Every group chat the listener enters exposes four more students to it without any of them installing anything."

10. Lines to have ready

The thesis — "An empty calendar slot is not free time."
On forgetting — "The opposite of forgetting isn't remembering. It's not needing to."
On fatigue — "Every scheduler finds an empty slot. We ask whether you'll have anything left by the time you get there."
Against Siri/Gemini — "They read your calendar. Most student work isn't on the calendar."
Scalability — "Every group chat it enters exposes four more students, with nothing to install."
Trust — "It proposes. You decide. Nothing moves on its own."

11. Open risks — know them, name them on stage

Risk / Answer
Group evidence is 1-of-7 — send the 10-min validation to TA + a committee friend. Turn it into 3-of-9.
Bot tone could read as rude — every no ships with a counter-offer.
Effort estimate is a guess — calibrated from the student's own history; shown as "based on your estimate."
Unlogged work is invisible — always answer as "based on what I know about your week."
Needs the group to adopt it — works single-player from day one; gets better with the group.
Baileys is against WhatsApp ToS — it's a POC on the Web protocol; production is the official Cloud API.

12. What's left to do

Day / Work
Today — group chat script (word for word), five demo screens, the 10-minute validation message.
Next — deck: 4-part pitch + the cut slide + the competitor row.
Last — video only. Stop designing.

The one thing to hold onto

Be conventional about the problem. Be radical about the mechanism.

Your problem is the most evidenced one you have — six of seven, in their own words. Your mechanism is something nobody in that room will have built. That combination is what scores on Impact and Originality.
