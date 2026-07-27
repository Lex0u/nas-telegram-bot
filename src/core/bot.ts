// src/core/bot.ts
import { LogLevel } from "@lex0u/logger";
import { Telegraf } from "telegraf";

import type { Secrets } from "../config/index.js";
import { logger } from "../utils/logger.js";

type SendMessageExtra = NonNullable<
  Parameters<Telegraf["telegram"]["sendMessage"]>[2]
>;

export function createBot(secrets: Secrets): Telegraf {
  const bot = new Telegraf(secrets.telegramToken);

  // N'accepte que les messages venant du chat autorisé. Les autres sont
  // ignorés silencieusement (pas de réponse, pour ne pas révéler l'existence du bot).
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined || String(chatId) !== secrets.telegramChatId) {
      await logger.log.file(
        LogLevel.Warning,
        `Message refusé d'un chat non autorisé : ${chatId === undefined ? "inconnu" : String(chatId)}`,
        "Bot",
      );
      return;
    }
    return next();
  });

  bot.catch((error, ctx) => {
    void logger.log.file(
      LogLevel.Error,
      `Erreur non gérée sur update ${String(ctx.updateType)}`,
      "Bot",
      { error: error instanceof Error ? error.message : String(error) },
    );
  });

  return bot;
}

export async function sendToAllowedChat(
  bot: Telegraf,
  secrets: Secrets,
  text: string,
  extra?: SendMessageExtra,
): Promise<void> {
  await bot.telegram.sendMessage(secrets.telegramChatId, text, extra);
}

export async function launchBot(bot: Telegraf): Promise<void> {
  process.once("SIGINT", () => {
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    bot.stop("SIGTERM");
  });

  await bot.launch();
}
