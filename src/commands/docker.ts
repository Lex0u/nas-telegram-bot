// src/commands/docker.ts
import { Markup } from "telegraf";
import type { Telegraf } from "telegraf";

import type { AppConfig } from "../config/schema.js";
import {
  getContainerLogs,
  listContainerStatuses,
  restartContainer,
  stopContainers,
} from "../services/docker.service.js";
import type { ContainerStatus } from "../services/docker.service.js";

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

function healthIcon(status: ContainerStatus): string {
  if (status.health === "healthy") return "🟢";
  if (status.health === "unhealthy") return "🔴";
  if (status.state !== "running") return "🔴";
  return "🟡";
}

function formatContainerLine(status: ContainerStatus): string {
  return `${healthIcon(status)} *${status.name}* — ${status.status}`;
}

export async function buildDockerStatusMessage(
  config: AppConfig,
): Promise<string> {
  if (config.dockerContainers.length === 0) {
    return "Aucun conteneur configuré.";
  }
  const statuses = await listContainerStatuses(config.dockerContainers);
  return statuses.map(formatContainerLine).join("\n");
}

function containerActionsKeyboard(config: AppConfig) {
  const rows = config.dockerContainers.map((name) => [
    Markup.button.callback(`🔄 ${name}`, `docker:restart:${name}`),
    Markup.button.callback(`📜 ${name}`, `docker:logs:${name}`),
  ]);
  rows.push([
    Markup.button.callback("🚨 Arrêt groupé", "docker:stop_all:confirm"),
  ]);
  return Markup.inlineKeyboard(rows);
}

export function registerDockerCommands(bot: Telegraf, config: AppConfig): void {
  bot.command("docker", async (ctx) => {
    const message = await buildDockerStatusMessage(config);
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...containerActionsKeyboard(config),
    });
  });

  bot.action("docker_status", async (ctx) => {
    await ctx.answerCbQuery();
    const message = await buildDockerStatusMessage(config);
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...containerActionsKeyboard(config),
    });
  });

  bot.action(/^docker:restart:(.+)$/, async (ctx) => {
    const name = ctx.match[1];
    if (!name) return;
    await ctx.answerCbQuery(`Redémarrage de ${name}...`);
    await restartContainer(name);
    await ctx.reply(`✅ ${name} redémarré.`);
  });

  bot.action(/^docker:logs:(.+)$/, async (ctx) => {
    const name = ctx.match[1];
    if (!name) return;
    await ctx.answerCbQuery();
    const logs = await getContainerLogs(name, 50);
    const truncated = logs.slice(-TELEGRAM_MAX_MESSAGE_LENGTH + 50);
    await ctx.reply(`Logs de ${name} :\n${truncated || "(aucun log)"}`);
  });

  bot.action("docker:stop_all:confirm", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      `⚠️ Confirmer l'arrêt des conteneurs suivants : ${config.dockerContainers.join(", ")} ?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Confirmer", "docker:stop_all:do"),
          Markup.button.callback("❌ Annuler", "cancel"),
        ],
      ]),
    );
  });

  bot.action("docker:stop_all:do", async (ctx) => {
    await ctx.answerCbQuery();
    await stopContainers(config.dockerContainers);
    await ctx.reply(
      `✅ Conteneurs arrêtés : ${config.dockerContainers.join(", ")}`,
    );
  });
}
