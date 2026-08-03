const TICKET_PREFIX = "ticket:";

// Deletes resolved tickets older than retentionMs so KV doesn't grow unbounded.
export async function purgeResolvedTickets(env, retentionMs, now = Date.now()) {
  let cursor;
  let purged = 0;
  do {
    const page = await env.KV.list({ prefix: TICKET_PREFIX, cursor });
    for (const entry of page.keys) {
      const raw = await env.KV.get(entry.name);
      if (!raw) continue;
      let ticket;
      try {
        ticket = JSON.parse(raw);
      } catch {
        continue;
      }
      if (ticket.status === "resolved" && ticket.resolved_at && now - ticket.resolved_at > retentionMs) {
        await env.KV.delete(entry.name);
        purged++;
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return purged;
}
