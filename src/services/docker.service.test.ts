// src/services/docker.service.test.ts
import type { ContainerInspectInfo } from "dockerode";
import { describe, expect, it } from "vitest";

import { extractHealth, formatRelativeDuration } from "./docker-format.js";

function isoTimestampAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

describe("formatRelativeDuration", () => {
  it("affiche 'moins d'une minute' pour un timestamp très récent", () => {
    // Arrange
    const timestamp = isoTimestampAgo(5_000);

    // Act
    const result = formatRelativeDuration(timestamp);

    // Assert
    expect(result).toBe("moins d'une minute");
  });

  it("affiche les minutes en dessous d'une heure", () => {
    const timestamp = isoTimestampAgo(42 * 60_000);
    expect(formatRelativeDuration(timestamp)).toBe("42 min");
  });

  it("affiche les heures en dessous d'un jour", () => {
    const timestamp = isoTimestampAgo(5 * 3_600_000);
    expect(formatRelativeDuration(timestamp)).toBe("5 h");
  });

  it("affiche les jours au-delà de 24h", () => {
    const timestamp = isoTimestampAgo(3 * 86_400_000);
    expect(formatRelativeDuration(timestamp)).toBe("3 j");
  });
});

describe("extractHealth", () => {
  function fakeState(health?: string): ContainerInspectInfo["State"] {
    return {
      Health: health ? { Status: health } : undefined,
    } as unknown as ContainerInspectInfo["State"];
  }

  it("retourne 'healthy' quand le healthcheck est healthy", () => {
    expect(extractHealth(fakeState("healthy"))).toBe("healthy");
  });

  it("retourne 'unhealthy' quand le healthcheck est unhealthy", () => {
    expect(extractHealth(fakeState("unhealthy"))).toBe("unhealthy");
  });

  it("retourne 'none' quand le conteneur n'a pas de healthcheck configuré", () => {
    expect(extractHealth(fakeState())).toBe("none");
  });
});
