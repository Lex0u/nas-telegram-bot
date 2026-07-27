// src/services/docker-format.ts
import type { ContainerInspectInfo } from "dockerode";

export type ContainerHealth = "healthy" | "unhealthy" | "starting" | "none";

export function extractHealth(
  inspectState: ContainerInspectInfo["State"],
): ContainerHealth {
  const status = inspectState.Health?.Status;
  if (status === "healthy" || status === "unhealthy" || status === "starting") {
    return status;
  }
  return "none";
}

export function formatRelativeDuration(isoTimestamp: string): string {
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

export function formatStatusText(state: ContainerInspectInfo["State"]): string {
  const health = extractHealth(state);
  const healthSuffix = health === "none" ? "" : ` (${health})`;

  if (state.Running) {
    return `Up depuis ${formatRelativeDuration(state.StartedAt)}${healthSuffix}`;
  }
  return `Arrêté depuis ${formatRelativeDuration(state.FinishedAt)}`;
}
