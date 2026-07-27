// src/commands/menu.ts
import { LogLevel } from "@lex0u/logger";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Markup } from "telegraf";
import type { Telegraf } from "telegraf";

import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📊 Statut système", "status")],
    [Markup.button.callback("🐳 Statut Docker", "docker_status")],
    [
      Markup.button.callback(
        "🚨 Arrêt d'urgence Docker",
        "docker:stop_all:confirm",
      ),
    ],
    [Markup.button.callback("🔴 Arrêt général du Pi", "shutdown:confirm")],
  ]);
}

export function registerMenuCommands(bot: Telegraf): void {
  bot.command(["start", "menu"], async (ctx) => {
    await ctx.reply("Menu NAS — que veux-tu faire ?", mainMenuKeyboard());
  });

  bot.action("shutdown:confirm", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      "🔴 *ATTENTION* : ceci va éteindre complètement le Pi. Tu devras le " +
        "rebrancher physiquement pour le redémarrer. Confirmer ?",
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Oui, éteindre", "shutdown:do"),
            Markup.button.callback("❌ Annuler", "cancel"),
          ],
        ]),
      },
    );
  });

  bot.action("shutdown:do", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("🔴 Extinction du Pi en cours...");
    await logger.log.file(
      LogLevel.Fatal,
      "Extinction du Pi demandée via Telegram",
      "Menu",
    );
    await execFileAsync("sudo", ["shutdown", "-h", "now"]);
  });

  // Action générique d'annulation, réutilisée par plusieurs flux de confirmation.
  bot.action("cancel", async (ctx) => {
    await ctx.answerCbQuery("Annulé.");
  });
}
