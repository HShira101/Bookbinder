import { MODULE_ID, modulePath } from "../constants.mjs";
import { resolveTheme } from "./defaults.mjs";
import { upgradeFiles } from "./migrations.mjs";

const FILES = ["theme", "styles", "effect"];
const HIDDEN_TRANSITIONS = new Set(["roll", "shuffle"]);
const COPY_FILES = ["styles", "effect"];
const WORLD_FOLDERS = ["theme", "img", "assets", "assets/sounds"];
const loaded = new Map();

const picker = () => foundry.applications.apps.FilePicker.implementation;
const route = path => foundry.utils.getRoute(path);
const moduleVersion = () => game.modules.get(MODULE_ID).version;
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const worldRoot = () => `worlds/${game.world.id}/Bookbinder_themes`;
export const presetRoot = () => modulePath("presets");
export const slugify = name => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "theme";
export const canWrite = () => game.user.can("FILES_UPLOAD");

export const resourceUrl = path => route(path.startsWith("modules/") ? path : `${worldRoot()}/${path}`);
export const moduleAsset = file => route(modulePath(`presets/${file}`));

export const makeAssets = resources => ({
  resource: name => {
    const entry = resources.images?.[name] ?? resources.sounds?.[name];
    return entry && entry.status !== "pending" ? resourceUrl(entry.path) : null;
  },
  module: moduleAsset
});

async function fetchJSON(path, fresh) {
  const response = await fetch(route(path), fresh ? { cache: "no-store" } : undefined);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

const readIndex = async root => fetchJSON(`${root}/theme/index.json`, true).then(list => (Array.isArray(list) ? list : []), () => []);

async function themeSources() {
  const [world, presets] = await Promise.all([readIndex(worldRoot()), readIndex(presetRoot())]);
  return { world, presets };
}

export async function sourceOf(slug) {
  const { world, presets } = await themeSources();
  if (world.includes(slug)) return { source: "world", root: worldRoot() };
  return presets.includes(slug) ? { source: "preset", root: presetRoot() } : null;
}

async function readFiles(root, slug) {
  const entries = await Promise.all(FILES.map(async name => [name, await fetchJSON(`${root}/theme/${slug}/${name}.json`, true)]));
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

async function readTheme(slug, location = null) {
  location ??= await sourceOf(slug);
  if (!location) return { ok: false, slug, reason: "missing" };
  try {
    const result = upgradeFiles(await readFiles(location.root, slug), moduleVersion());
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

export async function listThemes() {
  const { world, presets } = await themeSources();
  const read = async (slug, location) => {
    const result = await readTheme(slug, location);
    return result.ok && !HIDDEN_TRANSITIONS.has(result.theme.effect.transition.type) ? { slug, name: result.theme.meta.name, source: location.source } : null;
  };
  const [own, templates] = await Promise.all([
    Promise.all(world.map(slug => read(slug, { source: "world", root: worldRoot() }))),
    Promise.all(presets.map(slug => read(slug, { source: "preset", root: presetRoot() })))
  ]);
  return { world: own.filter(Boolean), presets: templates.filter(Boolean) };
}

async function directoryExists(path) {
  try {
    await picker().browse("data", path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(path) {
  if (!(await directoryExists(path))) await picker().createDirectory("data", path);
}

async function uploadJSON(directory, name, data) {
  const file = new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });
  await picker().upload("data", directory, file, {}, { notify: false });
}

export async function ensureWorldFolders() {
  if (!game.user.isGM) return;
  const root = worldRoot();
  await ensureDirectory(root);
  for (const folder of WORLD_FOLDERS) await ensureDirectory(`${root}/${folder}`);
  if (!(await fetch(route(`${root}/theme/index.json`), { cache: "no-store" })).ok) await uploadJSON(`${root}/theme`, "index.json", []);
}

async function takenSlugs(root) {
  const listing = await picker().browse("data", `${root}/theme`).catch(() => ({ dirs: [] }));
  return new Set([...listing.dirs.map(dir => decodeURIComponent(dir.split("/").at(-1))), ...(await readIndex(root))]);
}

async function uniqueSlug(name) {
  const taken = await takenSlugs(worldRoot());
  const base = slugify(name);
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

async function findPristineCopy(template, world) {
  for (const slug of world) {
    const copy = await readTheme(slug, { source: "world", root: worldRoot() });
    if (copy.ok && COPY_FILES.every(name => sameJSON(copy.files[name], template.files[name])) && sameJSON(copy.files.theme.resources, template.files.theme.resources)) return slug;
  }
  return null;
}

export async function useTemplate(slug) {
  const template = await loadTheme(slug);
  if (!template.ok || template.source !== "preset" || !canWrite()) return slug;
  const { world } = await themeSources();
  const existing = await findPristineCopy(template, world);
  if (existing) return existing;
  const copySlug = await uniqueSlug(template.files.theme.name);
  const directory = `${worldRoot()}/theme/${copySlug}`;
  await ensureDirectory(directory);
  const meta = { ...template.files.theme, author: { id: game.user.id, name: game.user.name }, visibility: "all", moduleVersion: moduleVersion(), updatedBy: game.user.id, updatedAt: Date.now() };
  await uploadJSON(directory, "theme.json", meta);
  for (const name of COPY_FILES) await uploadJSON(directory, `${name}.json`, template.files[name]);
  await uploadJSON(`${worldRoot()}/theme`, "index.json", [...(await readIndex(worldRoot())), copySlug]);
  forgetTheme(copySlug);
  return copySlug;
}
