// src/services/disk.service.test.ts
import { describe, expect, it } from "vitest";

import type { Thresholds } from "../config/schema.js";
import { extractTemperature, statusFor } from "./disk.service.js";
import type { SmartCtlJson } from "./disk.service.js";

const THRESHOLDS: Thresholds = {
  diskTempWarning: 45,
  diskTempCritical: 50,
  diskSpaceWarningPercent: 85,
};

describe("statusFor", () => {
  it("retourne 'unreadable' quand la température est null", () => {
    // Arrange
    const temperature = null;

    // Act
    const status = statusFor(temperature, THRESHOLDS);

    // Assert
    expect(status).toBe("unreadable");
  });

  it("retourne 'ok' sous le seuil d'avertissement", () => {
    expect(statusFor(40, THRESHOLDS)).toBe("ok");
  });

  it("retourne 'warning' au seuil d'avertissement (inclusif)", () => {
    expect(statusFor(45, THRESHOLDS)).toBe("warning");
  });

  it("retourne 'critical' au seuil critique (inclusif)", () => {
    expect(statusFor(50, THRESHOLDS)).toBe("critical");
  });

  it("retourne 'critical' bien au-dessus du seuil critique", () => {
    expect(statusFor(65, THRESHOLDS)).toBe("critical");
  });
});

describe("extractTemperature", () => {
  it("préfère le champ temperature.current quand il est présent", () => {
    // Arrange
    const data: SmartCtlJson = {
      temperature: { current: 47 },
      ata_smart_attributes: {
        table: [{ id: 194, raw: { value: 999 } }],
      },
    };

    // Act
    const result = extractTemperature(data);

    // Assert
    expect(result).toBe(47);
  });

  it("retombe sur l'attribut SMART 194 si temperature.current est absent", () => {
    const data: SmartCtlJson = {
      ata_smart_attributes: {
        table: [
          { id: 9, raw: { value: 4744 } },
          { id: 194, raw: { value: 47 } },
        ],
      },
    };

    expect(extractTemperature(data)).toBe(47);
  });

  it("retombe sur l'attribut SMART 190 si 194 est absent", () => {
    const data: SmartCtlJson = {
      ata_smart_attributes: {
        table: [{ id: 190, raw: { value: 38 } }],
      },
    };

    expect(extractTemperature(data)).toBe(38);
  });

  it("retourne null si aucune source de température n'est disponible", () => {
    const data: SmartCtlJson = {
      ata_smart_attributes: {
        table: [{ id: 9, raw: { value: 4744 } }],
      },
    };

    expect(extractTemperature(data)).toBeNull();
  });
});
