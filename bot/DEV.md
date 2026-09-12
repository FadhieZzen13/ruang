# Running the bot locally (for developers)

This is the no-guessing guide to running the WhatsApp bot on **your own number**
for testing. You don't need anyone else's credentials — you link your own
WhatsApp, and nothing you do here touches anyone else's session.

Everything private (`auth/` session, `.env`) is already git-ignored, so you can't
accidentally commit your own WhatsApp session or leak it to `main`.

---

## 0. What you need

- **Node.js 22 or newer** — check with `node --version`. Install from
  https://nodejs.org if it's older.
- **Your own phone with WhatsApp** (any kind — normal or Business).
- A **test group chat** you're in (or you'll test solo — see step 4).

---

## 1. Clone and install

```bash
git clone https://github.com/FadhieZzen13/ruang.git
cd ruang/bot
npm install
```

---

## 2. Create your config

```bash
cp .env.example .env
```

You can leave `.env` exactly as-is for a first run (QR login, no number needed).
Later you'll edit `WATCHED_GROUPS`.

---

## 3. Link YOUR WhatsApp

Start the bot:

```bash
npm start
```

A **QR code** prints in the terminal. On your phone:

> **WhatsApp → Settings → Linked devices → Link a device → scan the QR**

Once linked, you'll see `Ruang is linked and listening.`

> **Note:** WhatsApp Business does **not** support the "link with phone number"
> (pairing code) option — scan the QR instead. The pairing-code path only works
> on the regular WhatsApp app, and only if you set `OWNER_NUMBER` in `.env`.

Your session is saved to `bot/auth/` (git-ignored). Stop the bot with `Ctrl+C`.

---

## 4. Choose a group to watch

First, list every group your WhatsApp is in:

```bash
npm run groups
```

It prints lines like:

```
120363414091097081@g.us  —  COM203 Study Group
```

Pick one (ideally a test group you can spam), and put its JID in `.env`:

```
WATCHED_GROUPS=120363414091097081@g.us
```

> **Solo testing:** if you don't want to involve a real group, set
> `LISTEN_TO_SELF=true` in `.env`. The bot will then also react to messages
> *you* send in the watched group, so you can trigger it yourself.

---

## 5. Run and test

```bash
npm start
```

Now send a message in that group (or, with `LISTEN_TO_SELF=true`, send it from
your own account), like:

```
yo futsal thursday 8pm?
```

The terminal shows a pending invite:

```
🔔 [a1] COM203 — Your Name
   "yo futsal thursday 8pm?"
   → Thursday 8pm (you're clear)
   reply:  yes a1  |  no a1  |  counter a1
```

Type `yes a1`, `no a1`, or `counter a1` to post the verdict to the group.
**Nothing is posted until you do.**

---

## 6. Run the frontend against your local bot

In a second terminal:

```bash
cd ruang
npm install
npm run dev
```

The app is at `http://localhost:5173`. It talks to the bot on
`http://localhost:8788` by default (see `VITE_BOT_URL` in `ruang/.env.example`),
so your local bot and the app connect automatically — no extra config.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| QR won't scan / "can't link device" | WhatsApp Business has no pairing-code login — use QR only. If the QR expired, restart `npm start` for a fresh one. |
| `Logged out` after a while | Delete `bot/auth/` and re-link (step 3). |
| Two instances fighting on the same number | Only one bot per WhatsApp number at a time. Don't run this against the same number as the homeserver bot. |
| Port `8788` already in use | Edit `BOT_PORT` in `.env` and set `VITE_BOT_URL` to match. |
| "No schedule loaded" warning | Normal. Free/busy reads `schedule.json` (demo) or `schedule.local.json` (yours). Drop your own week there, or the app will push it via the API. |
