const SCHED_PREFIX = "sched:";
const FAILED_PREFIX = "sched:failed:";

export async function addScheduledItem(item, env) {
  const key = `${SCHED_PREFIX}${item.id}`;
  const record = {
    status: "pending",
    retry_count: 0,
    max_retries: 3,
    ...item,
  };
  await env.KV.put(key, JSON.stringify(record));
  return record;
}

// Lists pending sched:* items whose due_at has passed. Skips sched:failed:* entries.
export async function listDueItems(env, now = Date.now()) {
  const due = [];
  let cursor;
  do {
    const page = await env.KV.list({ prefix: SCHED_PREFIX, cursor });
    for (const entry of page.keys) {
      if (entry.name.startsWith(FAILED_PREFIX)) continue;
      const raw = await env.KV.get(entry.name);
      if (!raw) continue;
      let item;
      try {
        item = JSON.parse(raw);
      } catch {
        continue;
      }
      if (item.status === "pending" && item.due_at <= now) {
        due.push(item);
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return due;
}

export async function markSent(item, env) {
  const key = `${SCHED_PREFIX}${item.id}`;
  await env.KV.put(key, JSON.stringify({ ...item, status: "sent", sent_at: Date.now() }));
}

export async function markFailed(item, env) {
  const retryCount = (item.retry_count || 0) + 1;
  const maxRetries = item.max_retries ?? 3;

  if (retryCount > maxRetries) {
    const failedKey = `${FAILED_PREFIX}${item.id}`;
    await env.KV.put(
      failedKey,
      JSON.stringify({ ...item, status: "failed", retry_count: retryCount, failed_at: Date.now() })
    );
    await env.KV.delete(`${SCHED_PREFIX}${item.id}`);
  } else {
    const key = `${SCHED_PREFIX}${item.id}`;
    await env.KV.put(key, JSON.stringify({ ...item, status: "pending", retry_count: retryCount }));
  }
}

// Deletes "sent" items older than retentionMs so KV doesn't grow unbounded.
export async function purgeSentSchedules(env, retentionMs, now = Date.now()) {
  let cursor;
  let purged = 0;
  do {
    const page = await env.KV.list({ prefix: SCHED_PREFIX, cursor });
    for (const entry of page.keys) {
      if (entry.name.startsWith(FAILED_PREFIX)) continue;
      const raw = await env.KV.get(entry.name);
      if (!raw) continue;
      let item;
      try {
        item = JSON.parse(raw);
      } catch {
        continue;
      }
      if (item.status === "sent" && item.sent_at && now - item.sent_at > retentionMs) {
        await env.KV.delete(entry.name);
        purged++;
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return purged;
}

// Deletes failed items older than retentionMs.
export async function purgeFailedSchedules(env, retentionMs, now = Date.now()) {
  let cursor;
  let purged = 0;
  do {
    const page = await env.KV.list({ prefix: FAILED_PREFIX, cursor });
    for (const entry of page.keys) {
      const raw = await env.KV.get(entry.name);
      if (!raw) continue;
      let item;
      try {
        item = JSON.parse(raw);
      } catch {
        continue;
      }
      if (item.failed_at && now - item.failed_at > retentionMs) {
        await env.KV.delete(entry.name);
        purged++;
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return purged;
}
