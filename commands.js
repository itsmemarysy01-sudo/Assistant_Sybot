import { normalizeCommand } from "./validate.js";
import { Content } from "./content.js";
import { Support } from "./support.js";
import { telegram } from "./telegram.js";
import { isAdminOrOwner } from "./config.js";

export async function handleMessage(update, env) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const userId = message.from?.id;

  // An open support flow takes priority over everything else, including commands
  // typed as plain text — but a real "/" command should still be allowed to run.
  if (await Support.isAwaitingText(chatId, env)) {
    const isTextCommand = typeof message.text === "string" && message.text.trim().startsWith("/");
    if (!isTextCommand) {
      if (typeof message.text === "string" && message.text.trim().length > 0) {
        await Support.handleText(chatId, userId, message.text.trim(), env);
      } else {
        // Non-text update (photo, sticker, voice, etc.) during an open flow.
        await Support.promptTextOnly(chatId, env);
      }
      return;
    }
  }

  if (typeof message.text !== "string") {
    // Non-text message with no active workflow — ignore per spec.
    return;
  }

  const parsed = normalizeCommand(message.text, env.BOT_USERNAME);
  if (!parsed) return;
  const { command } = parsed;

  switch (command) {
    case "/start":
      await telegram.sendMessage(chatId, "Welcome to TeamMarySy Bot. Use /panel to get started.", env);
      break;

    case "/panel":
      await sendPanel(chatId, env);
      break;

    case "/content":
      if (!(await isAdminOrOwner(userId, env))) {
        await telegram.sendMessage(chatId, "This command is restricted to admins.", env);
        return;
      }
      await Content.showMenu(chatId, env);
      break;

    case "/community":
      if (!(await isAdminOrOwner(userId, env))) {
        await telegram.sendMessage(chatId, "This command is restricted to admins.", env);
        return;
      }
      await telegram.sendMessage(
        chatId,
        "Community join requests are handled automatically and sent to admins for approval.",
        env
      );
      break;

    case "/support":
      await Support.start(chatId, env);
      break;

    default:
      // Unsupported command — ignore silently per spec.
      break;
  }
}

async function sendPanel(chatId, env) {
  await telegram.sendMessage(chatId, "TeamMarySy Bot", env, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📝 Content", callback_data: "menu:content" }],
        [{ text: "👥 Community", callback_data: "menu:community" }],
        [{ text: "🎫 Support", callback_data: "menu:support" }],
      ],
    },
  });
}
