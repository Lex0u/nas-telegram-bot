// src/monitors/temperature.monitor.ts
import cron from "node-cron";
import type { Telegraf } from "telegraf";

import type { Secrets } from "../config/index.js";
import type { AppConfig } from "../config/schema.js";
import { sendToAllowedChat } from "../core/bot.js";
import { readAllDiskTemperatures } from "../services/disk.service.js";
import {
  recordDiskReadings,
  recordSystemStats,
} from "../services/history.service.js";
import { getSystemStats } from "../services/system.service.js";
import type { DiskStatus } from "../types/monitoring.js";

const previousDiskStatus = new Map<string, DiskStatus>();

function transitionMessage(
  name: string,
  status: DiskStatus,
  temp: number,
): string | null {
  switch (status) {
    case "critical":
      return `🔴 CRITIQUE : ${name} à ${temp}°C !`;
    case "warning":
      return `🟠 Attention : ${name} à ${temp}°C.`;
    case "ok":
      return `🟢 OK : ${name} redescendu à ${temp}°C.`;
    case "unreadable":
      return `⚠️ Lecture impossible pour ${name}.`;
  }
}

async function runTemperatureCheck(
  bot: Telegraf,
  config: AppConfig,
  secrets: Secrets,
): Promise<void> {
  const [diskReadings, systemStats] = await Promise.all([
    readAllDiskTemperatures(config.disks, config.thresholds),
    getSystemStats(),
  ]);

  recordDiskReadings(diskReadings);
  recordSystemStats(systemStats);

  for (const reading of diskReadings) {
    const previous = previousDiskStatus.get(reading.name) ?? "ok";
    if (reading.status === previous) continue;

    previousDiskStatus.set(reading.name, reading.status);
    if (reading.temperatureCelsius === null) continue;

    const message = transitionMessage(
      reading.name,
      reading.status,
      reading.temperatureCelsius,
    );
    if (message) {
      await sendToAllowedChat(bot, secrets, message);
    }
  }
}

export function scheduleTemperatureMonitor(
  bot: Telegraf,
  config: AppConfig,
  secrets: Secrets,
): void {
  const cronExpression = `*/${config.monitoring.intervalMinutes} * * * *`;
  cron.schedule(cronExpression, () => {
    void runTemperatureCheck(bot, config, secrets);
  });
}
