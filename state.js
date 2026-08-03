const DEFAULT_TTL_SECONDS = 600; // 10 minutes

function stateKey(chatId, flow) {
  return `state:${chatId}:${flow}`;
}

export async function getState(chatId, flow, env) {
  const raw = await env.KV.get(stateKey(chatId, flow));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setState(chatId, flow, data, env, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const payload = { ...data, expires_at: Date.now() + ttlSeconds * 1000 };
  // KV enforces a 60s minimum TTL.
  const safeTtl = Math.max(ttlSeconds, 60);
  await env.KV.put(stateKey(chatId, flow), JSON.stringify(payload), {
    expirationTtl: safeTtl,
  });
}

export async function clearState(chatId, flow, env) {
  await env.KV.delete(stateKey(chatId, flow));
}
