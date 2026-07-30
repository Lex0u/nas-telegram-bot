// src/services/disk.service.ts
import { execFile } from "node:child_process";
import { statfsSync } from "node:fs";
import { promisify } from "node:util";

import { LogLevel } from "@lex0u/logger";

import type { Disk, Thresholds } from "../config/schema.js";
import type { DiskReading, DiskStatus } from "../types/monitoring.js";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

// Le conteneur Docker tourne en root par défaut : "sudo" n'y est ni nécessaire
// ni même installé. Sur un Pi en exécution native (hors Docker), l'utilisateur
// est en général non-root et a besoin de sudo pour accéder aux devices bruts.
const IS_ROOT = typeof process.getuid === "function" && process.getuid() === 0;

async function runSmartCtl(args: string[]): Promise<string> {
  const command = IS_ROOT ? "smartctl" : "sudo";
  const fullArgs = IS_ROOT ? args : ["smartctl", ...args];

  try {
    const { stdout } = await execFileAsync(command, fullArgs);
    return stdout;
  } catch (error) {
    // Le code de sortie de smartctl est un bitmask : plusieurs bits (ex: "le
    // journal d'erreurs contient des entrées") sont informatifs et n'empêchent
    // pas la génération d'un JSON valide sur stdout. Node considère pourtant
    // tout code non nul comme une erreur — on récupère le stdout déjà produit
    // plutôt que de jeter des données par ailleurs correctes.
    const stdout = (error as { stdout?: unknown }).stdout;
    if (typeof stdout === "string" && stdout.trim().length > 0) {
      return stdout;
    }
    throw error;
  }
}

// Attributs SMART où l'on trouve la température selon les fabricants.
// 194 = Temperature_Celsius (le plus courant), 190 = Airflow_Temperature_Cel.
const TEMPERATURE_ATTRIBUTE_IDS = new Set([194, 190]);

interface SmartCtlAttributeTable {
  id: number;
  raw: { value: number };
}

export interface SmartCtlJson {
  ata_smart_attributes?: {
    table: SmartCtlAttributeTable[];
  };
  temperature?: {
    current: number;
  };
}

async function readSmartCtlJson(device: string): Promise<SmartCtlJson | null> {
  try {
    const stdout = await runSmartCtl(["-a", "-j", "-d", "sat", device]);
    return JSON.parse(stdout) as SmartCtlJson;
  } catch {
    // Certains disques ne supportent pas "-d sat" (ex: NVMe) : on retente sans.
    try {
      const stdout = await runSmartCtl(["-a", "-j", device]);
      return JSON.parse(stdout) as SmartCtlJson;
    } catch (error) {
      await logger.log.file(
        LogLevel.Warning,
        `Impossible de lire les données SMART de ${device}`,
        "DiskService",
        { error: error instanceof Error ? error.message : String(error) },
      );
      return null;
    }
  }
}

export function extractTemperature(data: SmartCtlJson): number | null {
  if (typeof data.temperature?.current === "number") {
    return data.temperature.current;
  }

  const attribute = data.ata_smart_attributes?.table.find((entry) =>
    TEMPERATURE_ATTRIBUTE_IDS.has(entry.id),
  );

  return attribute?.raw.value ?? null;
}

export function statusFor(
  temperature: number | null,
  thresholds: Thresholds,
): DiskStatus {
  if (temperature === null) return "unreadable";
  if (temperature >= thresholds.diskTempCritical) return "critical";
  if (temperature >= thresholds.diskTempWarning) return "warning";
  return "ok";
}

export async function readDiskTemperature(
  disk: Disk,
  thresholds: Thresholds,
): Promise<DiskReading> {
  const data = await readSmartCtlJson(disk.device);
  const temperatureCelsius = data ? extractTemperature(data) : null;

  return {
    name: disk.name,
    device: disk.device,
    temperatureCelsius,
    status: statusFor(temperatureCelsius, thresholds),
  };
}

export async function readAllDiskTemperatures(
  disks: Disk[],
  thresholds: Thresholds,
): Promise<DiskReading[]> {
  return Promise.all(
    disks.map((disk) => readDiskTemperature(disk, thresholds)),
  );
}

export interface DiskSpaceUsage {
  name: string;
  mountPath: string;
  usedPercent: number;
  totalBytes: number;
  freeBytes: number;
}

export function readDiskSpaceUsage(disk: Disk): DiskSpaceUsage | null {
  if (!disk.mountPath) return null;

  try {
    const stats = statfsSync(disk.mountPath);
    const blockSize = Number(stats.bsize);
    const totalBlocks = Number(stats.blocks);
    const freeBlocks = Number(stats.bfree);
    if (totalBlocks === 0) return null;

    const totalBytes = totalBlocks * blockSize;
    const freeBytes = freeBlocks * blockSize;

    return {
      name: disk.name,
      mountPath: disk.mountPath,
      usedPercent: ((totalBlocks - freeBlocks) / totalBlocks) * 100,
      totalBytes,
      freeBytes,
    };
  } catch {
    return null;
  }
}

export function readAllDiskSpaceUsage(disks: Disk[]): DiskSpaceUsage[] {
  return disks
    .map((disk) => readDiskSpaceUsage(disk))
    .filter((usage): usage is DiskSpaceUsage => usage !== null);
}

export function formatBytes(bytes: number): string {
  const gigabytes = bytes / 1_000_000_000;
  return gigabytes >= 1000
    ? `${(gigabytes / 1000).toFixed(1)} To`
    : `${gigabytes.toFixed(1)} Go`;
}
