# TeamMarySy Bot — Architecture

**Status:** Authoritative
**Version:** 1.0
**Stack:** Telegram-native · Event-driven · Cloudflare Workers

## 1. Philosophy

TeamMarySy Bot is a Telegram-native automation system.

- Telegram is the user interface.
- The bot does not recreate features Telegram already provides.
- The bot stores only the minimum state its own logic requires.

**Principles:** Telegram-first · Event-driven · Stateless execution between events · Minimal
persistence · No member directory · No broadcast engine · No web dashboard ·
No unnecessary storage.

## 2. Runtime Architecture

```
Telegram
   │
   ▼
Cloudflare Worker
┌───────────────────────────┐
│  fetch()      scheduled() │
└─────────┬─────────┬───────┘
          └────┬─────┘
               ▼
         route(event)
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼
handleMessage handleCallback handleSchedule
   │           │           │
   └───────────┼───────────┘
               ▼
        Business Modules
   ┌──────────┬──────────┬──────────┐
   ▼          ▼          ▼
Content   Community   Support
               │
               ▼
        Cloudflare KV
       (minimal state)
               │
               ▼
      Telegram Bot API
               │
               ▼
          Telegram
```

`scheduled()` is a peer entry point to `fetch()`, not something downstream of
the business modules — the Cron Trigger is just another event source.

## 3. Entry Points

The bot accepts only Telegram updates and Cron events:

- `message`
- `callback_query`
- `chat_join_request`
- scheduled event (Cloudflare Cron)

## 4. User Model

No user database. Roles are:

- **Owner** — ID from config (`env.OWNER_ID`).
- **Admin** — IDs stored in KV (`config:admins`).
- **Member** — everyone else. No permanent record is kept.

## 5. Commands

Public: `/start`, `/panel`
Modules: `/content`, `/community`, `/support`

Commands only start workflows — they never execute complex multi-step logic
directly.

## 6. Navigation

Navigation uses Telegram inline keyboards exclusively. No dashboard, no
website.

```
/panel
──────────────
📝 Content
👥 Community
🎫 Support
```

## 7. Business Modules

### Content
Target capabilities are create, publish, list, archive, and schedule. In version 1.0,
the Telegram create/list/archive workflow is intentionally stubbed; publishing and
scheduler plumbing are implemented. Publishing sends directly to the configured
Telegram channel. `Content.publish()` is the single function that
knows how to turn an item into a Telegram message — both manual publishing
and the scheduler call through it.

### Community
Handles `chat_join_request` events. Owner and configured admins get Approve/Reject inline
buttons; the bot calls `approveChatJoinRequest()` / `declineChatJoinRequest()`.
Telegram already tracks pending requests — the bot does not duplicate that
storage.

### Support
Version 1.0 implements ticket creation and the underlying resolve operation. The
Telegram commands for viewing and resolving tickets are planned but not yet wired.
Tickets are stored in KV; retention and archival policy remain implementation choices.

## 8. Scheduler

Replaces the need for a broadcast engine. Runs on Cloudflare Cron Triggers
and calls into the same business modules — it never bypasses them or talks
to the Telegram API directly.

Jobs: publish scheduled content, send reminders, clean temporary state,
remove expired tickets/failed jobs.

## 9. State Storage (Cloudflare KV)

Stores only what the bot cannot obtain from Telegram:

| Key prefix       | Purpose                                  |
|-------------------|-------------------------------------------|
| `config:*`        | Bot configuration, admin list             |
| `content:*`        | Drafts and scheduled posts (module state) |
| `ticket:*`         | Active/resolved support tickets           |
| `sched:*`          | Pending scheduled jobs                    |
| `sched:failed:*`   | Jobs that exhausted retries                |
| `state:<chat>:<flow>` | Short-lived conversation state (TTL'd) |
| `counter:*`        | Sequential IDs                            |

Not stored: user profiles, member directory, join request history, message
history, chat history, unnecessary logs.

## 10. Processing Flow

```
Telegram → Webhook → Cloudflare Worker → Verify Secret → Parse Update
   → Route → Command | Callback | Join Request | Scheduler
   → Business Module → KV (only if needed) → Telegram Bot API → Telegram
```

## 11. Layer Responsibilities

- **Transport** (`index.js`, `router.js`) — webhook validation, parsing, routing. No
  business logic.
- **Application** (`handlers/`) — commands, callbacks, permissions, workflow
  execution. All business rules live here (in the modules it calls).
- **State** (`kv/`) — config, active content, active tickets, scheduled
  jobs, counters. Nothing more.
- **Delivery** (`telegram.js`) — all Telegram Bot API calls (`sendMessage`,
  `editMessageText`, `answerCallbackQuery`, `approveChatJoinRequest`,
  `declineChatJoinRequest`).

## 12. Design Principles

- Telegram is the UI.
- Commands are public entry points; callback queries continue workflows.
- Inline keyboards provide navigation.
- Join requests use Telegram's native `chat_join_request`.
- Scheduler performs time-based automation through the same modules.
- Workers KV stores only essential application state.
- No broadcast engine, no web dashboard, no permanent member database.

## 13. Core Architecture Statement

TeamMarySy Bot is a Telegram-native, event-driven automation engine running
on Cloudflare Workers. Telegram provides the interface, Cloudflare Workers
execute the logic, Workers KV stores only essential application state, and
Cloudflare Cron Triggers provide scheduled automation. The bot relies on
Telegram's native commands, inline keyboards, callback queries, and
join-request events instead of recreating platform functionality, resulting
in a lightweight, maintainable, and efficient architecture.

## Diagrams

See `diagrams/`:
- `command-flow.mermaid`
- `callback-flow.mermaid`
- `scheduler-flow.mermaid`
