// src/services/history.service.ts
import { LogLevel } from "@lex0u/logger";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { DiskReading, SystemStats } from "../types/monitoring.js";
import { logger } from "../utils/logger.js";

const DB_PATH = resolve(process.cwd(), "data", "history.db");

export type MetricName =
  "cpu_load_1m" | "mem_percent" | "cpu_temp" | "disk_temp";

export interface HistoryPoint {
  recordedAt: number; // unix timestamp, secondes
  metric: MetricName;
  label: string | null; // nom du disque pour disk_temp, null sinon
  value: number;
}

let db: DatabaseSync | undefined;

function getDb(): DatabaseSync {
  if (db) return db;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at INTEGER NOT NULL,
      metric TEXT NOT NULL,
      label TEXT,
      value REAL NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_readings_metric_time
      ON readings (metric, recorded_at);
  `);

  return db;
}

function insertReading(
  metric: MetricName,
  value: number,
  label: string | null = null,
): void {
  const nowSeconds = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      "INSERT INTO readings (recorded_at, metric, label, value) VALUES (?, ?, ?, ?)",
    )
    .run(nowSeconds, metric, label, value);
}

export function recordSystemStats(stats: SystemStats): void {
  insertReading("cpu_load_1m", stats.loadAvg[0]);
  insertReading("mem_percent", stats.usedMemPercent);
  if (stats.cpuTempCelsius !== null) {
    insertReading("cpu_temp", stats.cpuTempCelsius);
  }
}

export function recordDiskReadings(readings: DiskReading[]): void {
  for (const reading of readings) {
    if (reading.temperatureCelsius !== null) {
      insertReading("disk_temp", reading.temperatureCelsius, reading.name);
    }
  }
}

export function queryHistory(
  metric: MetricName,
  sinceHours: number,
  label: string | null = null,
): HistoryPoint[] {
  const sinceTimestamp = Math.floor(Date.now() / 1000) - sinceHours * 3600;

  const rows = label
    ? getDb()
        .prepare(
          "SELECT recorded_at, metric, label, value FROM readings " +
            "WHERE metric = ? AND label = ? AND recorded_at >= ? ORDER BY recorded_at ASC",
        )
        .all(metric, label, sinceTimestamp)
    : getDb()
        .prepare(
          "SELECT recorded_at, metric, label, value FROM readings " +
            "WHERE metric = ? AND label IS NULL AND recorded_at >= ? ORDER BY recorded_at ASC",
        )
        .all(metric, sinceTimestamp);

  return rows.map((row) => ({
    recordedAt: row["recorded_at"] as number,
    metric: row["metric"] as MetricName,
    label: (row["label"] as string | null) ?? null,
    value: row["value"] as number,
  }));
}

export async function pruneOldReadings(retentionDays: number): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 86400;
  const result = getDb()
    .prepare("DELETE FROM readings WHERE recorded_at < ?")
    .run(cutoff);

  if (result.changes > 0) {
    await logger.log.file(
      LogLevel.Information,
      `Purge de l'historique : ${result.changes} relevé(s) supprimé(s)`,
      "HistoryService",
    );
  }
}

export function closeHistoryDb(): void {
  db?.close();
  db = undefined;
}
