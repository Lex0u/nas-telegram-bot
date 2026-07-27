// src/commands/status.ts
import type { Telegraf } from "telegraf";

import type { AppConfig } from "../config/schema.js";
import { readAllDiskTemperatures } from "../services/disk.service.js";
import { getSystemStats } from "../services/system.service.js";
import type { DiskReading, SystemStats } from "../types/monitoring.js";

function diskStatusIcon(status: DiskReading["status"]): string {
  switch (status) {
    case "critical":
      return "🔴";
    case "warning":
      return "🟠";
    case "ok":
      return "🟢";
    case "unreadable":
      return "⚠️";
  }
}

function formatDiskLine(reading: DiskReading): string {
  if (reading.temperatureCelsius === null) {
    return `• ${reading.name} (${reading.device}) : ⚠️ lecture impossible`;
  }
  return (
    `• ${reading.name} (${reading.device}) : ` +
    `${diskStatusIcon(reading.status)} ${reading.temperatureCelsius}°C`
  );
}

function formatSystemSection(stats: SystemStats): string {
  const load = stats.loadAvg.map((value) => value.toFixed(2)).join(" / ");
  let section = "\n*Système :*\n";
  section += `• CPU load (1/5/15 min) : ${load} (${stats.cpuCount} coeurs)\n`;
  section += `• RAM utilisée : ${stats.usedMemPercent}%\n`;
  if (stats.cpuTempCelsius !== null) {
    section += `• Température CPU : ${stats.cpuTempCelsius.toFixed(1)}°C\n`;
  }
  return section;
}

export async function buildStatusMessage(config: AppConfig): Promise<string> {
  const [diskReadings, systemStats] = await Promise.all([
    readAllDiskTemperatures(config.disks, config.thresholds),
    getSystemStats(),
  ]);

  const diskSection =
    diskReadings.length > 0
      ? diskReadings.map(formatDiskLine).join("\n")
      : "Aucun disque configuré.";

  return `📊 *Statut système*\n\n*Disques :*\n${diskSection}\n${formatSystemSection(systemStats)}`;
}

export function registerStatusCommand(bot: Telegraf, config: AppConfig): void {
  bot.command("status", async (ctx) => {
    const message = await buildStatusMessage(config);
    await ctx.reply(message, { parse_mode: "Markdown" });
  });

  bot.action("status", async (ctx) => {
    await ctx.answerCbQuery();
    const message = await buildStatusMessage(config);
    await ctx.reply(message, { parse_mode: "Markdown" });
  });
}
