export const FORMATS = ["0.1.0"];
export const VERSIONS = ["0.1.0", "0.2.0", "0.2.1", "0.2.2", "0.2.3", "0.2.4", "0.2.5", "0.3.0", "0.3.1", "0.3.2", "0.3.3", "0.3.4", "0.3.5", "0.3.6", "0.3.7", "0.3.8", "0.3.9", "0.4.0", "0.4.1", "0.4.2", "0.5.0", "0.6.0", "0.6.1"];

const parse = version => /^\d+\.\d+\.\d+$/.test(version) ? version.split(".").map(Number) : null;

export function compareVersions(a, b) {
  const [left, right] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return Math.sign(left[i] - right[i]);
  return 0;
}

export function formatOf(version, { versions = VERSIONS, formats = FORMATS } = {}) {
  if (!versions.includes(version)) return formats[0];
  return formats.filter(format => compareVersions(format, version) <= 0).at(-1) ?? formats[0];
}

export const isNewer = (version, current) => Boolean(parse(version)) && compareVersions(version, current) > 0;
