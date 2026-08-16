// src/commands/status.ts
import type { Telegraf } from "telegraf";

import type { AppConfig } from "../config/schema.js";
import {
  formatBytes,
  readAllDiskSpaceUsage,
  readAllDiskTemperatures,
} from "../services/disk.service.js";
import type { DiskSpaceUsage } from "../services/disk.service.js";
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

function formatSpaceSuffix(usage: DiskSpaceUsage | undefined): string {
  if (!usage) return "";
  const usedBytes = usage.totalBytes - usage.freeBytes;
  const roundedPercent = Math.round(usage.usedPercent * 10) / 10;
  return ` — ${roundedPercent}% utilisé (${formatBytes(usedBytes)} / ${formatBytes(usage.totalBytes)})`;
}

function formatDiskLine(
  reading: DiskReading,
  spaceByName: Map<string, DiskSpaceUsage>,
): string {
  const spaceSuffix = formatSpaceSuffix(spaceByName.get(reading.name));

  if (reading.temperatureCelsius === null) {
    return `• ${reading.name} (${reading.device}) : ⚠️ lecture impossible${spaceSuffix}`;
  }
  return (
    `• ${reading.name} (${reading.device}) : ` +
    `${diskStatusIcon(reading.status)} ${reading.temperatureCelsius}°C${spaceSuffix}`
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
  const spaceByName = new Map(
    readAllDiskSpaceUsage(config.disks).map((usage) => [usage.name, usage]),
  );

  const diskSection =
    diskReadings.length > 0
      ? diskReadings
          .map((reading) => formatDiskLine(reading, spaceByName))
          .join("\n")
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
