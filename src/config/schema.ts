import { z } from "zod";

export const diskSchema = z.object({
	name: z.string().min(1),
	device: z.string().regex(/^\/dev\/[a-zA-Z0-9]+$/, "Doit être un device valide, ex: /dev/sda"),
	mountPath: z.string().startsWith("/").optional(),
	// Conteneurs à arrêter (+ disque mis en veille via hdparm) quand ce disque
	// passe en température critique, redémarrés automatiquement au retour à "ok".
	pauseOnCriticalTemp: z.array(z.string().min(1)).default([]),
});

export const thresholdsSchema = z.object({
	diskTempWarning: z.number().int().positive().default(45),
	diskTempCritical: z.number().int().positive().default(50),
	diskSpaceWarningPercent: z.number().int().min(1).max(99).default(85),
});

export const configSchema = z.object({
	disks: z.array(diskSchema).default([]),
	dockerContainers: z.array(z.string().min(1)).default([]),
	thresholds: thresholdsSchema.default({
		diskTempWarning: 45,
		diskTempCritical: 50,
		diskSpaceWarningPercent: 85,
	}),
	monitoring: z
		.object({
			intervalMinutes: z.number().int().positive().default(5),
			historyRetentionDays: z.number().int().positive().default(30),
		})
		.default({ intervalMinutes: 5, historyRetentionDays: 30 }),
});

export type Disk = z.infer<typeof diskSchema>;
export type Thresholds = z.infer<typeof thresholdsSchema>;
export type AppConfig = z.infer<typeof configSchema>;
