# TeamMarySy Bot

A Telegram-native, event-driven automation bot running on Cloudflare
Workers. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.


## Implementation status

The webhook, routing, Telegram delivery layer, join moderation, support-ticket
creation, KV conversation state, scheduling, retries, and scheduled publication are
wired end to end. Commands are normalized (case and `@BotUsername` suffix), and
non-text updates during an open support flow prompt for text instead of creating a
blank ticket.

Aligned to the v1.0 blueprint's explicit contracts:
- `Support.isAwaitingText(chatId, env)` and `Content.publish(item, env)` match the
  signatures specified in the blueprint (§11, §15) — note both take `env` last,
  which is the reverse of the `(env, ...)` convention used by `telegram.js`
  internally. This is a deliberate module-boundary contract per the spec, not a
  codebase-wide convention change.
- Callback-derived chat/user IDs are validated with `Number.isSafeInteger()`
  (`src/utils/validate.js`) before being used, per §13. Malformed identifiers are
  rejected with a user-facing message rather than reaching the Telegram API.
- Scheduled items carry a per-item `max_retries` field (default 3) per the §20
  schema, rather than a single module-wide constant.

The Content command UX is intentionally incomplete: `/content`, `/content create`,
`/content list`, and archive/edit workflows currently expose placeholders rather than
a finished guided flow. Support ticket list/resolve commands are also not yet exposed
through Telegram, although the underlying resolve operation exists.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a KV namespace**
   ```bash
   npx wrangler kv namespace create KV
   ```
   Copy the returned `id` into `wrangler.toml` under `[[kv_namespaces]]`.

3. **Set secrets**
   ```bash
   npx wrangler secret put TG_BOT_TOKEN
   npx wrangler secret put TG_BOT_SECRET_TOKEN
   ```
   For local dev, copy `.dev.vars.example` to `.dev.vars` and fill in the
   same values.

4. **Set `OWNER_ID`** in `wrangler.toml` under `[vars]` (your Telegram user
   ID — message [@userinfobot](https://t.me/userinfobot) to get it).

5. **Deploy**
   ```bash
   npm run deploy
   ```

6. **Register the webhook** (replace the placeholders):
   ```bash
   curl -X POST "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://<YOUR_WORKER_URL>/","secret_token":"<TG_BOT_SECRET_TOKEN>","allowed_updates":["message","callback_query","chat_join_request"]}'
   ```

7. **Add an admin** (optional, beyond the owner):
   ```bash
   npx wrangler kv key put --binding=KV "config:admins" '[123456789]'
   ```

## Validation

```bash
npm run check
npx wrangler deploy --dry-run
```

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill in real values
npm run dev
```

Use a tunnel (e.g. `cloudflared tunnel` or `ngrok`) to expose your local
dev server for Telegram's webhook while testing.

## Project structure

```
src/
├── index.js              # fetch() + scheduled() entry points
├── router.js              # routes all events (transport layer, no logic)
├── telegram.js             # Telegram Bot API client (delivery layer)
├── handlers/
│   ├── commands.js
│   ├── callbacks.js
│   └── joins.js
├── modules/
│   ├── content.js
│   ├── community.js
│   └── support.js
├── kv/
│   ├── config.js
│   ├── schedules.js
│   ├── state.js
│   └── tickets.js
├── utils/
│   └── validate.js
└── scheduler/
    └── tasks.js
diagrams/
├── command-flow.mermaid
├── callback-flow.mermaid
└── scheduler-flow.mermaid
```

## Reliability notes

- **Cron cadence:** the scheduler runs every 15 minutes (`wrangler.toml`
  `[triggers] crons`). Scheduled content publication and cleanup happen on
  that cadence — a post due at `due_at` may be delayed up to ~15 minutes
  before it's actually sent. Tighten the cron expression if you need
  closer-to-real-time publishing.
- **Multi-recipient notifications** (join-request alerts, ticket alerts to
  Owner/Admins) use `telegram.sendToMany()`, which sends to all recipients
  concurrently via `Promise.allSettled`. One recipient failing (e.g. they
  blocked the bot) does not prevent delivery to the others; failures are
  logged, not thrown.
- **KV cleanup:** every scheduler run also purges records that no longer
  need to stay live, so KV doesn't grow unbounded:
  - `sched:*` items with `status: "sent"` — purged after 24 hours
  - `sched:failed:*` items — purged after 30 days
  - resolved tickets (`ticket:*` with `status: "resolved"`) — purged after
    30 days
  
  Open tickets, pending schedules, and admin/config records are never
  auto-purged. Retention windows are constants at the top of
  `src/scheduler/tasks.js` if you want different values.
