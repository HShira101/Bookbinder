const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const NAME = /^[A-Za-z][\w-]*$/;

export const color = value => typeof value === "string"
  && (value === "transparent" || /^\$[A-Za-z]\w*$/.test(value) || /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) || /^(?:rgba?|hsla?)\([\d\s.,%/-]+\)$/i.test(value));
export const num = (min, max) => value => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
export const int = (min, max) => value => Number.isInteger(value) && value >= min && value <= max;
export const oneOf = (...values) => value => values.includes(value);
export const bool = value => typeof value === "boolean";
export const text = (max = 80) => value => typeof value === "string" && value.length <= max && !/[\u0000-\u001f]/.test(value);
export const family = value => typeof value === "string" && /^[\p{L}\p{N} .'_-]{1,80}$/u.test(value);
export const key = value => typeof value === "string" && NAME.test(value);
export const path = value => typeof value === "string" && /^[\w./-]{1,200}$/.test(value) && !value.includes("..") && /^(?:img|assets|modules\/bookbinder)\//.test(value);
export const padding = value => [].concat(value).length >= 1 && [].concat(value).length <= 4 && [].concat(value).every(num(0, 200));

export const object = (fields, { open = false } = {}) => ({ fields, open });
export const map = (item, keyOf = key) => ({ item, keyOf });

const isNode = node => isObject(node) && ("fields" in node || "item" in node);

export function sanitize(value, node, where = "", warnings = []) {
  if (!isNode(node)) {
    if (node(value)) return value;
    warnings.push({ path: where, value });
    return undefined;
  }
  if (!isObject(value)) {
    warnings.push({ path: where, value });
    return undefined;
  }
  const out = {};
  for (const [name, child] of Object.entries(value)) {
    const childNode = node.item ?? node.fields[name];
    if (!childNode || (node.item && !node.keyOf(name))) continue;
    const clean = sanitize(child, childNode, where ? `${where}.${name}` : name, warnings);
    if (clean !== undefined) out[name] = clean;
  }
  return out;
}

export function checkStructure(files, spec) {
  for (const [file, rules] of Object.entries(spec)) {
    const data = files[file];
    if (!isObject(data)) return { ok: false, issue: { path: file, message: "must be an object" } };
    for (const [name, type] of Object.entries(rules.required)) {
      if (!matches(data[name], type)) return { ok: false, issue: { path: `${file}.${name}`, message: `missing or not ${type}` } };
    }
    for (const [name, type] of Object.entries(rules.optional)) {
      if (data[name] !== undefined && !matches(data[name], type)) return { ok: false, issue: { path: `${file}.${name}`, message: `not ${type}` } };
    }
    const known = new Set([...Object.keys(rules.required), ...Object.keys(rules.optional)]);
    const extra = Object.keys(data).find(name => !known.has(name));
    if (extra) return { ok: false, issue: { path: `${file}.${extra}`, message: "unknown block" } };
  }
  return { ok: true };
}

const matches = (value, type) => type === "object" ? isObject(value) : typeof value === type;
