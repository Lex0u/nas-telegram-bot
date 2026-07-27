// src/index.ts
import { LogLevel } from "@lex0u/logger";

import { registerCommands } from "./commands/index.js";
import { loadConfig } from "./config/index.js";
import { createBot, launchBot, sendToAllowedChat } from "./core/bot.js";
import { registerMonitors } from "./monitors/index.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const { app: config, secrets } = loadConfig();

  const bot = createBot(secrets);
  registerCommands(bot, config);
  registerMonitors(bot, config, secrets);

  await sendToAllowedChat(
    bot,
    secrets,
    "🤖 Bot NAS démarré et opérationnel.\nEnvoie /menu pour voir les options.",
  );

  await logger.log.console(LogLevel.Success, "Bot NAS démarré.", "Main");

  await launchBot(bot);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  void logger.log.console(
    LogLevel.Fatal,
    `Échec du démarrage du bot : ${message}`,
    "Main",
  );
  process.exitCode = 1;
});
