import { escapeHTML, localize } from "../constants.mjs";
import { dataPath, hasFont, resourceUrl } from "../theme/store.mjs";
import { resolveColor, sheetsOf, useImage } from "../theme/design.mjs";
import { pickImage } from "./image-picker.mjs";
import { HEX, PALETTE_KEYS, clearField, fieldPaths, fieldValue, hintKey, imageOf, isInheritable, isOwn, labelKey, optionKey, orClear, parseValue, read, write } from "./schema.mjs";

const labelOf = field => localize(labelKey(field));
const optionLabel = (field, value) => localize(optionKey(field, value));
const attrs = field => ["min", "max", "step"].filter(name => field[name] != null).map(name => `${name}="${field[name]}"`).join(" ");
const paletteLabel = name => (PALETTE_KEYS.includes(name) ? localize(`Palette.${name}`) : name);
export const options = (entries, current) => entries.map(([value, label]) => `<option value="${escapeHTML(value)}"${String(value) === String(current ?? "") ? " selected" : ""}>${escapeHTML(label)}</option>`).join("");

function colorControl(field, value, ctx) {
  const palette = Object.keys(ctx.files.styles.palette).map(name => [`$${name}`, paletteLabel(name)]);
  const isPalette = typeof value === "string" && value[0] === "$" && palette.some(([key]) => key === value);
  const custom = value != null && !isPalette;
  const resolved = resolveColor(ctx.files, value);
  return `<select data-color>${options([["", "—"]], custom || isPalette ? "x" : "")}`
    + `<optgroup label="${escapeHTML(localize("Fields.paletteGroup"))}">${options(palette, isPalette ? value : "")}</optgroup>`
    + `${options([["custom", localize("Fields.custom")]], custom ? "custom" : "")}</select>`
    + `<input type="color" data-color-custom value="${HEX.test(resolved ?? "") ? resolved : "#808080"}"${custom ? "" : " hidden"}>`;
}

function fontControl(field, value) {
  const names = Object.keys(CONFIG.fontDefinitions).sort((a, b) => a.localeCompare(b));
  const missing = value && !hasFont(value) ? [[value, `⚠ ${value}`]] : [];
  return `<select data-input>${options([["", "—"], ...missing, ...names.map(name => [name, name])], value)}</select>`;
}

function imageControl(field, value, ctx) {
  const image = imageOf(ctx, value);
  const style = image && image.status !== "pending" ? ` style="background-image:url('${escapeHTML(resourceUrl(image.path))}')"` : "";
  return `<span class="bookbinder-thumb"${style}>${image ? "" : '<i class="fa-solid fa-image"></i>'}</span>`
    + `<button type="button" data-pick>${localize(image ? "Fields.change" : "Fields.choose")}</button>${image ? `<button type="button" class="icon" data-clear data-tooltip="${localize("Fields.remove")}"><i class="fa-solid fa-xmark"></i></button>` : ""}`;
}

const CONTROLS = {
  text: (field, value) => `<input type="text" data-input value="${escapeHTML(value)}" autocomplete="off">`,
  number: (field, value) => `<input type="number" data-input value="${escapeHTML(value)}" ${attrs(field)}>`,
  range: (field, value) => `<input type="range" data-input value="${escapeHTML(value ?? field.min)}" ${attrs(field)}><output>${escapeHTML(value ?? "—")}</output>`,
  toggle: (field, value) => `<input type="checkbox" data-input${value ? " checked" : ""}>`,
  swatch: (field, value) => `<input type="color" data-input value="${escapeHTML(value)}"><output>${escapeHTML(value)}</output>`,
  select: (field, value) => `<select data-input>${options([...(field.required ? [] : [["", "—"]]), ...field.values.map(entry => [entry, field.labelOf ? field.labelOf(entry) : optionLabel(field, entry)])], value)}</select>`,
  cards: (field, value) => field.options.map(option => `<button type="button" class="bookbinder-card-option${option.id === value ? " active" : ""}" data-choice="${option.id}"${option.disabled ? ' disabled data-tooltip="' + localize("Types.Later") + '"' : ""}>`
    + `<b>${localize(`Types.${option.id}.Glyph`)}</b>${localize(`Types.${option.id}.Name`)}</button>`).join(""),
  color: colorControl,
  font: fontControl,
  image: imageControl
};

function row(field, ctx, index) {
  const inherits = isInheritable(field, ctx), own = inherits && isOwn(field, ctx);
  const mark = !inherits ? "" : own
    ? `<button type="button" class="inherit" data-reset data-tooltip="${localize("Editor.ResetInherited")}"><i class="fa-solid fa-rotate-left"></i></button>`
    : `<span class="inherited" data-tooltip="${localize("Editor.InheritedHint")}">${localize("Editor.Inherited")}</span>`;
  return `<div class="bookbinder-field type-${field.type}${own ? " own" : ""}" data-field="${index}"><label>${escapeHTML(labelOf(field))}</label>`
    + `<div class="control">${CONTROLS[field.type](field, fieldValue(field, ctx), ctx)}</div>${mark}${field.hint ? `<p class="notes">${localize(hintKey(field))}</p>` : ""}</div>`;
}

export const sheetOptions = (files, current) => options([["main", localize("Editor.Main")], ...Object.entries(sheetsOf(files)).map(([key, sheet]) => [key, sheet.name])], current);

export function writeField(field, ctx, value) {
  if (field.set) field.set(ctx, value);
  else write(ctx, field.path, value);
  field.after?.(ctx, value);
  ctx.changed(field);
}

export async function chooseImage(ctx, path) {
  const key = read(ctx, path), current = imageOf(ctx, key);
  const picked = await pickImage({ current: current && dataPath(current.path) });
  if (picked === undefined) return ctx.rerender();
  write(ctx, path, useImage(ctx.files, current?.status === "pending" ? key : null, picked));
  ctx.changed(null);
  ctx.rerender();
}

function pickColor(field, view, select) {
  const custom = select.parentElement.querySelector("[data-color-custom]");
  if (select.value === "custom") writeField(field, view, HEX.test(custom.value) ? custom.value : "#808080");
  else writeField(field, view, select.value || undefined);
  view.rerender();
}

export function renderFields(host, fields, ctx) {
  const view = { ...ctx, rerender: () => renderFields(host, fields, ctx), pickImage: path => chooseImage(view, path) };
  const shown = fields.filter(field => !field.when || field.when(view));
  const fieldOf = node => shown[node.closest("[data-field]").dataset.field];
  host.innerHTML = shown.map((field, index) => (field.type === "heading" ? `<h3>${escapeHTML(localize(labelKey(field)))}</h3>` : row(field, view, index))).join("");
  host.oninput = event => {
    const input = event.target;
    if (input.matches("[data-color-custom]")) return writeField(fieldOf(input), view, input.value);
    if (!input.matches("[data-input]")) return;
    const field = fieldOf(input);
    writeField(field, view, parseValue(field, input.value, input.checked));
    if (input.nextElementSibling?.tagName === "OUTPUT") input.nextElementSibling.textContent = input.value;
  };
  host.onchange = event => {
    const input = event.target;
    if (input.matches("[data-color]")) return pickColor(fieldOf(input), view, input);
    if (!input.matches("[data-input], [data-color-custom]")) return;
    const field = fieldOf(input);
    if (field.rerender || isInheritable(field, view)) view.rerender();
  };
  host.onclick = event => {
    const target = event.target.closest("[data-reset], [data-pick], [data-clear], [data-choice]");
    if (!target) return;
    const field = fieldOf(target);
    if ("pick" in target.dataset) return view.pickImage(fieldPaths(field)[0]);
    if ("choice" in target.dataset) writeField(field, view, target.dataset.choice);
    else if ("clear" in target.dataset) writeField(field, view, orClear(view, fieldPaths(field)[0], "none"));
    else {
      clearField(field, view);
      view.changed(field);
    }
    view.rerender();
  };
}
