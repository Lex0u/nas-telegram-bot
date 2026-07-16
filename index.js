require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { exec, execSync } = require("child_process");
const os = require("os");

// ==== CONFIGURATION ====
const TOKEN = process.env.TELEGRAM_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // string, ex: "6595230646"

if (!TOKEN || !ALLOWED_CHAT_ID) {
  console.error(
    "TELEGRAM_TOKEN et TELEGRAM_CHAT_ID doivent être définis dans .env",
  );
  process.exit(1);
}

// Disques à surveiller : nom affiché -> device
const DISKS = {
  Jeux: "/dev/sda",
  Animes: "/dev/sdb",
};

// Conteneurs Docker qui sollicitent le disque (utilisés pour l'arrêt d'urgence ciblé)
const DISK_CONTAINERS = ["shoko", "jellyfin", "samba", "homarr"];

const TEMP_WARNING = 45;
const TEMP_CRITICAL = 50;

const bot = new TelegramBot(TOKEN, { polling: true });

// ==== SÉCURITÉ : n'accepte que les messages venant du chat autorisé ====
function isAuthorized(msg) {
  return String(msg.chat.id) === String(ALLOWED_CHAT_ID);
}

// ==== HELPERS ====

function getDiskTemp(device) {
  try {
    const out = execSync(
      `sudo smartctl -a -d sat ${device} 2>/dev/null || sudo smartctl -a ${device} 2>/dev/null`,
    ).toString();
    const match = out.match(/^194\s+Temperature_Celsius.*$/m);
    if (!match) return null;
    const parts = match[0].trim().split(/\s+/);
    return parseInt(parts[9], 10); // colonne "RAW_VALUE" -> température
  } catch (e) {
    return null;
  }
}

function getSystemStats() {
  const load = os.loadavg(); // [1min, 5min, 15min]
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPct = (((totalMem - freeMem) / totalMem) * 100).toFixed(1);
  const cpuCount = os.cpus().length;

  let cpuTemp = null;
  try {
    const raw = execSync("cat /sys/class/thermal/thermal_zone0/temp")
      .toString()
      .trim();
    cpuTemp = (parseInt(raw, 10) / 1000).toFixed(1);
  } catch (e) {
    // pas de capteur dispo
  }

  return { load, usedMemPct, cpuCount, cpuTemp };
}

function buildStatusMessage() {
  let msg = "📊 *Statut système*\n\n";

  msg += "*Disques :*\n";
  for (const [name, device] of Object.entries(DISKS)) {
    const temp = getDiskTemp(device);
    if (temp === null) {
      msg += `• ${name} (${device}) : ⚠️ lecture impossible\n`;
    } else {
      const icon =
        temp >= TEMP_CRITICAL ? "🔴" : temp >= TEMP_WARNING ? "🟠" : "🟢";
      msg += `• ${name} (${device}) : ${icon} ${temp}°C\n`;
    }
  }

  const stats = getSystemStats();
  msg += "\n*Système :*\n";
  msg += `• CPU load (1/5/15 min) : ${stats.load.map((l) => l.toFixed(2)).join(" / ")} (${stats.cpuCount} coeurs)\n`;
  msg += `• RAM utilisée : ${stats.usedMemPct}%\n`;
  if (stats.cpuTemp) {
    msg += `• Température CPU : ${stats.cpuTemp}°C\n`;
  }

  return msg;
}

function getDockerStatus() {
  try {
    const out = execSync('docker ps --format "{{.Names}}|{{.Status}}"')
      .toString()
      .trim();
    if (!out) return "Aucun conteneur actif.";
    return out
      .split("\n")
      .map((line) => {
        const [name, status] = line.split("|");
        const icon = status.includes("healthy")
          ? "🟢"
          : status.includes("unhealthy")
            ? "🔴"
            : "🟡";
        return `${icon} *${name}* — ${status}`;
      })
      .join("\n");
  } catch (e) {
    return `Erreur lecture Docker : ${e.message}`;
  }
}

// ==== MENU PRINCIPAL ====

function mainMenuKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Statut système", callback_data: "status" }],
        [{ text: "🐳 Statut Docker", callback_data: "docker_status" }],
        [
          {
            text: "🚨 Arrêt d'urgence Docker",
            callback_data: "confirm_docker_stop",
          },
        ],
        [{ text: "🔴 Arrêt général du Pi", callback_data: "confirm_shutdown" }],
      ],
    },
  };
}

bot.onText(/\/start|\/menu/, (msg) => {
  if (!isAuthorized(msg)) return;
  bot.sendMessage(
    msg.chat.id,
    "Menu NAS — que veux-tu faire ?",
    mainMenuKeyboard(),
  );
});

bot.onText(/\/status/, (msg) => {
  if (!isAuthorized(msg)) return;
  bot.sendMessage(msg.chat.id, buildStatusMessage(), {
    parse_mode: "Markdown",
  });
});

// /ping <host>
bot.onText(/\/ping(?:\s+(.+))?/, (msg, match) => {
  if (!isAuthorized(msg)) return;
  const host = (match[1] || "").trim();
  if (!host) {
    bot.sendMessage(msg.chat.id, "Usage : /ping <host_ou_ip>");
    return;
  }
  // Validation simple pour éviter l'injection de commande
  if (!/^[a-zA-Z0-9.\-]+$/.test(host)) {
    bot.sendMessage(msg.chat.id, "Host invalide.");
    return;
  }
  exec(`ping -c 4 -W 2 ${host}`, (err, stdout, stderr) => {
    const result = stdout || stderr || "Aucune réponse";
    bot.sendMessage(msg.chat.id, `\`\`\`\n${result}\n\`\`\``, {
      parse_mode: "Markdown",
    });
  });
});

// ==== GESTION DES BOUTONS ====

bot.on("callback_query", async (query) => {
  if (String(query.message.chat.id) !== String(ALLOWED_CHAT_ID)) return;

  const chatId = query.message.chat.id;
  const data = query.data;

  switch (data) {
    case "status":
      await bot.sendMessage(chatId, buildStatusMessage(), {
        parse_mode: "Markdown",
      });
      break;

    case "docker_status":
      await bot.sendMessage(chatId, getDockerStatus(), {
        parse_mode: "Markdown",
      });
      break;

    case "confirm_docker_stop":
      await bot.sendMessage(
        chatId,
        `⚠️ Confirmer l'arrêt des conteneurs suivants : ${DISK_CONTAINERS.join(", ")} ?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Confirmer", callback_data: "do_docker_stop" },
                { text: "❌ Annuler", callback_data: "cancel" },
              ],
            ],
          },
        },
      );
      break;

    case "do_docker_stop":
      exec(
        `docker stop ${DISK_CONTAINERS.join(" ")}`,
        async (err, stdout, stderr) => {
          if (err) {
            await bot.sendMessage(
              chatId,
              `❌ Erreur : ${stderr || err.message}`,
            );
          } else {
            await bot.sendMessage(
              chatId,
              `✅ Conteneurs arrêtés : ${DISK_CONTAINERS.join(", ")}`,
            );
          }
        },
      );
      break;

    case "confirm_shutdown":
      await bot.sendMessage(
        chatId,
        "🔴 *ATTENTION* : ceci va éteindre complètement le Pi. Tu devras le rebrancher physiquement pour le redémarrer. Confirmer ?",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Oui, éteindre", callback_data: "do_shutdown" },
                { text: "❌ Annuler", callback_data: "cancel" },
              ],
            ],
          },
        },
      );
      break;

    case "do_shutdown":
      await bot.sendMessage(chatId, "🔴 Extinction du Pi en cours...");
      exec("sudo shutdown -h now");
      break;

    case "cancel":
      await bot.sendMessage(chatId, "Annulé.");
      break;

    default:
      break;
  }

  bot.answerCallbackQuery(query.id);
});

// ==== SURVEILLANCE PÉRIODIQUE (température) ====

const alertState = {};

function checkTemperatures() {
  for (const [name, device] of Object.entries(DISKS)) {
    const temp = getDiskTemp(device);
    if (temp === null) continue;

    const prevState = alertState[name] || "normal";
    let newState = "normal";
    if (temp >= TEMP_CRITICAL) newState = "critical";
    else if (temp >= TEMP_WARNING) newState = "warning";

    if (newState !== prevState) {
      let text;
      if (newState === "critical") text = `🔴 CRITIQUE : ${name} à ${temp}°C !`;
      else if (newState === "warning")
        text = `🟠 Attention : ${name} à ${temp}°C.`;
      else text = `🟢 OK : ${name} redescendu à ${temp}°C.`;

      bot.sendMessage(ALLOWED_CHAT_ID, text);
      alertState[name] = newState;
    }
  }
}

setInterval(checkTemperatures, 5 * 60 * 1000); // toutes les 5 minutes

console.log("Bot NAS démarré.");
bot.sendMessage(
  ALLOWED_CHAT_ID,
  "🤖 Bot NAS démarré et opérationnel.\nEnvoie /menu pour voir les options.",
);
