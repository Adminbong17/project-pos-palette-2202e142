/**
 * Application Version Engine
 *
 * Rules:
 * - Version format: X.Y.Z
 * - Z (rightmost digit): counts 0-9
 * - Y (middle digit): counts 0-9, increments when Z rolls over from 9 -> 0
 * - X (front number): increments when Y & Z roll over from 9.9 -> 0.0
 *   Can go up to 99, and if it exceeds 99, an extra digit naturally expands (e.g. 100.0.0).
 *
 * Calculation:
 * A single build counter N maps directly:
 *   Z = N % 10
 *   Y = Math.floor(N / 10) % 10
 *   X = Math.floor(N / 100)
 */

export const APP_BUILD_NUMBER = 1478;

export function formatBuildVersion(buildNum: number): string {
  const z = buildNum % 10;
  const y = Math.floor(buildNum / 10) % 10;
  const x = Math.floor(buildNum / 100);
  return `${x}.${y}.${z}`;
}

export const APP_VERSION = formatBuildVersion(APP_BUILD_NUMBER); // "14.7.8"

