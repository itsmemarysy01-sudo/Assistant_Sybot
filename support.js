import { telegram } from "./telegram.js";
import { getState, setState, clearState } from "./state.js";
import { getAdmins } from "./config.js";

const FLOW = "support";

export const Support = {
  async start(chatId, env) {
    await setState(chatId, FLOW, { step: "awaiting_ticket_text", data: {} }, env);
    await telegram.sendMessage(chatId, "Please describe your issue. Send it as a text message.", env);
  },

  // Matches the blueprint's Support.isAwaitingText(chatId, env) contract exactly
  // (env last, opposite of telegram.js's convention — deliberate per spec).
  async isAwaitingText(chatId, env) {
    const state = await getState(chatId, FLOW, env);
    return !!state && state.step === "awaiting_ticket_text";
  },

  async promptTextOnly(chatId, env) {
    await telegram.sendMessage(chatId, "Please send your response as text.", env);
  },

  async handleText(chatId, userId, text, env) {
    const id = await nextTicketId(env);
    const ticket = {
      id,
      chat_id: chatId,
      user_id: userId,
      text,
      status: "open",
      created_at: Date.now(),
    };
    await env.KV.put(`ticket:${id}`, JSON.stringify(ticket));
    await clearState(chatId, FLOW, env);
    await telegram.sendMessage(chatId, `Ticket #${id} created. We'll get back to you soon.`, env);
    await notifyStaff(ticket, env);
    return ticket;
  },

  async resolve(ticketId, notes, resolverId, env) {
    const key = `ticket:${ticketId}`;
    const raw = await env.KV.get(key);
    if (!raw) throw new Error(`Ticket ${ticketId} not found`);
    const ticket = JSON.parse(raw);
    ticket.status = "resolved";
    ticket.resolved_by = resolverId;
    ticket.resolution = notes || "";
    ticket.resolved_at = Date.now();
    await env.KV.put(key, JSON.stringify(ticket));
    return ticket;
  },
};

async function nextTicketId(env) {
  const counterKey = "counter:ticket";
  const current = await env.KV.get(counterKey);
  const next = (current ? parseInt(current, 10) : 0) + 1;
  await env.KV.put(counterKey, String(next));
  return next;
}

async function notifyStaff(ticket, env) {
  const admins = await getAdmins(env);
  const recipients = new Set([Number(env.OWNER_ID), ...admins]);
  const text = `New support ticket #${ticket.id}\n\n${ticket.text}`;
  const keyboard = {
    inline_keyboard: [[{ text: "✅ Mark resolved", callback_data: `support:resolve:${ticket.id}` }]],
  };
  await telegram.sendToMany(recipients, text, env, { reply_markup: keyboard });
}
