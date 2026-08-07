
***

# TeamMarySy Bot – Architecture & Deployment Guide

## 1. Architecture Overview

TeamMarySy Bot is a Telegram-native automation system built on Cloudflare Workers. It uses an event-driven, stateless execution model that relies on Telegram as the source of truth whenever possible. Persistent storage is intentionally minimal and limited to configuration, active workflows, scheduled jobs, support tickets, and sequential counters stored in Cloudflare Workers KV.

### Core Characteristics

- **Runtime:** Cloudflare Workers (serverless, edge-based)
- **Interface:** Telegram Bot API (webhooks)
- **Execution Model:** Event-driven, stateless per request
- **State Source:** Telegram (messages, callbacks, chat state)
- **Persistent Storage:** Cloudflare Workers KV only for:
  - Configuration
  - Active workflow metadata
  - Scheduled job metadata
  - Support ticket metadata
  - Sequential counters / IDs

### Explicitly Not Implemented

- ❌ Natural language processing  
- ❌ Machine learning / neural networks  
- ❌ Sentiment analysis  
- ❌ Continuous learning or feedback retraining  
- ❌ Conversation logging  
- ❌ Data analytics dashboards  
- ❌ Automatic Tuesday updates or similar AI-driven behaviors  

All behavior is explicit, rule-based, and traceable in code.

***

## 2. Feature-Oriented Flow

```text
Telegram User
      │
      ▼
Telegram Bot API
      │
      ▼
setWebhook
      │
      ▼
Cloudflare Worker (single entry point)
      │
      ▼
Webhook Handler
      │
      ▼
Authentication & Security
• Webhook secret / token validation
• Owner verification
• Permission control (per chat / per user)
• Rate limiting (per chat/user/IP as needed)
      │
      ▼
Update Router
• message
• callback_query
• chat_join_request
• edited_message
• … (other Telegram update types)
      │
      ▼
Feature Handlers (by command / event)
```

All logic lives in one Worker, using:

- Single webhook endpoint (`setWebhook` → your Worker URL)
- Workers KV for persistent state
- Raw `fetch()` to the Telegram Bot API (no external SDK required)

***

## 3. Operational Areas (Feature Domains)

Every feature is accessed via commands from a unified control panel.  
Each command supports a help sub-command, e.g. `/content help`.

| Command       | Area                                              |
|--------------|---------------------------------------------------|
| `/panel`     | Unified control panel (menu of all areas)         |
| `/content`   | Create, edit, publish, or archive content         |
| `/community` | Manage groups, members, and join requests         |
| `/support`   | Access tickets, conversations, and replies        |
| `/buttons`   | Configure inline menus and workflow actions       |
| `/automation`| Set keyword, event, and scheduled rules           |
| `/schedule`  | Manage publish, broadcast, and reminder times     |
| `/broadcast` | Send updates to channels, groups, or users        |
| `/approvals` | Review, approve, or reject pending requests       |
| `/knowledge` | Access FAQs, documents, and guides                |
| `/tasks`     | Create, assign, track, and complete tasks         |
| `/polls`     | Create, manage, and close community polls         |

Each command maps to a feature handler inside the Worker that:

- Reads/writes necessary KV keys (config, state, tickets, counters, etc.)
- Calls Telegram Bot API via `fetch()` to:
  - Send messages
  - Edit messages / inline keyboards
  - Answer callback queries
  - Manage chat permissions and join requests
  - Create/close polls, etc.

***

## 4. Data & State Model (Workers KV)

KV is used minimally and intentionally:

- **Configuration**
  - Per-chat settings (language, feature flags, permissions)
  - Global bot config (owner IDs, allowed chats, feature toggles)
- **Active Workflows**
  - Ongoing multi-step interactions (e.g., content creation wizard)
  - Temporary state for approvals, tasks, ticket flows
- **Scheduled Jobs**
  - Metadata for scheduled publishes, broadcasts, reminders
  - Next-run timestamps, job payloads (compact, reference-based)
- **Support Tickets**
  - Ticket ID → metadata (status, owner, chat, last activity)
- **Sequential Counters**
  - Ticket IDs, task IDs, content IDs, poll IDs, etc.

No conversation logs, analytics, or ML-related data are stored.

***

## 5. Request Flow (Per Update)

1. **Telegram Bot API** sends an update to your Worker webhook.
2. **Webhook Handler**:
   - Validates request (secret token, optional IP checks).
   - Extracts update payload.
3. **Authentication & Security**:
   - Checks if chat/user is allowed.
   - Applies rate limits.
4. **Update Router**:
   - Dispatches based on update type:
     - `message` → command router or text handler
     - `callback_query` → callback handler
     - `chat_join_request` → join request handler
     - etc.
5. **Feature Handlers**:
   - Implement logic for each operational area.
   - Use KV for config, state, tickets, tasks, scheduled jobs.
   - Call Telegram Bot API via `fetch()` to respond and update UI.
6. **Response**:
   - Worker returns `200 OK` to Telegram as fast as possible.
   - Heavy work is kept lightweight or deferred to cron-triggered runs.

***

## 6. Cron-Triggered Maintenance

A small set of cron jobs augments the event-driven model:

- **Scheduled Publishing & Broadcasts**
  - Scan KV for jobs due now.
  - Trigger send operations via `fetch()` to Telegram.
- **Cleanup**
  - Remove expired workflow state.
  - Purge old resolved tickets and finished schedules.
- **Optional Counters**
  - Update simple operational counters if desired.

No analytics dashboards or logging pipelines are included; any metrics are minimal and operation-focused.

***

## 7. Security & Operations

- **Secrets**
  - Bot token stored in Cloudflare Workers Secrets.
  - Owner/admin IDs stored in env or KV, not in code.
- **Webhook Security**
  - Strict validation using `WEBHOOK_SECRET` (`X-Telegram-Bot-Api-Secret-Token` header).
  - Optional IP allowlist (Telegram’s published webhook IPs).
- **Observability**
  - Structured logs (JSON) with:
    - Update type
    - `chat_id`, `from.id`
    - Command or callback action
    - High-level result (ok/error)
  - No conversation content logging.

***

## 8. Deployment to Cloudflare Workers

### 8.1 Create a Worker

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Create application** → **Create Worker**.
2. Name it, e.g. `teammarysy-bot`.
3. Skip the template or use a blank one.

### 8.2 Create KV Namespace

1. Go to **Workers & Pages** → **KV** → **Create a namespace**.
2. Name it, e.g. `TEAMMARYSY_KV`.
3. Note the namespace ID.

### 8.3 Set Secrets

In the Worker page:

1. Go to **Settings** → **Variables** → **Environment variables**.
2. Add as **Secrets**:
   - `TELEGRAM_BOT_TOKEN` – your bot token
   - `WEBHOOK_SECRET` – random secret string
   - `OWNER_TELEGRAM_ID` – your Telegram user ID (numeric)
3. Add as **Variables**:
   - `BOT_USERNAME` – e.g. `TeamMarySyBot`
   - `ENVIRONMENT` – `production` (optional)

### 8.4 Bind KV Namespace

1. In **Settings** → **Bindings**, add a **KV Namespace**.
2. Set:
   - **Variable name:** `TEAMMARYSY_KV`
   - **KV namespace:** select `TEAMMARYSY_KV`.

### 8.5 Configure Cron Triggers

In **Triggers** → **Cron triggers**, add:

- `*/30 * * * *` – every 30 minutes
- `0 */4 * * *` – every 4 hours
- `0 3 * * *` – daily at 03:00
- `0 9 * * 1` – weekly, Monday 09:00

These call the `scheduled()` handler in your Worker.

***

## 9. Deploy Code (Manual Dashboard Method)

### 9.1 Build to Clipboard

From your project root:

```bash
npm install          # one-time, to install esbuild
npm run build:clipboard
```

This bundles `src/index.ts` and copies the resulting JS to your clipboard.

### 9.2 Paste into Cloudflare Dashboard

1. Open **Workers & Pages** → `teammarysy-bot`.
2. Go to **Quick edit**.
3. Replace all code with the clipboard contents.
4. Click **Save and deploy**.

***

## 10. Set the Telegram Webhook

Your Worker URL:

```text
https://teammarysy-bot.<subdomain>.workers.dev
```

Set webhook (replace placeholders):

```bash
BOT_TOKEN="YOUR_BOT_TOKEN"
WORKER_URL="https://teammarysy-bot.<subdomain>.workers.dev"
SECRET_TOKEN="YOUR_WEBHOOK_SECRET"

curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WORKER_URL}&secret_token=${SECRET_TOKEN}"
```

Verify:

```bash
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

Ensure:

- `url` matches your Worker
- No recent `last_error_date`

***

## 11. Schedule Configuration (Editable via KV)

Schedule behavior is controlled by KV key `config:schedule`.

Default shape:

```json
{
  "enabled": true,
  "retention": {
    "sentMs": 86400000,
    "failedMs": 2592000000,
    "resolvedTicketsMs": 2592000000
  }
}
```

Manage via Telegram (admin-only):

- `/schedule config` – show current schedule settings
- `/schedule enable` – enable scheduled tasks
- `/schedule disable` – disable scheduled tasks
- `/schedule retention <sentHours> <failedDays> <ticketsDays>`  
  Example: `/schedule retention 24 30 30`

No redeploy is needed; changes take effect on the next cron run.

***

## 12. Production Checklist

- [ ] Worker created (`teammarysy-bot`) and code deployed.
- [ ] KV namespace created and bound as `TEAMMARYSY_KV`.
- [ ] Secrets set: `TELEGRAM_BOT_TOKEN`, `WEBHOOK_SECRET`, `OWNER_TELEGRAM_ID`.
- [ ] Variables set: `BOT_USERNAME`, `ENVIRONMENT` (optional).
- [ ] Cron triggers configured and visible in **Triggers**.
- [ ] Webhook set to Worker URL with matching `secret_token`.
- [ ] Basic commands work in Telegram: `/start`, `/panel`, `/support`, `/schedule config`.
- [ ] Callback buttons respond quickly (no “bot is too slow”).
- [ ] Logs show structured entries for updates and errors.

***
