const ADMINS_KEY = "config:admins";

export async function getAdmins(env) {
  const raw = await env.KV.get(ADMINS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

export async function setAdmins(admins, env) {
  await env.KV.put(ADMINS_KEY, JSON.stringify(admins.map(Number)));
}

export function isOwner(userId, env) {
  if (userId === undefined || userId === null) return false;
  return String(userId) === String(env.OWNER_ID);
}

export async function isAdmin(userId, env) {
  const admins = await getAdmins(env);
  return admins.includes(Number(userId));
}

export async function isAdminOrOwner(userId, env) {
  return isOwner(userId, env) || (await isAdmin(userId, env));
}

export async function getConfig(key, env) {
  const raw = await env.KV.get(`config:${key}`);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function setConfig(key, value, env) {
  await env.KV.put(`config:${key}`, JSON.stringify(value));
}
