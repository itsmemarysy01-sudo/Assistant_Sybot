import { Community } from "./community.js";

export async function handleJoinRequest(update, env) {
  const request = update.chat_join_request;
  if (!request) return;
  await Community.notifyJoinRequest(request, env);
}
