// src/commands/ping.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Telegraf } from "telegraf";

const execFileAsync = promisify(execFile);

// N'autorise que les hostnames/IP valides pour éviter toute injection de commande.
const VALID_HOST_PATTERN = /^[a-zA-Z0-9.-]+$/;

export function registerPingCommand(bot: Telegraf): void {
  bot.command("ping", async (ctx) => {
    const host = ctx.payload.trim();

    if (!host) {
      await ctx.reply("Usage : /ping <host_ou_ip>");
      return;
    }
    if (!VALID_HOST_PATTERN.test(host)) {
      await ctx.reply("Host invalide.");
      return;
    }

    try {
      const { stdout } = await execFileAsync("ping", [
        "-c",
        "4",
        "-W",
        "2",
        host,
      ]);
      await ctx.reply(`\`\`\`\n${stdout}\n\`\`\``, { parse_mode: "Markdown" });
    } catch (error) {
      const output = error instanceof Error ? error.message : "Aucune réponse";
      await ctx.reply(`\`\`\`\n${output}\n\`\`\``, { parse_mode: "Markdown" });
    }
  });
}
