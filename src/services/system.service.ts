// src/services/system.service.ts
import { readFile } from "node:fs/promises";
import os from "node:os";

import { LogLevel } from "@lex0u/logger";

import { logger } from "../utils/logger.js";
import type { SystemStats } from "../types/monitoring.js";

const CPU_THERMAL_ZONE_PATH = "/sys/class/thermal/thermal_zone0/temp";

async function readCpuTemperature(): Promise<number | null> {
  try {
    const raw = await readFile(CPU_THERMAL_ZONE_PATH, "utf-8");
    return Number.parseInt(raw.trim(), 10) / 1000;
  } catch {
    // Pas de capteur thermique disponible sur cette machine (normal hors RPi).
    return null;
  }
}

export async function getSystemStats(): Promise<SystemStats> {
  const loadAvg = os.loadavg() as [number, number, number];
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPercent = ((totalMem - freeMem) / totalMem) * 100;

  const cpuTempCelsius = await readCpuTemperature();

  void logger.log.file(
    LogLevel.Debug,
    "Lecture des stats système effectuée",
    "SystemService",
    {
      usedMemPercent: Math.round(usedMemPercent * 10) / 10,
    },
  );

  return {
    loadAvg,
    cpuCount: os.cpus().length,
    usedMemPercent: Math.round(usedMemPercent * 10) / 10,
    cpuTempCelsius,
  };
}
