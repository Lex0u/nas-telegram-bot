// src/services/docker.service.ts
import { LogLevel } from "@lex0u/logger";
import Docker from "dockerode";
import type { ContainerInspectInfo } from "dockerode";

import { logger } from "../utils/logger.js";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export type ContainerHealth = "healthy" | "unhealthy" | "starting" | "none";

export interface ContainerStatus {
  name: string;
  state: string; // "running", "exited", "restarting"...
  status: string; // texte lisible, ex: "Up 3 hours"
  health: ContainerHealth;
}

function extractHealth(
  inspectState: ContainerInspectInfo["State"],
): ContainerHealth {
  const status = inspectState.Health?.Status;
  if (status === "healthy" || status === "unhealthy" || status === "starting") {
    return status;
  }
  return "none";
}

function formatRelativeDuration(isoTimestamp: string): string {
  const elapsedMs = Date.now() - new Date(isoTimestamp).getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  if (elapsedSeconds < 60) return "moins d'une minute";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes} min`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} h`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} j`;
}

function formatStatusText(state: ContainerInspectInfo["State"]): string {
  const health = extractHealth(state);
  const healthSuffix = health === "none" ? "" : ` (${health})`;

  if (state.Running) {
    return `Up depuis ${formatRelativeDuration(state.StartedAt)}${healthSuffix}`;
  }
  return `Arrêté depuis ${formatRelativeDuration(state.FinishedAt)}`;
}

export async function listContainerStatuses(
  containerNames: string[],
): Promise<ContainerStatus[]> {
  const results: ContainerStatus[] = [];

  for (const name of containerNames) {
    try {
      const container = docker.getContainer(name);
      const info = await container.inspect();

      results.push({
        name,
        state: info.State.Status,
        status: formatStatusText(info.State),
        health: extractHealth(info.State),
      });
    } catch (error) {
      await logger.log.file(
        LogLevel.Warning,
        `Conteneur introuvable ou inaccessible : ${name}`,
        "DockerService",
        { error: error instanceof Error ? error.message : String(error) },
      );
      results.push({
        name,
        state: "unknown",
        status: "introuvable",
        health: "none",
      });
    }
  }

  return results;
}

export async function restartContainer(name: string): Promise<void> {
  const container = docker.getContainer(name);
  await container.restart();
  await logger.log.file(
    LogLevel.Information,
    `Conteneur redémarré : ${name}`,
    "DockerService",
  );
}

export async function stopContainers(names: string[]): Promise<void> {
  await Promise.all(names.map((name) => docker.getContainer(name).stop()));
  await logger.log.file(
    LogLevel.Warning,
    `Conteneurs arrêtés : ${names.join(", ")}`,
    "DockerService",
  );
}

export async function getContainerLogs(
  name: string,
  tailLines = 50,
): Promise<string> {
  const container = docker.getContainer(name);
  const buffer = await container.logs({
    stdout: true,
    stderr: true,
    tail: tailLines,
    timestamps: true,
  });

  // dockerode préfixe chaque ligne de 8 octets d'en-tête multiplexé stdout/stderr.
  return buffer
    .toString("utf-8")
    .split("\n")
    .map((line) => line.slice(8))
    .join("\n")
    .trim();
}
