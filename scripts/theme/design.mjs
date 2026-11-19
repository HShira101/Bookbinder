import { identifier, uniqueKey } from "./slug.mjs";
import { isObject } from "./util.mjs";

export const clone = value => structuredClone(value);

const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy"]);
const COVER_TITLE = { layout: "center", size: 26, weight: 700, color: "#e6d3a1", letterSpacing: 0.06, transform: "uppercase", shadow: "emboss" };
const EMPTY_FILES = ["theme", "styles", "effect"];

export const TYPES = [
  { id: "book", transition: "flip3d", layout: "auto", pagination: "perPage", available: true,
    surfaces: { cover: { width: 14, radius: 8, shadow: "strong" }, spine: { shadow: 0.5, width: 90 } } },
  { id: "scroll", transition: "roll", layout: "scroll", pagination: "columns", available: false,
    surfaces: { cover: { width: 0, radius: 0, shadow: "none", texture: "none" }, spine: { shadow: 0, width: 0 }, mount: { color: "#1d2a4a", line: "$metal", rod: "#7a2a1c" } } },
  { id: "stack", transition: "shuffle", layout: "stack", pagination: "perPage", available: false,
    surfaces: { cover: { width: 22, radius: 0, shadow: "none", texture: "none" }, spine: { shadow: 0, width: 0 } } },
  { id: "pad", transition: "slide", layout: "auto", pagination: "perPage", available: true,
    surfaces: { cover: { width: 20, radius: 20, shadow: "strong", texture: "metal" }, spine: { shadow: 0, width: 0 } } }
];

export const typeOf = files => TYPES.find(type => type.transition === files.effect.transition.type) ?? TYPES[0];

export function getPath(object, path) {
  return path.split(".").reduce((node, key) => node?.[key], object);
}

export function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let node = object;
  for (const key of keys) {
    if (!isObject(node[key])) {
      if (value === undefined) return;
      node[key] = {};
    }
    node = node[key];
  }
  if (value === undefined) delete node[last];
  else node[last] = value;
}

export function walk(node, visit) {
  for (const key of Object.keys(node)) {
    visit(node, key);
    if (isObject(node[key])) walk(node[key], visit);
  }
}

export function copyDesign(files, { name, author, visibility, moduleVersion, now }) {
  const copy = clone(files);
  const { resources } = copy.theme;
  copy.theme = { name, author: { id: author.id, name: author.name }, visibility, moduleVersion, updatedBy: author.id, updatedAt: now, resources };
  return copy;
}

export function stamp(files, { userId, moduleVersion, now }) {
  files.theme = { ...files.theme, moduleVersion, updatedBy: userId, updatedAt: now };
  return files;
}

export function applyType(files, typeId) {
  const type = TYPES.find(entry => entry.id === typeId);
  const { surfaces } = files.styles;
  files.effect.transition.type = type.transition;
  files.effect.layout = { ...files.effect.layout, mode: type.layout };
  files.effect.pagination = { mode: type.pagination };
  for (const [name, values] of Object.entries(type.surfaces)) surfaces[name] = { ...surfaces[name], ...values };
  if (typeId !== "pad" && typeId !== "book") delete surfaces.cover.image;
  if (typeId === "book") (files.styles.ornaments ??= {}).coverTitle ??= clone(COVER_TITLE);
  return files;
}

export const sheetsOf = files => files.styles.sheets ?? {};
export const sheetKeys = files => Object.keys(sheetsOf(files));
export const validSheet = (files, key) => (key in sheetsOf(files) ? key : "main");
export const retiredSheets = files => files.styles.retiredSheets ?? [];

export function addSheet(files, name, from) {
  const key = uniqueKey(identifier(name, "sheet"), new Set([...sheetKeys(files), ...retiredSheets(files), "main"]));
  (files.styles.sheets ??= {})[key] = { ...(from ? clone(files.styles.sheets[from]) : {}), name };
  return key;
}

export function removeSheet(files, key) {
  delete files.styles.sheets[key];
  if (!sheetKeys(files).length) delete files.styles.sheets;
  files.styles.retiredSheets = [...retiredSheets(files), key];
}

export function usedFonts(files) {
  const fonts = new Set();
  walk(files.styles, (node, key) => {
    if (key === "font" && typeof node[key] === "string" && !GENERIC_FONTS.has(node[key])) fonts.add(node[key]);
  });
  return [...fonts];
}

export function pendingOf(files, hasFont) {
  const images = Object.entries(files.theme.resources.images ?? {}).filter(([, image]) => image.status === "pending").map(([name]) => name);
  const fonts = usedFonts(files).filter(name => files.theme.resources.fonts?.[name]?.status === "pending" || !hasFont(name));
  return { images, fonts };
}

export const pendingCount = pending => pending.images.length + pending.fonts.length;

export function replaceFont(files, from, to) {
  walk(files.styles, (node, key) => {
    if (key === "font" && node[key] === from) node[key] = to;
  });
  const fonts = (files.theme.resources.fonts ??= {});
  if (to !== from) delete fonts[from];
  fonts[to] = { status: "ready" };
}

export function useImage(files, keyName, path) {
  const images = (files.theme.resources.images ??= {});
  const existing = Object.keys(images).find(name => images[name].path === path);
  const name = keyName ?? existing ?? uniqueKey(identifier(path.split("/").pop().replace(/\.\w+$/, ""), "image"), new Set(Object.keys(images)));
  images[name] = { path, status: "ready" };
  return name;
}

export const toThemePath = (path, root) => (path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path);

export function registerFonts(files) {
  const fonts = (files.theme.resources.fonts = {});
  for (const name of usedFonts(files)) fonts[name] = { status: "ready" };
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function fingerprint(files) {
  let hash = 0x811c9dc5;
  for (const char of EMPTY_FILES.map(name => canonical(files[name])).join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export const isDirty = (draft, saved) => canonical(draft) !== canonical(saved);

const CHANNELS = [0.2126, 0.7152, 0.0722];

function rgb(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  return hex ? [0, 2, 4].map(at => parseInt(hex[1].slice(at, at + 2), 16)) : null;
}

const luminance = channels => channels.map(c => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * CHANNELS[i], 0);

export function resolveColor(files, value) {
  return typeof value === "string" && value[0] === "$" ? files.styles.palette[value.slice(1)] : value;
}

export function contrastRatio(a, b) {
  const [first, second] = [rgb(a), rgb(b)];
  if (!first || !second) return null;
  const [high, low] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}
