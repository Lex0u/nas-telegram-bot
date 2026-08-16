// src/monitors/temperature.monitor.ts
import cron from "node-cron";
import type { Telegraf } from "telegraf";

import type { Secrets } from "../config/index.js";
import type { AppConfig, Disk } from "../config/schema.js";
import { sendToAllowedChat } from "../core/bot.js";
import { readAllDiskTemperatures, spinDownDisk } from "../services/disk.service.js";
import { recordDiskReadings, recordSystemStats } from "../services/history.service.js";
import { getSystemStats } from "../services/system.service.js";
import { restartContainers, stopContainers } from "../services/docker.service.js";
import { logger } from "../utils/logger.js";
import { LogLevel } from "@lex0u/logger";
import type { DiskStatus } from "../types/monitoring.js";

const previousDiskStatus = new Map<string, DiskStatus>();

// Disques actuellement mis en pause (conteneurs arrêtés + disque en veille)
// suite à un passage en température critique.
const pausedDisks = new Set<string>();

function transitionMessage(name: string, status: DiskStatus, temp: number): string | null {
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

/**
 * Arrête les conteneurs qui sollicitent ce disque et le met en veille physique
 * (spin-down) pour le laisser refroidir. Idempotent : ne fait rien si le
 * disque est déjà en pause ou si aucun conteneur n'est configuré pour lui.
 */
async function pauseDiskForCooling(disk: Disk, bot: Telegraf, secrets: Secrets): Promise<void> {
	if (disk.pauseOnCriticalTemp.length === 0 || pausedDisks.has(disk.name)) return;

	pausedDisks.add(disk.name);

	try {
		await stopContainers(disk.pauseOnCriticalTemp);
		await spinDownDisk(disk.device);
		await sendToAllowedChat(
			bot,
			secrets,
			`⏸️ ${disk.name} en pause pour refroidissement : ${disk.pauseOnCriticalTemp.join(", ")} ` +
				`arrêté(s), disque mis en veille. Reprise automatique une fois la température normale.`,
		);
	} catch (error) {
		await logger.log.file(LogLevel.Error, `Échec de la mise en pause de ${disk.name}`, "TemperatureMonitor", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Redémarre les conteneurs mis en pause pour ce disque, une fois la
 * température revenue à "ok". Pas d'action explicite de "réveil" du disque
 * nécessaire : toute I/O des conteneurs redémarrés le réveille automatiquement.
 */
async function resumeDiskAfterCooling(disk: Disk, bot: Telegraf, secrets: Secrets): Promise<void> {
	if (!pausedDisks.has(disk.name)) return;

	pausedDisks.delete(disk.name);

	try {
		await restartContainers(disk.pauseOnCriticalTemp);
		await sendToAllowedChat(
			bot,
			secrets,
			`▶️ ${disk.name} revenu à une température normale : ` + `${disk.pauseOnCriticalTemp.join(", ")} redémarré(s).`,
		);
	} catch (error) {
		await logger.log.file(LogLevel.Error, `Échec de la reprise de ${disk.name}`, "TemperatureMonitor", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

async function runTemperatureCheck(bot: Telegraf, config: AppConfig, secrets: Secrets): Promise<void> {
	const [diskReadings, systemStats] = await Promise.all([readAllDiskTemperatures(config.disks, config.thresholds), getSystemStats()]);

	recordDiskReadings(diskReadings);
	recordSystemStats(systemStats);

	const disksByName = new Map(config.disks.map((disk) => [disk.name, disk]));

	for (const reading of diskReadings) {
		const previous = previousDiskStatus.get(reading.name) ?? "ok";
		const disk = disksByName.get(reading.name);

		if (reading.status !== previous) {
			previousDiskStatus.set(reading.name, reading.status);

			if (reading.temperatureCelsius !== null) {
				const message = transitionMessage(reading.name, reading.status, reading.temperatureCelsius);
				if (message) {
					await sendToAllowedChat(bot, secrets, message);
				}
			}
		}

		if (!disk) continue;

		if (reading.status === "critical") {
			await pauseDiskForCooling(disk, bot, secrets);
		} else if (reading.status === "ok") {
			await resumeDiskAfterCooling(disk, bot, secrets);
		}
	}
}

export function scheduleTemperatureMonitor(bot: Telegraf, config: AppConfig, secrets: Secrets): void {
	const cronExpression = `*/${config.monitoring.intervalMinutes} * * * *`;
	cron.schedule(cronExpression, () => {
		void runTemperatureCheck(bot, config, secrets);
	});
}
