import { migrate } from "./migrate.mjs";
import { sanitizeFiles, validateStructure } from "./schemas/index.mjs";
import { FORMATS, VERSIONS, formatOf, isNewer } from "./version.mjs";

export const THEME_MIGRATIONS = { formats: FORMATS, steps: {}, validate: validateStructure };

export function upgradeFiles(files, moduleVersion, config = THEME_MIGRATIONS) {
  if (isNewer(files.theme?.moduleVersion, moduleVersion)) return { ok: false, newer: true, version: files.theme.moduleVersion };
  const start = formatOf(files.theme?.moduleVersion, { versions: VERSIONS, formats: config.formats });
  const result = migrate(files, start, config);
  if (!result.ok) return result;
  const { files: clean, warnings } = sanitizeFiles(result.data, result.version);
  return { ok: true, files: clean, warnings };
}
