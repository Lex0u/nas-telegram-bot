// src/monitors/docker-health.monitor.ts
import cron from "node-cron";
import type { Telegraf } from "telegraf";

import type { Secrets } from "../config/index.js";
import type { AppConfig } from "../config/schema.js";
import { sendToAllowedChat } from "../core/bot.js";
import { listContainerStatuses } from "../services/docker.service.js";
import type { ContainerStatus } from "../services/docker.service.js";

type WatchedState = "running" | "unhealthy" | "stopped";

const previousState = new Map<string, WatchedState>();

function toWatchedState(status: ContainerStatus): WatchedState {
  if (status.health === "unhealthy") return "unhealthy";
  if (status.state !== "running") return "stopped";
  return "running";
}

function transitionMessage(name: string, state: WatchedState): string | null {
  switch (state) {
    case "unhealthy":
      return `🔴 ${name} est passé unhealthy.`;
    case "stopped":
      return `🔴 ${name} s'est arrêté de manière inattendue.`;
    case "running":
      return `🟢 ${name} est de nouveau opérationnel.`;
  }
}

async function runDockerHealthCheck(
  bot: Telegraf,
  config: AppConfig,
  secrets: Secrets,
): Promise<void> {
  if (config.dockerContainers.length === 0) return;

  const statuses = await listContainerStatuses(config.dockerContainers);

  for (const status of statuses) {
    if (status.state === "unknown") continue; // conteneur introuvable, déjà loggé par le service

    const current = toWatchedState(status);
    const previous = previousState.get(status.name) ?? "running";
    if (current === previous) continue;

    previousState.set(status.name, current);
    const message = transitionMessage(status.name, current);
    if (message) {
      await sendToAllowedChat(bot, secrets, message);
    }
  }
}

export function scheduleDockerHealthMonitor(
  bot: Telegraf,
  config: AppConfig,
  secrets: Secrets,
): void {
  const cronExpression = `*/${config.monitoring.intervalMinutes} * * * *`;
  cron.schedule(cronExpression, () => {
    void runDockerHealthCheck(bot, config, secrets);
  });
}
