import { telegram } from "../telegram.js";
import { getConfig } from "../kv/config.js";

export const Content = {
  // Placeholder menu — full create/list/archive UX is not yet implemented (see README).
  async showMenu(chatId, env) {
    await telegram.sendMessage(
      chatId,
      "Content Management\n\n(Create/List/Archive flows are coming soon. Publishing and scheduling already work under the hood.)",
      env,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📝 Create", callback_data: "content:create" }],
            [{ text: "📚 List", callback_data: "content:list" }],
            [{ text: "📅 Scheduled", callback_data: "content:scheduled" }],
            [{ text: "📦 Archive", callback_data: "content:archive" }],
            [{ text: "❌ Close", callback_data: "menu:close" }],
          ],
        },
      }
    );
  },

  // The single function that turns a content item into a Telegram message.
  // Both manual publishing and the scheduler call through this.
  async publish(item, env) {
    const targetChatId = item.chat_id || (await getDefaultChannel(env));
    if (!targetChatId) {
      throw new Error("No target channel configured for publishing (set config:channels)");
    }
    return telegram.sendMessage(targetChatId, item.text, env);
  },
};

async function getDefaultChannel(env) {
  const channels = await getConfig("channels", env);
  if (!channels) return null;
  return Array.isArray(channels) ? channels[0] : channels;
}
