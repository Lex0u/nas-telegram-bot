// src/monitors/index.ts
import cron from "node-cron";
import type { Telegraf } from "telegraf";

import type { Secrets } from "../config/index.js";
import type { AppConfig } from "../config/schema.js";
import { pruneOldReadings } from "../services/history.service.js";
import { scheduleDiskSpaceMonitor } from "./disk-space.monitor.js";
import { scheduleDockerHealthMonitor } from "./docker-health.monitor.js";
import { scheduleTemperatureMonitor } from "./temperature.monitor.js";
import { scheduleUpdateMonitor } from "./update.monitor.js";

export function registerMonitors(
  bot: Telegraf,
  config: AppConfig,
  secrets: Secrets,
): void {
  scheduleTemperatureMonitor(bot, config, secrets);
  scheduleDiskSpaceMonitor(bot, config, secrets);
  scheduleDockerHealthMonitor(bot, config, secrets);
  scheduleUpdateMonitor(bot, config, secrets);

  // Purge quotidienne à 4h, avant le check de mises à jour de 6h.
  cron.schedule("0 4 * * *", () => {
    void pruneOldReadings(config.monitoring.historyRetentionDays);
  });
}
