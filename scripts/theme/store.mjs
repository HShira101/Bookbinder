import { MODULE_ID, modulePath } from "../constants.mjs";
import { resolveTheme } from "./defaults.mjs";
import { pendingCount, pendingOf, typeOf } from "./design.mjs";
import { upgradeFiles } from "./migrations.mjs";

export const THEME_FILES = ["theme", "styles", "effect"];
const loaded = new Map();

export const picker = () => foundry.applications.apps.FilePicker.implementation;
export const route = path => foundry.utils.getRoute(path);
export const moduleVersion = () => game.modules.get(MODULE_ID).version;

export const worldRoot = () => `worlds/${game.world.id}/Bookbinder_themes`;
export const presetRoot = () => modulePath("presets");
export const canWrite = () => game.user.can("FILES_UPLOAD");
export const hasFont = name => Object.hasOwn(CONFIG.fontDefinitions, name);

export const dataPath = path => (/^(?:img|assets)\//.test(path) ? `${worldRoot()}/${path}` : path);
export const resourceUrl = path => route(dataPath(path));
export const moduleAsset = file => route(modulePath(`presets/${file}`));

export const makeAssets = resources => ({
  resource: name => {
    const entry = resources.images?.[name] ?? resources.sounds?.[name];
    return entry && entry.status !== "pending" ? resourceUrl(entry.path) : null;
  },
  module: moduleAsset
});

export async function fetchJSON(path, fresh) {
  const response = await fetch(route(path), fresh ? { cache: "no-store" } : undefined);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

export const readIndex = async root => fetchJSON(`${root}/theme/index.json`, true).then(list => (Array.isArray(list) ? list : []), () => []);

export function pendingEntries() {
  return game.users.contents.flatMap(user => Object.entries(user.getFlag(MODULE_ID, "pendingThemes") ?? {}).map(([slug, files]) => ({ slug, files, userId: user.id })));
}

async function themeSources() {
  const [world, presets] = await Promise.all([readIndex(worldRoot()), readIndex(presetRoot())]);
  return { world, presets, pending: pendingEntries() };
}

export async function sourceOf(slug) {
  const { world, presets, pending } = await themeSources();
  if (world.includes(slug)) return { source: "world", root: worldRoot() };
  if (presets.includes(slug)) return { source: "preset", root: presetRoot() };
  const entry = pending.find(candidate => candidate.slug === slug);
  return entry ? { source: "pending", files: entry.files } : null;
}

export const worldLocation = () => ({ source: "world", root: worldRoot() });

export async function readFiles(root, slug) {
  const entries = await Promise.all(THEME_FILES.map(async name => [name, await fetchJSON(`${root}/theme/${slug}/${name}.json`, true)]));
  return Object.fromEntries(entries);
}

const presetText = (slug, path, fallback) => {
  const key = `BOOKBINDER.Presets.${slug}.${path}`;
  return game.i18n.has(key) ? game.i18n.localize(key) : fallback;
};

function localizePreset(slug, files) {
  const sheets = Object.entries(files.styles.sheets ?? {}).map(([id, sheet]) => [id, { ...sheet, name: presetText(slug, `Sheets.${id}`, sheet.name) }]);
  return {
    ...files,
    theme: { ...files.theme, name: presetText(slug, "Name", files.theme.name) },
    styles: sheets.length ? { ...files.styles, sheets: Object.fromEntries(sheets) } : files.styles
  };
}

export async function readTheme(slug, location = null) {
  location ??= await sourceOf(slug);
  if (!location) return { ok: false, slug, reason: "missing" };
  try {
    const result = upgradeFiles(location.files ?? await readFiles(location.root, slug), moduleVersion());
    if (!result.ok) return { ok: false, slug, reason: result.newer ? "newer" : "invalid", detail: result };
    const files = location.source === "preset" ? localizePreset(slug, result.files) : result.files;
    return { ok: true, slug, source: location.source, files, warnings: result.warnings, theme: resolveTheme(files) };
  } catch (error) {
    console.error(error);
    return { ok: false, slug, reason: "unreadable", detail: error };
  }
}

export function loadTheme(slug) {
  if (!slug) return Promise.resolve({ ok: false, slug, reason: "missing" });
  if (!loaded.has(slug)) loaded.set(slug, readTheme(slug));
  return loaded.get(slug);
}

export const forgetTheme = slug => (slug ? loaded.delete(slug) : loaded.clear());

export function reportProblems(result) {
  if (!game.user.isGM) return;
  const key = result.ok ? (result.warnings.length ? "Theme.Warnings" : null) : "Theme.Broken";
  if (key) ui.notifications.warn(game.i18n.format(`BOOKBINDER.${key}`, { slug: result.slug, count: result.ok ? result.warnings.length : 0 }));
}

export function entryOf(result) {
  const type = typeOf(result.files);
  return { slug: result.slug, name: result.theme.meta.name, source: result.source, meta: result.files.theme, files: result.files, type: type.id, available: type.available, pending: pendingOf(result.files, hasFont) };
}

export const countPending = entry => pendingCount(entry.pending);

async function readEntries(slugs, location) {
  const results = await Promise.all(slugs.map(slug => readTheme(slug, location(slug))));
  return results.filter(result => result.ok).map(entryOf);
}

export async function listThemes() {
  const { world, presets, pending } = await themeSources();
  const pendingOnly = pending.filter(entry => !world.includes(entry.slug));
  const [own, queued, templates] = await Promise.all([
    readEntries(world, () => worldLocation()),
    readEntries(pendingOnly.map(entry => entry.slug), slug => ({ source: "pending", files: pendingOnly.find(entry => entry.slug === slug).files })),
    readEntries(presets, () => ({ source: "preset", root: presetRoot() }))
  ]);
  return { world: [...own, ...queued], presets: templates };
}
