import { createTelegramBot } from "./bot.js";
import { loadTelegramConfig } from "./config.js";

const config = loadTelegramConfig(process.env);
const bot = createTelegramBot(config);

if (config.dryRun) {
  console.log("Phoenix BOS Telegram configuration validated; dry run complete");
} else {
  let stopping = false;
  const stop = (signal: "SIGINT" | "SIGTERM") => {
    if (stopping) return;
    stopping = true;
    bot.stop();
    console.log(`Phoenix BOS Telegram worker received ${signal}; polling stopped`);
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
  await bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: () => console.log("Phoenix BOS Telegram worker started long polling"),
  });
}
