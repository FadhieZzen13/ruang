# RUANG — Group Chat Demo Script

Scenario: decline + counter-time (the wow). English.

Cast:
- Hana — the user (RUANG's owner)
- Aiman — groupmate, asks for the meeting
- Sarah — groupmate
- Ruang — the bot (silent listener until the verdict)

---

## Beat 1 — The ask arrives in the group

```
Group: COM203 Group Project
Members: Aiman, Sarah, Hana, + Ruang

Aiman   [7:41 PM]
yo can we meet thursday 8pm to finish the slides

Sarah   [7:43 PM]
can do
```

*(Ruang has been silent the whole time. It detected "meet" + "thursday 8pm" + "finish the slides" and pulled it into the app.)*

---

## Beat 2 — The listener surfaces it in Hana's app

Hana's phone pings. She opens RUANG.

```
┌─────────────────────────────┐
│  From COM203 Group Project  │
│                             │
│  Aiman: "meet thursday      │
│  8pm to finish the slides"  │
│                             │
│  Thursday 8pm — you've got  │
│  something that evening.    │
│                             │
│  [ Friday 7pm ]  [ Thursday │
│                    anyway ] │
└─────────────────────────────┘
```

*(Hana taps "Friday 7pm". The bot drafts the verdict. Nothing posts yet.)*

---

## Beat 3 — The verdict posts (with Hana's tap)

```
Group: COM203 Group Project

Ruang   [7:45 PM]
Hana's not free Thursday evening — Friday 7pm works though.

Aiman   [7:46 PM]
friday works
```

---

## Beat 4 — Cut to Hana's phone

```
┌─────────────────────────────┐
│  COM203 Group Project       │
│                             │
│  Meeting moved to Friday    │
│  7pm. Aiman agreed.         │
│                             │
│  Your Thursday evening is   │
│  still clear.               │
└─────────────────────────────┘
```

She never opened the chat. She never had to say no. There was nothing to remember.

---

## Notes for the demo

- **Ruang is silent until Beat 3.** The listener never speaks in the group except the verdict, and only after Hana's tap. That's the trust model, shown not told.
- **The verdict is day-granularity.** "not free Thursday evening," not "has class 8–10pm." The group sees the outcome, not Hana's other commitments.
- **Aiman's typo is intentional** ("thursday" lowercase, "yo"). Real chat. The bot parsed it fine — that's the quiet flex.
- **The counter-offer comes from the bot's free/busy check**, not Hana's reasoning. Hana taps one button; the bot already knows Friday is free.

## Optional: fold the chaos feature into the same run

If you want to demo chaos without a fifth stop, prep Hana's week so that *Thursday evening* is itself a casualty of the chaos feature — the bot moved her earlier work off Thursday, which is exactly why Friday is the clean alternative. Then Beat 2's "you've got something that evening" is the chaos feature's handiwork, not just a random conflict. One product, one story.
