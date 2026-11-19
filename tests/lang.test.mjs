import { TYPES } from "../scripts/theme/design.mjs";
import { ELEMENTS, PALETTE_KEYS, SECTIONS, allFields, hintKey, labelKey, optionKey, sectionIds } from "../scripts/ui/schema.mjs";
import { equal, test, truthy } from "./harness.mjs";

const LANGS = ["es", "en"];
const SOURCES = ["ui/app", "ui/card", "ui/dialogs", "ui/editor", "ui/fields", "ui/font-picker", "ui/image-picker", "ui/manager", "ui/permissions-app", "ui/preview", "ui/sample", "ui/transfer", "ui/wizard", "theme-menu", "theme/storage", "sheet/book-sheet"];
const loadLang = async lang => (await (await fetch(`../lang/${lang}.json`)).json()).BOOKBINDER;
const has = (doc, key) => typeof key.split(".").reduce((node, part) => node?.[part], doc) === "string";

async function missing(keys) {
  const out = [];
  for (const lang of LANGS) {
    const doc = await loadLang(lang);
    for (const key of keys) if (!has(doc, key)) out.push(`${lang}:${key}`);
  }
  return out;
}

const schemaKeys = () => {
  const keys = new Set();
  for (const field of allFields()) {
    if (field.type !== "cards") keys.add(labelKey(field));
    if (field.hint) keys.add(hintKey(field));
    for (const value of field.group && !field.labelOf ? field.values ?? [] : []) keys.add(optionKey(field, value));
  }
  for (const id of ["base", "background", "paper", "type", "ornaments", "effect", "resources"]) keys.add(`Sections.${id}`);
  for (const element of ELEMENTS) keys.add(`Elements.${element.id}`);
  for (const name of PALETTE_KEYS) [`Palette.${name}`, `Fields.palette.${name}`].forEach(key => keys.add(key));
  for (const type of TYPES) ["Glyph", "Name", "Part"].forEach(part => keys.add(`Types.${type.id}.${part}`));
  for (const section of Object.values(SECTIONS).flat()) if (section.type === "heading") keys.add(labelKey(section));
  return [...keys];
};

test("every label, option, hint, element, section and type in the editor schema is translated", async () => {
  equal(await missing(schemaKeys()), []);
});

test("every static localize key in the interface code exists in es and en", async () => {
  const keys = new Set();
  for (const file of SOURCES) {
    const text = await (await fetch(`../scripts/${file}.mjs`)).text();
    for (const [, key] of text.matchAll(/localize\(\s*"([A-Za-z][\w.]*)"/g)) keys.add(key);
    for (const [, key] of text.matchAll(/(?:button\([^,]+,|ask\([^)]*|confirm:)\s*"([A-Z][\w.]+)"/g)) keys.add(key);
  }
  truthy(keys.size > 80, `scanned ${keys.size} keys`);
  equal(await missing([...keys]), []);
});

test("both languages define exactly the same keys", async () => {
  const flat = (node, prefix = "") => Object.entries(node).flatMap(([name, value]) => (typeof value === "object" ? flat(value, `${prefix}${name}.`) : [`${prefix}${name}`]));
  const [es, en] = await Promise.all(LANGS.map(async lang => new Set(flat(await loadLang(lang)))));
  equal([...es].filter(key => !en.has(key)), []);
  equal([...en].filter(key => !es.has(key)), []);
});

test("dynamic keys built from the sample, wizard steps and checks are translated", async () => {
  const sample = ["Title", "Subtitle", "Author", "Chapter1", "Lead", "Inline", "Quote", "QuoteBy", "After", "ListTitle", "ListIntro", "Ul1", "Ul2", "Ul3", "Ol1", "Ol2", "Ol3", "Th1", "Th2", "Th3",
    "Row11", "Row12", "Row13", "Row21", "Row22", "Row23", "Row31", "Row32", "Row33", "FoundryTitle", "Foundry", "SecretTitle", "Secret", "MapTitle", "Caption", "Chapter2", "Prose1", "Prose2", "Prose3"];
  const keys = [...sample.map(name => `Sample.${name}`), ...["Base", "Cover", "Sheets", "Typography"].map(name => `Wizard.Step${name}`), "Options.visibility.all", "Options.visibility.author", ...sectionIds("main").filter(id => id !== "cover").map(id => `Sections.${id}`)];
  equal(await missing(keys), []);
});
