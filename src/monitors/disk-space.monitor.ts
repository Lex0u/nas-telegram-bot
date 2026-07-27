// src/monitors/disk-space.monitor.ts
import cron from "node-cron";
import { statfsSync } from "node:fs";
import type { Telegraf } from "telegraf";

import type { Secrets } from "../config/index.js";
import type { AppConfig, Disk } from "../config/schema.js";
import { sendToAllowedChat } from "../core/bot.js";
import { logger } from "../utils/logger.js";
import { LogLevel } from "@lex0u/logger";

const previousAlertState = new Map<string, boolean>();

function usedPercent(mountPath: string): number | null {
  try {
    const stats = statfsSync(mountPath);
    const totalBlocks = Number(stats.blocks);
    const freeBlocks = Number(stats.bfree);
    if (totalBlocks === 0) return null;
    return ((totalBlocks - freeBlocks) / totalBlocks) * 100;
  } catch {
    return null;
  }
}

async function checkDisk(
  disk: Disk,
  bot: Telegraf,
  secrets: Secrets,
  warningThresholdPercent: number,
): Promise<void> {
  if (!disk.mountPath) return;

  const percent = usedPercent(disk.mountPath);
  if (percent === null) {
    await logger.log.file(
      LogLevel.Warning,
      `Impossible de lire l'espace disque de ${disk.mountPath}`,
      "DiskSpaceMonitor",
    );
    return;
  }

  const isOverThreshold = percent >= warningThresholdPercent;
  const wasOverThreshold = previousAlertState.get(disk.name) ?? false;

  if (isOverThreshold === wasOverThreshold) return;
  previousAlertState.set(disk.name, isOverThreshold);

  const roundedPercent = Math.round(percent * 10) / 10;
  const message = isOverThreshold
    ? `🟠 Espace disque faible sur ${disk.name} (${disk.mountPath}) : ${roundedPercent}% utilisé.`
    : `🟢 Espace disque redescendu sous le seuil sur ${disk.name} : ${roundedPercent}% utilisé.`;

  await sendToAllowedChat(bot, secrets, message);
}

async function runDiskSpaceCheck(
  bot: Telegraf,
  config: AppConfig,
  secrets: Secrets,
): Promise<void> {
  await Promise.all(
    config.disks.map((disk) =>
      checkDisk(disk, bot, secrets, config.thresholds.diskSpaceWarningPercent),
    ),
  );
}

export function scheduleDiskSpaceMonitor(
  bot: Telegraf,
  config: AppConfig,
  secrets: Secrets,
): void {
  const cronExpression = `*/${config.monitoring.intervalMinutes} * * * *`;
  cron.schedule(cronExpression, () => {
    void runDiskSpaceCheck(bot, config, secrets);
  });
}
