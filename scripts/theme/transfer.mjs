import { clone, usedFonts } from "./design.mjs";
import { upgradeFiles } from "./migrations.mjs";
import { sanitizeFiles } from "./schemas/index.mjs";
import { isObject } from "./util.mjs";
import { FORMATS } from "./version.mjs";

export const PACKAGE_FORMAT = "bookbinder-export";
const RESOURCE_BLOCKS = ["images", "sounds"];

const basename = path => path.split("/").at(-1);
const pendingHints = resources => Object.fromEntries(Object.entries(resources ?? {}).map(([key, resource]) => [key, { path: basename(resource.path), status: "pending" }]));

export function packageOf(files, moduleVersion) {
  const theme = clone(files.theme);
  theme.resources = Object.fromEntries(RESOURCE_BLOCKS.map(block => [block, pendingHints(files.theme.resources[block])]));
  return { format: PACKAGE_FORMAT, moduleVersion, theme, styles: files.styles, effect: files.effect, fonts: usedFonts(files) };
}

export function unpackage(data) {
  if (!isObject(data) || data.format !== PACKAGE_FORMAT || !isObject(data.theme)) return { ok: false, reason: "notTheme" };
  const theme = { ...data.theme, moduleVersion: data.moduleVersion ?? data.theme.moduleVersion };
  theme.importedFrom ??= data.theme.author?.name;
  return { ok: true, files: { theme, styles: data.styles, effect: data.effect } };
}

export function readPackage(data, currentVersion) {
  const opened = unpackage(data);
  if (!opened.ok) return opened;
  const result = upgradeFiles(opened.files, currentVersion);
  if (result.ok) return { ok: true, files: result.files, warnings: result.warnings };
  if (result.newer) return { ok: false, newer: true, version: result.version, files: opened.files };
  return { ok: false, reason: "invalid" };
}

export function salvage(files, currentVersion) {
  const { files: clean } = sanitizeFiles(files, FORMATS.at(-1));
  if (!clean.styles || !clean.effect || !clean.theme) return { ok: false, reason: "invalid" };
  clean.theme.moduleVersion = currentVersion;
  return { ok: true, files: clean };
}

export function markPending(files) {
  for (const block of RESOURCE_BLOCKS) {
    for (const resource of Object.values(files.theme.resources[block] ?? {})) resource.status = "pending";
  }
  files.theme.resources.fonts = Object.fromEntries(usedFonts(files).map(name => [name, { status: "pending" }]));
  return files;
}

export function copyName(name, takenNames) {
  for (let n = 2; ; n++) if (!takenNames.has(`${name} (${n})`)) return `${name} (${n})`;
}
