import { MODULE_ID } from "../constants.mjs";
import { canCreateThemes, canEditTheme } from "../permissions.mjs";
import { setting } from "../settings.mjs";
import { ask, onMessage, reply, send } from "../socket.mjs";
import { canonical, copyDesign, stamp } from "./design.mjs";
import { upgradeFiles } from "./migrations.mjs";
import { slugify, uniqueKey } from "./slug.mjs";
import {
  THEME_FILES, canWrite, entryOf, forgetTheme, listThemes, loadTheme, moduleVersion, pendingEntries, picker, readFiles, readIndex, readTheme, route, worldLocation, worldRoot
} from "./store.mjs";

const WORLD_FOLDERS = ["theme", "img", "assets", "assets/sounds"];
const CHANGED = "bookbinder.themeChanged";

async function directoryExists(path) {
  try {
    await picker().browse("data", path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDirectory(path) {
  if (!(await directoryExists(path))) await picker().createDirectory("data", path);
}

export async function uploadJSON(directory, name, data) {
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

const writeIndex = list => uploadJSON(`${worldRoot()}/theme`, "index.json", list);
const dirName = dir => decodeURIComponent(dir.split("/").at(-1));

async function diskSlugs() {
  const listing = await picker().browse("data", `${worldRoot()}/theme`).catch(() => ({ dirs: [] }));
  return listing.dirs.map(dirName);
}

const writtenSlugs = async () => new Set([...(await diskSlugs()), ...(await readIndex(worldRoot()))]);

export async function chooseSlug(name) {
  return uniqueKey(slugify(name), new Set([...(await writtenSlugs()), ...pendingEntries().map(entry => entry.slug)]));
}

export function announceChange(slug, userId = game.user.id) {
  forgetTheme(slug);
  Hooks.callAll(CHANGED, slug, userId);
  send("changed", { slug, userId });
}

async function writeDesign(slug, files, isNew) {
  const directory = `${worldRoot()}/theme/${slug}`;
  await ensureDirectory(directory);
  for (const name of THEME_FILES) await uploadJSON(directory, `${name}.json`, files[name]);
  const index = await readIndex(worldRoot());
  if (isNew && !index.includes(slug)) await writeIndex([...index, slug]);
}

async function authorizedWrite({ user, slug, files, isNew }) {
  const allowed = setting("permissions");
  const current = isNew ? null : await readFiles(worldRoot(), slug).catch(() => null);
  const permitted = isNew ? canCreateThemes(user, allowed) : current && canEditTheme(user, current.theme, allowed);
  if (!permitted) return { ok: false, reason: "forbidden" };
  const upgraded = upgradeFiles(files, moduleVersion());
  if (!upgraded.ok) return { ok: false, reason: "invalid" };
  const clean = stamp(upgraded.files, { userId: user.id, moduleVersion: moduleVersion(), now: Date.now() });
  clean.theme.author = current?.theme.author ?? { id: user.id, name: user.name };
  const finalSlug = isNew ? uniqueKey(slug, await writtenSlugs()) : slug;
  await writeDesign(finalSlug, clean, isNew);
  announceChange(finalSlug, user.id);
  return { ok: true, slug: finalSlug };
}

async function queueForGM({ slug, files }) {
  await game.user.setFlag(MODULE_ID, "pendingThemes", { [slug]: files });
  forgetTheme(slug);
  return { ok: true, slug, queued: true };
}

export async function saveDesign(request) {
  if (game.user.isGM || (canWrite() && !request.isNew)) return authorizedWrite({ user: game.user, ...request });
  if (!game.users.activeGM) return queueForGM(request);
  try {
    return await ask("save", request);
  } catch {
    return queueForGM(request);
  }
}

export async function materializePending() {
  if (!game.user.isActiveGM) return;
  const index = await readIndex(worldRoot());
  for (const { slug, files, userId } of pendingEntries()) {
    const user = game.users.get(userId);
    if (!user) continue;
    const result = await authorizedWrite({ user, slug, files, isNew: !index.includes(slug) });
    if (!result.ok) ui.notifications.warn(game.i18n.format("BOOKBINDER.Theme.Rejected", { slug, user: user.name }));
    await user.update({ [`flags.${MODULE_ID}.pendingThemes.-=${slug}`]: null });
  }
}

export function registerStorageHandlers() {
  onMessage("save", async message => {
    if (!game.user.isActiveGM) return;
    const user = game.users.get(message.userId);
    const result = user ? await authorizedWrite({ user, slug: message.slug, files: message.files, isNew: message.isNew }) : { ok: false, reason: "forbidden" };
    reply(message, result);
  });
  onMessage("changed", message => {
    forgetTheme(message.slug);
    Hooks.callAll(CHANGED, message.slug, message.userId);
  });
}

export async function createDesign(files) {
  const slug = await chooseSlug(files.theme.name);
  return saveDesign({ slug, files, isNew: true });
}

export async function trashDesign(slug) {
  await writeIndex((await readIndex(worldRoot())).filter(entry => entry !== slug));
  announceChange(slug);
}

export async function restoreDesign(slug) {
  const index = await readIndex(worldRoot());
  if (!index.includes(slug)) await writeIndex([...index, slug]);
  announceChange(slug);
}

export async function listTrashed() {
  const index = await readIndex(worldRoot());
  const slugs = (await diskSlugs()).filter(slug => !index.includes(slug));
  const results = await Promise.all(slugs.map(slug => readTheme(slug, worldLocation())));
  return results.filter(result => result.ok).map(entryOf);
}

export async function currentFiles(slug) {
  return readFiles(worldRoot(), slug).catch(() => pendingEntries().find(entry => entry.slug === slug)?.files ?? null);
}

const SAME_AS_TEMPLATE = ["styles", "effect"];

const isUnmodifiedCopy = (entry, template) => SAME_AS_TEMPLATE.every(name => canonical(entry.files[name]) === canonical(template.files[name]))
  && canonical(entry.files.theme.resources) === canonical(template.files.theme.resources);

export async function applyTemplate(slug) {
  const template = await loadTheme(slug);
  if (!template.ok || template.source !== "preset") return slug;
  const { world } = await listThemes();
  const existing = world.find(entry => isUnmodifiedCopy(entry, template));
  if (existing) return existing.slug;
  const copy = copyDesign(template.files, { name: template.files.theme.name, author: game.user, visibility: "all", moduleVersion: moduleVersion(), now: Date.now() });
  const result = await createDesign(copy);
  return result.ok ? result.slug : slug;
}
