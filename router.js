import { handleMessage } from "./handlers/commands.js";
import { handleCallback } from "./handlers/callbacks.js";
import { handleJoinRequest } from "./handlers/joins.js";
import { runScheduledTasks } from "./scheduler/tasks.js";

export async function route(update, env) {
  if (update.message) {
    return handleMessage(update, env);
  }
  if (update.callback_query) {
    return handleCallback(update, env);
  }
  if (update.chat_join_request) {
    return handleJoinRequest(update, env);
  }
  // Unsupported update types are safely ignored.
}

export async function handleSchedule(env) {
  return runScheduledTasks(env);
}
