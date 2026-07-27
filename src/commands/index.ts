// src/commands/index.ts
import type { Telegraf } from "telegraf";

import type { AppConfig } from "../config/schema.js";
import { registerDockerCommands } from "./docker.js";
import { registerMenuCommands } from "./menu.js";
import { registerPingCommand } from "./ping.js";
import { registerStatusCommand } from "./status.js";

export function registerCommands(bot: Telegraf, config: AppConfig): void {
  registerMenuCommands(bot);
  registerStatusCommand(bot, config);
  registerDockerCommands(bot, config);
  registerPingCommand(bot);
}
