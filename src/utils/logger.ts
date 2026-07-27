// src/utils/logger.ts
import { Logger } from "@lex0u/logger";

/**
 * Instance de log partagée par tout le projet.
 * Sortie console (dev) + fichier (data/logs) par défaut.
 * Une sortie Discord pourra être branchée ici plus tard pour les alertes
 * critiques, en parallèle des notifications Telegram — voir setDiscordClient().
 */
export const logger = new Logger({
  console: { enabled: true },
  file: { enabled: true, folderPath: "./data/logs" },
});
