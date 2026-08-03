# TeamMarySy Bot — Package Overview

Telegram-native, event-driven automation bot on Cloudflare Workers. This
document describes what's actually in this package, what was fixed for
production readiness, and what's still out of scope.

## What it is

Telegram is the interface. Cloudflare Workers run the logic. Workers KV
stores only the state the bot can't recover from Telegram itself. Cloudflare
Cron Triggers handle scheduled publishing and cleanup. No web dashboard, no
broadcast engine, no permanent member database.

## Entry points

- `fetch(request, env, ctx)` — validates the `X-Telegram-Bot-Api-Secret-Token`
  header, parses the update, and dispatches it in the background via
  `ctx.waitUntil()` so Telegram gets an immediate `200 OK` and doesn't retry.
- `scheduled(event, env, ctx)` — runs on the cron defined in `wrangler.toml`
  (every 15 minutes). Publishes due content and runs KV cleanup.

## Roles

- **Owner** — `env.OWNER_ID`, fixed at deploy time.
- **Admin** — user IDs in `config:admins` (KV).
- **Member** — everyone else. No record is kept of them.

## Commands

| Command | Access | Behavior |
|---|---|---|
| `/start` | everyone | welcome message |
| `/panel` | everyone | inline keyboard: Content / Community / Support |
| `/content` | Admin/Owner | shows Content menu (create/list/archive are placeholders; publish works) |
| `/community` | Admin/Owner | informational — join requests are handled automatically via `chat_join_request` |
| `/support` | everyone | starts a ticket flow, prompts for text |

Commands are normalized: case-insensitive, `@BotUsername` suffix stripped
(and if it names a *different* bot in a group chat, the command is ignored).

## Business modules

**Content** — `Content.publish(item, env)` is the single function that turns
a content item into a Telegram message; both the scheduler and any future
manual "publish now" action call through it. `Content.showMenu()` is a
placeholder — create/list/archive workflows are not built.

**Community** — handles `chat_join_request` events. Notifies the Owner and
all Admins concurrently with Approve/Reject buttons. A callback triggers
`approveChatJoinRequest()` / `declineChatJoinRequest()`. Telegram remains the
source of truth for pending requests; nothing is duplicated in KV.

**Support** — `/support` opens a short-lived KV-backed flow
(`state:<chat>:support`, TTL'd). The next text message becomes a ticket
(`ticket:<id>`), which notifies staff with a "Mark resolved" button. Non-text
input during an open flow prompts "Please send your response as text."
instead of silently failing or creating a blank ticket. Listing/filtering
tickets through Telegram commands isn't built — resolution works, viewing
doesn't have a dedicated command yet.

## State (Workers KV)

| Prefix | Contents | Cleanup |
|---|---|---|
| `config:*` | admin list, arbitrary config | never |
| `content:*` | (reserved for future draft storage — unused in this build) | — |
| `ticket:*` | support tickets | resolved tickets purged after 30 days |
| `sched:*` | pending/sent scheduled items | sent items purged after 24h |
| `sched:failed:*` | items that exhausted retries | purged after 30 days |
| `state:<chat>:<flow>` | short-lived conversation state | TTL'd (10 min default) |
| `counter:*` | sequential IDs (ticket numbering) | never |

## What was fixed for this production package

Two real issues were caught in review and fixed here:

1. **Sequential notification fan-out.** Originally, join-request and ticket
   alerts were sent to Owner/Admins in a `for...of` loop with `await` on
   each — one failed delivery (e.g. an admin blocked the bot) would skip
   everyone after them. Now `telegram.sendToMany()` sends concurrently via
   `Promise.allSettled`; failures are logged individually and don't block
   the rest.
2. **Unbounded KV growth.** Sent schedule items, exhausted-retry failures,
   and resolved tickets previously stayed in KV forever. The scheduler now
   purges each on a retention window (see table above).

The 15-minute cron cadence was flagged as a possible mismatch — it wasn't
changed (15 minutes is a reasonable default for this workload), but it's
now called out explicitly in the README so nobody assumes near-real-time
publishing.

## What's explicitly not built

This was an agreed scope decision, not an oversight:

- Content create/list/archive Telegram UX (menu shows placeholders)
- Support ticket list/filter commands (resolve works via callback; no `/tickets` command)
- Any automated test suite beyond the smoke tests run during development
  (not shipped as part of the package — see below)

## Validation performed on this exact package

- `node --check` on all 15 source files — syntax valid
- Full ES module import graph loaded successfully with no missing/circular imports
- Functional smoke tests against a mocked KV store and mocked Telegram API,
  covering: command normalization, RBAC gating, the full support ticket
  flow, non-text-during-flow handling, join-request notify/approve/reject,
  callback ID validation (rejects malformed input), scheduler publish +
  retry/failure path, fault-tolerant multi-recipient fan-out, and all three
  KV purge functions (correct items removed, recent/open items kept)

No test files are included in the shipped package — these were run during
development against this exact source tree to validate behavior before
packaging, not left in as a maintained suite.

## Deploying

See `README.md` for full setup steps. Summary: create the KV namespace, set
`TG_BOT_TOKEN` / `TG_BOT_SECRET_TOKEN` / `OWNER_ID`, deploy via Wrangler or
Cloudflare's Git integration, then register the webhook with Telegram.
