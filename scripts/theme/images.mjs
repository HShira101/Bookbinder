import { fetchJSON, picker, presetRoot, resourceUrl, worldRoot } from "./store.mjs";
import { ensureDirectory, uploadJSON } from "./storage.mjs";
import { identifier } from "./slug.mjs";

const catalogRoot = () => `${worldRoot()}/assets`;
const fileKey = path => path.split("/").at(-1).replace(/\.\w+$/, "");
const groupOf = path => (path.startsWith("modules/") ? path.split("/").at(-2) : "world");

async function readList(root) {
  const list = await fetchJSON(`${root}/images.json`, true).catch(() => []);
  return Array.isArray(list) ? list : [];
}

export async function readCatalog() {
  const [own, templates] = await Promise.all([readList(catalogRoot()), readList(`${presetRoot()}/assets`)]);
  return [...own, ...templates].map(path => ({ path, name: fileKey(path), group: groupOf(path), url: resourceUrl(path) }));
}

export async function uploadImage(file, folder) {
  const extension = file.name.split(".").at(-1).toLowerCase();
  const name = `${identifier(fileKey(file.name), "image")}-${Date.now().toString(36)}.${extension}`;
  const directory = `${worldRoot()}/img/${identifier(folder, "design")}`;
  await ensureDirectory(directory);
  await picker().upload("data", directory, new File([file], name, { type: file.type }), {}, { notify: false });
  const path = `${directory.slice(worldRoot().length + 1)}/${name}`;
  await uploadJSON(catalogRoot(), "images.json", [...(await readList(catalogRoot())), path]);
  return path;
}
