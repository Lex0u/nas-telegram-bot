// src/cli/setup.ts
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  password,
  text,
} from "@clack/prompts";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { CONFIG_PATH } from "../config/index.js";
import { configSchema } from "../config/schema.js";
import type { Disk, Thresholds } from "../config/schema.js";
import { formatBytes, readDiskSpaceUsage } from "../services/disk.service.js";

const ENV_PATH = resolve(process.cwd(), ".env");

async function promptOrExit<T>(promise: Promise<T | symbol>): Promise<T> {
  const result = await promise;
  if (isCancel(result)) {
    cancel("Configuration annulée.");
    process.exit(0);
  }
  return result;
}

function validateInteger(value: string): string | undefined {
  return /^\d+$/.test(value) ? undefined : "Doit être un nombre entier positif";
}

async function collectSecrets(): Promise<void> {
  if (existsSync(ENV_PATH)) {
    const overwrite = await promptOrExit(
      confirm({
        message: ".env existe déjà — le remplacer ?",
        initialValue: false,
      }),
    );
    if (!overwrite) {
      log.step(".env conservé tel quel.");
      return;
    }
  }

  const telegramToken = await promptOrExit(
    password({ message: "Token du bot Telegram (obtenu via @BotFather)" }),
  );
  const telegramChatId = await promptOrExit(
    text({
      message: "Chat ID Telegram autorisé",
      validate: (value) =>
        /^-?\d+$/.test(value)
          ? undefined
          : "Doit être un identifiant numérique",
    }),
  );

  writeFileSync(
    ENV_PATH,
    `TELEGRAM_TOKEN=${telegramToken}\nTELEGRAM_CHAT_ID=${telegramChatId}\n`,
  );
  log.success(".env écrit.");
}

async function collectDisks(): Promise<Disk[]> {
  const disks: Disk[] = [];

  let addMore = await promptOrExit(
    confirm({
      message: "Ajouter un disque à surveiller ?",
      initialValue: true,
    }),
  );

  while (addMore) {
    const name = await promptOrExit(
      text({
        message: "Nom du disque (ex: Jeux)",
        validate: (value) => (value.trim() ? undefined : "Requis"),
      }),
    );
    const device = await promptOrExit(
      text({
        message: "Device (ex: /dev/sda)",
        validate: (value) =>
          /^\/dev\/[a-zA-Z0-9]+$/.test(value)
            ? undefined
            : "Format attendu : /dev/sdX",
      }),
    );
    const wantsSpaceMonitoring = await promptOrExit(
      confirm({
        message: "Activer le suivi d'espace disque pour ce disque ?",
        initialValue: false,
      }),
    );

    let mountPath: string | undefined;
    if (wantsSpaceMonitoring) {
      mountPath = await promptOrExit(
        text({
          message: "Point de montage (ex: /mnt/animes)",
          validate: (value) =>
            value.startsWith("/") ? undefined : "Doit commencer par /",
        }),
      );

      const usage = readDiskSpaceUsage({ name, device, mountPath });
      if (usage) {
        const usedBytes = usage.totalBytes - usage.freeBytes;
        log.info(
          `Espace utilisé sur ${mountPath} : ${formatBytes(usedBytes)} / ` +
            `${formatBytes(usage.totalBytes)} (${usage.usedPercent.toFixed(1)}%)`,
        );
      } else {
        log.warn(
          `Impossible de lire l'espace disque sur ${mountPath} — vérifie le point de montage.`,
        );
      }
    }

    disks.push(mountPath ? { name, device, mountPath } : { name, device });

    addMore = await promptOrExit(
      confirm({ message: "Ajouter un autre disque ?", initialValue: false }),
    );
  }

  return disks;
}

async function collectDockerContainers(): Promise<string[]> {
  const raw = await promptOrExit(
    text({
      message:
        "Conteneurs Docker à surveiller (noms séparés par des virgules, vide si aucun)",
      placeholder: "jellyfin,shoko,samba",
      defaultValue: "",
    }),
  );

  return raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

async function collectThresholds(): Promise<Thresholds> {
  const diskTempWarning = await promptOrExit(
    text({
      message: "Seuil température disque — avertissement (°C)",
      initialValue: "45",
      validate: validateInteger,
    }),
  );
  const diskTempCritical = await promptOrExit(
    text({
      message: "Seuil température disque — critique (°C)",
      initialValue: "50",
      validate: validateInteger,
    }),
  );
  const diskSpaceWarningPercent = await promptOrExit(
    text({
      message: "Seuil d'espace disque utilisé — avertissement (%)",
      initialValue: "85",
      validate: validateInteger,
    }),
  );

  return {
    diskTempWarning: Number.parseInt(diskTempWarning, 10),
    diskTempCritical: Number.parseInt(diskTempCritical, 10),
    diskSpaceWarningPercent: Number.parseInt(diskSpaceWarningPercent, 10),
  };
}

async function collectMonitoringSettings(): Promise<{
  intervalMinutes: number;
  historyRetentionDays: number;
}> {
  const intervalMinutes = await promptOrExit(
    text({
      message: "Fréquence des checks de monitoring (minutes)",
      initialValue: "5",
      validate: validateInteger,
    }),
  );
  const historyRetentionDays = await promptOrExit(
    text({
      message: "Rétention de l'historique (jours)",
      initialValue: "30",
      validate: validateInteger,
    }),
  );

  return {
    intervalMinutes: Number.parseInt(intervalMinutes, 10),
    historyRetentionDays: Number.parseInt(historyRetentionDays, 10),
  };
}

async function main(): Promise<void> {
  intro("🛠️  Configuration du bot NAS Telegram");

  if (existsSync(CONFIG_PATH)) {
    const overwrite = await promptOrExit(
      confirm({
        message: "config.json existe déjà — le remplacer ?",
        initialValue: false,
      }),
    );
    if (!overwrite) {
      outro("Configuration inchangée.");
      return;
    }
  }

  await collectSecrets();

  const disks = await collectDisks();
  const dockerContainers = await collectDockerContainers();
  const thresholds = await collectThresholds();
  const monitoring = await collectMonitoringSettings();

  const parsed = configSchema.safeParse({
    disks,
    dockerContainers,
    thresholds,
    monitoring,
  });

  if (!parsed.success) {
    log.error(parsed.error.toString());
    cancel("Configuration invalide, rien n'a été écrit dans config.json.");
    process.exit(1);
  }

  writeFileSync(CONFIG_PATH, `${JSON.stringify(parsed.data, null, 2)}\n`);
  outro(
    "✅ Configuration terminée. Lance `npm run dev` (ou `npm start`) pour démarrer le bot.",
  );
}

main().catch((error: unknown) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
