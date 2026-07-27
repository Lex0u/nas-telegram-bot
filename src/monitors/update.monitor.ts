// src/monitors/update.monitor.ts
import { LogLevel } from "@lex0u/logger";
import Docker from "dockerode";
import cron from "node-cron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Telegraf } from "telegraf";

import type { Secrets } from "../config/index.js";
import type { AppConfig } from "../config/schema.js";
import { sendToAllowedChat } from "../core/bot.js";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

async function countAptUpgrades(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("apt", ["list", "--upgradable"]);
    return stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0 && !line.startsWith("Listing..."))
      .length;
  } catch {
    // "apt" absent (pas une Debian/RPi OS) ou aucune sortie exploitable : on ignore.
    return null;
  }
}

async function pullImage(imageRef: string): Promise<void> {
  const stream = await docker.pull(imageRef);
  await new Promise<void>((resolvePull, rejectPull) => {
    stream.on("end", () => {
      resolvePull();
    });
    stream.on("error", (error: Error) => {
      rejectPull(error);
    });
    stream.resume();
  });
}

async function hasImageUpdate(containerName: string): Promise<boolean> {
  const container = docker.getContainer(containerName);
  const info = await container.inspect();
  const imageRef = info.Config.Image;
  const currentImageId = info.Image;

  await pullImage(imageRef);

  const freshImage = await docker.getImage(imageRef).inspect();
  return freshImage.Id !== currentImageId;
}

async function runUpdateCheck(
  bot: Telegraf,
  config: AppConfig,
  secrets: Secrets,
): Promise<void> {
  const aptCount = await countAptUpgrades();
  if (aptCount !== null && aptCount > 0) {
    await sendToAllowedChat(
      bot,
      secrets,
      `📦 ${aptCount} mise(s) à jour système disponible(s) (apt).`,
    );
  }

  for (const name of config.dockerContainers) {
    try {
      if (await hasImageUpdate(name)) {
        await sendToAllowedChat(
          bot,
          secrets,
          `🆕 Nouvelle image disponible pour ${name} — redémarre-le pour l'appliquer.`,
        );
      }
    } catch (error) {
      await logger.log.file(
        LogLevel.Warning,
        `Vérification de mise à jour échouée pour ${name}`,
        "UpdateMonitor",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }
}

export function scheduleUpdateMonitor(
  bot: Telegraf,
  config: AppConfig,
  secrets: Secrets,
): void {
  // Une fois par jour à 6h : un pull par conteneur suivi coûte réseau/disque,
  // pas question de le faire au même rythme que les checks de température.
  cron.schedule("0 6 * * *", () => {
    void runUpdateCheck(bot, config, secrets);
  });
}
