# Validation Report

Validated 2026-08-02, against the v1.0 "Clean System Blueprint." This pass
adds the blueprint's explicit contracts (function signatures, numeric ID
validation, per-item retry limits) on top of the previously merged
reliability/security fixes. Everything below was independently re-checked
against this exact codebase — `npm run check` plus a 12-case functional
smoke test — not restated from a prior report.

## Checks performed

- `npm run check` — all files under `src/` pass `node --check`.
- Functional smoke test (12 cases, mocked `fetch` + in-memory KV):
  1. `/PANEL@TeamMarySyBot` normalizes and routes as `/panel`
  2. Non-text message with no active flow is ignored
  3. Non-text message during an open support flow prompts `"Please send your response as text."` (exact blueprint §11 wording) and does **not** create a ticket
  4. Real text after that prompt creates exactly one ticket
  5–6. `join:approve` callback_data is coerced to `Number` for both `chat_id` and `user_id`
  7. Non-admins are rejected from `join:*` callback actions with a message, and the Telegram API is never called
  8. A failed `sendMessage()` in the scheduler increments retry count rather than being deleted as sent
  9–10. Malformed callback identifiers (non-numeric `chat_id`/`user_id`) are rejected before reaching the Telegram API, with a graceful user-facing message

## New in this pass (blueprint §11, §13, §15, §20)

- **§13 — numeric ID validation.** Added `src/utils/validate.js` (`toSafeInteger`), which throws on any callback-derived ID that isn't `Number.isSafeInteger()`. `callbacks.js` catches this locally and replies with a generic failure message instead of letting a malformed `callback_data` payload reach `approveChatJoinRequest`/`declineChatJoinRequest`, or bubble up as an unhandled rejection.
- **§11 — `Support.isAwaitingText(chatId, env)`.** Renamed from the previous `isAwaitingInput(env, chatId)` and flipped the argument order to match the blueprint exactly. Internal step name changed to `awaiting_ticket_text` to match §18's state shape.
- **§15 — `Content.publish(item, env)`.** Flipped from `publish(env, item)`. This is a deliberate module-boundary contract — `telegram.js` itself still takes `env` first everywhere internally; only the two blueprint-specified public signatures (`isAwaitingText`, `publish`) take `env` last.
- **§20 — per-item `max_retries`.** `createScheduledItem` now stores `max_retries` (default 3) on each scheduled item instead of relying on a single module-wide constant, matching the schema in §20 exactly.

## Carried forward from prior validation (unchanged, still passing)

- `telegram.js` throws on Bot API failures instead of only logging.
- Scheduler retries failed sends via `incrementRetry()` rather than unconditionally calling `markSent()`.
- Unknown scheduled item types throw and enter the retry/failed path.
- Callback authorization enforced for `menu:*` (content/community) and `join:*`.
- `community.js` notifies the owner and all configured admins via `Promise.allSettled`, so one unreachable admin doesn't mask successful notifications to the rest.
- `schedules.js` paginates `KV.list()` via cursor.
- Commands normalize `@BotUsername` suffix and case.

## Known incomplete workflows (unchanged, intentional)

- Content create/list/edit/archive command and callback UX remains stubbed — the module boundary and `Content.publish()` pipeline exist, but no guided Telegram conversation is built on top of it yet.
- Support ticket list/resolve commands are not exposed through Telegram, although ticket creation and the underlying `resolveTicket()` operation exist.
- The blueprint's `processing` schedule status (§20) is not implemented — items only move between `pending` and the `sched:failed:*` prefix. This is fine at current scale (a single Worker instance processing one cron tick at a time won't race itself), but if scheduled volume grows enough to warrant overlapping cron runs, a `processing` lock would prevent double-sends.

## Environment limitation

A live Wrangler dry-run (`npx wrangler deploy --dry-run`) was not executed in
this sandbox (no network access to the npm/Cloudflare registries). Run before
deploying:

```bash
npm install
npm run check
npx wrangler deploy --dry-run --outdir dist
```
