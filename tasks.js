import { listDueItems, markSent, markFailed, purgeSentSchedules, purgeFailedSchedules } from "../kv/schedules.js";
import { purgeResolvedTickets } from "../kv/tickets.js";
import { Content } from "../modules/content.js";

// Retention windows for cleanup — chosen to keep KV lean without discarding
// records too aggressively for someone to review after the fact.
const SENT_SCHEDULE_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours
const FAILED_SCHEDULE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESOLVED_TICKET_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function runScheduledTasks(env) {
  const dueItems = await listDueItems(env);

  for (const item of dueItems) {
    try {
      if (item.type === "content") {
        await Content.publish(item, env);
      }
      await markSent(item, env);
    } catch (err) {
      console.error(`Scheduled item ${item.id} failed:`, err);
      await markFailed(item, env);
    }
  }

  // Cleanup pass — runs every invocation (every 15 minutes per wrangler.toml).
  // Cheap no-op when there's nothing old enough to purge.
  await purgeSentSchedules(env, SENT_SCHEDULE_RETENTION_MS);
  await purgeFailedSchedules(env, FAILED_SCHEDULE_RETENTION_MS);
  await purgeResolvedTickets(env, RESOLVED_TICKET_RETENTION_MS);
}
