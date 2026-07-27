// src/types/monitoring.ts
export interface SystemStats {
  loadAvg: [number, number, number];
  cpuCount: number;
  usedMemPercent: number;
  cpuTempCelsius: number | null;
}

export type DiskStatus = "ok" | "warning" | "critical" | "unreadable";

export interface DiskReading {
  name: string;
  device: string;
  temperatureCelsius: number | null;
  status: DiskStatus;
}
