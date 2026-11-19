export const slugify = name => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "theme";

export const identifier = (text, prefix) => {
  const slug = slugify(text);
  return /^[a-z]/.test(slug) ? slug : `${prefix}-${slug}`;
};

export function uniqueKey(base, taken) {
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  return key;
}

export function versionName(name, takenNames) {
  const base = name.replace(/ v\d+$/, "");
  for (let n = 2; ; n++) if (!takenNames.has(`${base} v${n}`)) return `${base} v${n}`;
}
