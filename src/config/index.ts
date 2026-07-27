// src/config/index.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import "dotenv/config";

import { configSchema, type AppConfig } from "./schema.js";

const CONFIG_PATH = resolve(process.cwd(), "config.json");

export interface Secrets {
  telegramToken: string;
  telegramChatId: string;
}

function loadSecrets(): Secrets {
  const telegramToken = process.env["TELEGRAM_TOKEN"];
  const telegramChatId = process.env["TELEGRAM_CHAT_ID"];

  if (!telegramToken || !telegramChatId) {
    throw new Error(
      "TELEGRAM_TOKEN et TELEGRAM_CHAT_ID doivent être définis dans .env " +
        "(voir .env.example)",
    );
  }

  return { telegramToken, telegramChatId };
}

function loadAppConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Aucun config.json trouvé à la racine du projet. ` +
        `Lance d'abord "npm run setup" pour générer ta configuration.`,
    );
  }

  const raw: unknown = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  const parsed = configSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(`config.json invalide :\n${parsed.error.toString()}`);
  }

  return parsed.data;
}

export function loadConfig(): { app: AppConfig; secrets: Secrets } {
  return {
    app: loadAppConfig(),
    secrets: loadSecrets(),
  };
}

export { CONFIG_PATH };
export type { AppConfig };
