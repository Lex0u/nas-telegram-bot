// src/services/docker.service.ts
import { LogLevel } from "@lex0u/logger";
import Docker from "dockerode";

import { logger } from "../utils/logger.js";
import { extractHealth, formatStatusText } from "./docker-format.js";
import type { ContainerHealth } from "./docker-format.js";

export type { ContainerHealth } from "./docker-format.js";
export { extractHealth, formatRelativeDuration } from "./docker-format.js";

let dockerClient: Docker | undefined;

function getDocker(): Docker {
	dockerClient ??= new Docker({ socketPath: "/var/run/docker.sock" });
	return dockerClient;
}

export interface ContainerStatus {
	name: string;
	state: string;
	status: string;
	health: ContainerHealth;
}

export async function listContainerStatuses(containerNames: string[]): Promise<ContainerStatus[]> {
	const results: ContainerStatus[] = [];

	for (const name of containerNames) {
		try {
			const container = getDocker().getContainer(name);
			const info = await container.inspect();

			results.push({
				name,
				state: info.State.Status,
				status: formatStatusText(info.State),
				health: extractHealth(info.State),
			});
		} catch (error) {
			await logger.log.file(LogLevel.Warning, `Conteneur introuvable ou inaccessible : ${name}`, "DockerService", {
				error: error instanceof Error ? error.message : String(error),
			});
			results.push({ name, state: "unknown", status: "introuvable", health: "none" });
		}
	}

	return results;
}

export async function restartContainer(name: string): Promise<void> {
	const container = getDocker().getContainer(name);
	await container.restart();
	await logger.log.file(LogLevel.Information, `Conteneur redémarré : ${name}`, "DockerService");
}

export async function restartContainers(names: string[]): Promise<void> {
	await Promise.all(names.map((name) => restartContainer(name)));
}

export async function stopContainers(names: string[]): Promise<void> {
	await Promise.all(names.map((name) => getDocker().getContainer(name).stop()));
	await logger.log.file(LogLevel.Warning, `Conteneurs arrêtés : ${names.join(", ")}`, "DockerService");
}

export async function getContainerLogs(name: string, tailLines = 50): Promise<string> {
	const container = getDocker().getContainer(name);
	const buffer = await container.logs({
		stdout: true,
		stderr: true,
		tail: tailLines,
		timestamps: true,
	});

	return buffer
		.toString("utf-8")
		.split("\n")
		.map((line) => line.slice(8))
		.join("\n")
		.trim();
}
