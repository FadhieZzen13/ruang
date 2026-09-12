# Deploy Ruang

Two halves, two hosts. The frontend (`ruang/`) is static and goes to **Vercel**.
The bot (`bot/`) is a long-running WhatsApp socket and runs on the **homeserver**
(Debian + Docker), kept alive by `restart: unless-stopped`.

## 1. Frontend → Vercel

1. In the Vercel dashboard: **Add New → Project** → import `FadhieZzen13/ruang`.
2. Set **Root Directory** to `ruang`.
3. Framework preset: **Vite** (auto-detected). Build `npm run build`, output `dist`.
4. Environment variables (Vercel → Settings → Environment Variables), all `Production + Preview`:
   - `VITE_DEEPSEEK_MODEL` = `deepseek-chat`
   - `VITE_LLM_MODEL` = `kimi-k2.7`
   - `VITE_BOT_URL` = the public bot URL (see step 3), e.g. `https://bot.zhermes.top`
   - (Do NOT set the API keys here — they are server-side only and the dev proxy
     doesn't exist in the Vercel build. See the note below.)
5. Deploy.

> **Note on LLM keys:** `DEEPSEEK_API_KEY` / `LLM_API_KEY` are only ever read by
> the Vite dev proxy (`vite.config.ts`), which does **not** run on Vercel. A static
> Vercel build has no backend, so the Voice-tab agent has nothing to call the LLM
> through. To make the Voice tab work in production you must move that call behind
> a real backend (a tiny serverless function or a route on the homeserver). Until
> then, the scheduler/calendar UI works; the LLM-backed voice actions are dev-only.

## 2. Bot → homeserver

On the box (`ssh zen@homeserver.local`):

```bash
mkdir -p ~/homeserver/stacks/ruang-bot
```

Copy the `bot/` folder up (Dockerfile, docker-compose.yml, src, package files),
then:

```bash
cd ~/homeserver/stacks/ruang-bot
cp .env.example .env        # edit: OWNER_NUMBER (optional), WATCHED_GROUPS, LISTEN_TO_SELF
docker compose up -d --build
```

First run links your WhatsApp:
- **QR:** `docker compose logs -f ruang-bot` → scan the QR in WhatsApp → Linked devices.
- **Pairing code:** set `OWNER_NUMBER` in `.env` first, then read the code from the logs.

The WhatsApp session persists in `./auth` (bind-mounted), so restarts/rebuilds
**do not** log you out.

To choose watched groups after linking:

```bash
docker compose run --rm ruang-bot npm run groups
```

then paste the JIDs into `.env` → `WATCHED_GROUPS` → `docker compose up -d`.

### Keeping it alive

`restart: unless-stopped` handles container crashes and host reboots. To survive
a power cut that powers the box back on, the BIOS "Restore on AC Power Loss" is
already set to Power On (see homeserver-handover.md).

## 3. Exposing the bot API (for VITE_BOT_URL)

The bot's HTTP API (`:8788`, schedule sync + in-app approvals) is bound to
`127.0.0.1` on the server. To let the Vercel frontend reach it, add a public
hostname in Cloudflare Zero Trust → Tunnels → homeserver → Public hostname:

- Subdomain: `bot` (→ `bot.zhermes.top`)
- Service: HTTP → `localhost:8788`

Then set `VITE_BOT_URL=https://bot.zhermes.top` on Vercel.

> ⚠️ **Security:** this endpoint has **no auth** and can approve verdicts on your
> behalf. Expose it only for a demo, or gate it with Cloudflare Access. The safe
> production path is to approve via the WhatsApp DM (which already works and is
> private) and keep `:8788` localhost-only.
