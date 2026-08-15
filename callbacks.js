import { telegram } from "./telegram.js";
import { Content } from "./content.js";
import { Community } from "./community.js";
import { Support } from "./support.js";
import { isAdminOrOwner } from "./config.js";
import { validateCallbackIds } from "./validate.js";

// Callback prefixes that require Owner/Admin before executing.
const PRIVILEGED_PREFIXES = ["menu:content", "menu:community", "join:", "support:resolve", "content:"];

export async function handleCallback(update, env) {
  const cq = update.callback_query;
  if (!cq) return;

  const data = cq.data || "";
  const chatId = cq.message?.chat?.id;
  const userId = cq.from?.id;

  const requiresAuth = PRIVILEGED_PREFIXES.some((prefix) => data.startsWith(prefix));
  if (requiresAuth && !(await isAdminOrOwner(userId, env))) {
    await telegram.answerCallbackQuery(cq.id, env, { text: "Not authorized.", show_alert: true });
    return;
  }

  try {
    if (data === "menu:content") {
      await Content.showMenu(chatId, env);
    } else if (data === "menu:community") {
      await telegram.sendMessage(chatId, "Community join requests are routed to admins automatically.", env);
    } else if (data === "menu:support") {
      await Support.start(chatId, env);
    } else if (data === "menu:close") {
      if (cq.message?.message_id) {
        await telegram.editMessageText(chatId, cq.message.message_id, "Closed.", env);
      }
    } else if (data.startsWith("join:approve:") || data.startsWith("join:reject:")) {
      await handleJoinDecision(data, chatId, cq, env);
    } else if (data.startsWith("support:resolve:")) {
      await handleTicketResolve(data, chatId, userId, cq, env);
    } else if (data.startsWith("content:")) {
      await telegram.sendMessage(chatId, "This part of Content management is coming soon.", env);
    }

    await telegram.answerCallbackQuery(cq.id, env);
  } catch (err) {
    await telegram.answerCallbackQuery(cq.id, env, { text: "Something went wrong.", show_alert: true });
    throw err;
  }
}

async function handleJoinDecision(data, chatId, cq, env) {
  const [, action, rawChatId, rawUserId] = data.split(":");
  const { joinChatId, joinUserId } = validateCallbackIds({
    joinChatId: rawChatId,
    joinUserId: rawUserId,
  });

  if (action === "approve") {
    await Community.approve(joinChatId, joinUserId, env);
  } else {
    await Community.reject(joinChatId, joinUserId, env);
  }

  if (cq.message?.message_id) {
    await telegram.editMessageText(
      chatId,
      cq.message.message_id,
      `Join request ${action === "approve" ? "approved" : "rejected"}.`,
      env
    );
  }
}

async function handleTicketResolve(data, chatId, userId, cq, env) {
  const [, , ticketId] = data.split(":");
  await Support.resolve(ticketId, "", userId, env);
  if (cq.message?.message_id) {
    await telegram.editMessageText(chatId, cq.message.message_id, `Ticket #${ticketId} marked resolved.`, env);
  }
}
