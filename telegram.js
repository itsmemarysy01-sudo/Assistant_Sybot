const API_BASE = "https://api.telegram.org/bot";

async function callTelegramApi(method, payload, env) {
  const url = `${API_BASE}${env.TG_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${data.description || "unknown error"}`);
  }
  return data.result;
}

export const telegram = {
  sendMessage(chatId, text, env, extra = {}) {
    return callTelegramApi("sendMessage", { chat_id: chatId, text, ...extra }, env);
  },

  editMessageText(chatId, messageId, text, env, extra = {}) {
    return callTelegramApi(
      "editMessageText",
      { chat_id: chatId, message_id: messageId, text, ...extra },
      env
    );
  },

  answerCallbackQuery(callbackQueryId, env, extra = {}) {
    return callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQueryId, ...extra }, env);
  },

  approveChatJoinRequest(chatId, userId, env) {
    return callTelegramApi("approveChatJoinRequest", { chat_id: chatId, user_id: userId }, env);
  },

  declineChatJoinRequest(chatId, userId, env) {
    return callTelegramApi("declineChatJoinRequest", { chat_id: chatId, user_id: userId }, env);
  },

  // Sends the same message to multiple recipients without letting one failure
  // (blocked bot, invalid chat, etc.) prevent delivery to the rest.
  async sendToMany(recipients, text, env, extra = {}) {
    const list = [...recipients];
    const results = await Promise.allSettled(
      list.map((chatId) => callTelegramApi("sendMessage", { chat_id: chatId, text, ...extra }, env))
    );
    const failures = results
      .map((r, i) => ({ r, chatId: list[i] }))
      .filter(({ r }) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(
        `sendToMany: ${failures.length}/${results.length} deliveries failed`,
        failures.map(({ chatId, r }) => `${chatId}: ${r.reason?.message || r.reason}`)
      );
    }
    return results;
  },
};
