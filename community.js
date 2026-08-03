import { telegram } from "../telegram.js";
import { getAdmins } from "../kv/config.js";

export const Community = {
  async notifyJoinRequest(request, env) {
    const { chat, from } = request;
    const admins = await getAdmins(env);
    const recipients = new Set([Number(env.OWNER_ID), ...admins]);

    const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Unknown";
    const username = from.username ? `@${from.username}` : "no username";
    const text = `New join request\n\nUser: ${name} (${username})\nChat: ${chat.title || chat.id}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `join:approve:${chat.id}:${from.id}` },
          { text: "❌ Reject", callback_data: `join:reject:${chat.id}:${from.id}` },
        ],
      ],
    };

    await telegram.sendToMany(recipients, text, env, { reply_markup: keyboard });
  },

  async approve(chatId, userId, env) {
    await telegram.approveChatJoinRequest(chatId, userId, env);
  },

  async reject(chatId, userId, env) {
    await telegram.declineChatJoinRequest(chatId, userId, env);
  },
};
