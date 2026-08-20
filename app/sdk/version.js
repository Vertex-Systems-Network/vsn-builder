export const VSN_SDK_API_VERSION = "1.0.0";
export const VSN_SDK_SCHEMA_VERSION = 1;
export const VSN_APP_COMPATIBILITY = Object.freeze({ min: "2.5.50", maxExclusive: "3.0.0" });

export function parseVersion(value) {
  const match = String(value || "").trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function compareVersions(a, b) {
  const left = parseVersion(a); const right = parseVersion(b);
  if (!left || !right) return null;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
}

export function versionSatisfies(version, range = {}) {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  if (range.min && compareVersions(version, range.min) < 0) return false;
  if (range.max && compareVersions(version, range.max) > 0) return false;
  if (range.maxExclusive && compareVersions(version, range.maxExclusive) >= 0) return false;
  return true;
}
