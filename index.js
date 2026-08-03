import { route, handleSchedule } from "./router.js";

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!secretHeader || secretHeader !== env.TG_BOT_SECRET_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // Respond to Telegram immediately; process the update in the background
    // so a slow downstream call doesn't cause Telegram to retry the webhook.
    ctx.waitUntil(
      route(update, env).catch((err) => {
        console.error("Error handling update:", err);
      })
    );

    return new Response("OK", { status: 200 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      handleSchedule(env).catch((err) => {
        console.error("Error running scheduled tasks:", err);
      })
    );
  },
};
