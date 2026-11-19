import { canCreateThemes, canDeleteTheme, canEditTheme, canSeeTheme } from "../scripts/permissions.mjs";
import { path as isPath } from "../scripts/theme/schema.mjs";
import { TYPES, addSheet, applyType, canonical, clone, contrastRatio, copyDesign, fingerprint, getPath, isDirty, pendingOf, removeSheet, replaceFont, resolveColor, setPath, sheetKeys, stamp, toThemePath, typeOf, useImage, usedFonts, validSheet } from "../scripts/theme/design.mjs";
import { upgradeFiles } from "../scripts/theme/migrations.mjs";
import { identifier, slugify, uniqueKey, versionName } from "../scripts/theme/slug.mjs";
import { equal, test, truthy } from "./harness.mjs";

const gm = { id: "gm1", isGM: true };
const ana = { id: "ana", isGM: false };
const bruno = { id: "bruno", isGM: false };
const meta = (author, visibility) => ({ author: { id: author }, visibility });

const sample = () => ({
  theme: { name: "Grimoire", author: { id: "ana", name: "Ana" }, visibility: "all", moduleVersion: "0.2.5", importedFrom: "Mirko", resources: { images: { cover: { path: "img/g/cover.webp", status: "ready" }, paper: { path: "img/g/paper.webp", status: "pending" } }, fonts: { Amiri: { status: "ready" } } } },
  styles: {
    palette: { ink: "#101010", paper: "#ffffff", accent: "#aa0000" },
    surfaces: { cover: { color: "$ink", width: 14 }, paper: { color: "$paper" }, spine: { shadow: 0.5, width: 90 } },
    typography: { base: { font: "Amiri", fallback: "Signika", size: 15, color: "$ink" } },
    elements: { h1: { font: "Orbitron", color: "$accent" } },
    ornaments: {}
  },
  effect: { transition: { type: "flip3d", durationMs: 900 }, layout: { mode: "auto" }, pagination: { mode: "perPage" } }
});

test("permissions: GMs always, players only when listed (PERM-01, PERM-03, PERM-05)", () => {
  truthy(canCreateThemes(gm, []), "gm");
  truthy(!canCreateThemes(ana, []), "unlisted player");
  truthy(canCreateThemes(ana, ["ana"]), "listed player");
});

test("permissions: players edit only their own themes, only the GM deletes (PERM-08)", () => {
  truthy(canEditTheme(gm, meta("ana", "all"), []), "gm edits any");
  truthy(canEditTheme(ana, meta("ana", "author"), ["ana"]), "own");
  truthy(!canEditTheme(ana, meta("bruno", "all"), ["ana"]), "other's");
  truthy(!canEditTheme(ana, meta("ana", "all"), []), "lost the permission");
  truthy(canDeleteTheme(gm) && !canDeleteTheme(ana), "delete");
});

test("permissions: private themes are hidden except from author and GM (PERM-13, FMT-28)", () => {
  truthy(canSeeTheme(bruno, meta("ana", "all")), "shared");
  truthy(!canSeeTheme(bruno, meta("ana", "author")), "private");
  truthy(!canSeeTheme(bruno, { author: { id: "ana" } }), "missing visibility counts as private");
  truthy(canSeeTheme(ana, meta("ana", "author")) && canSeeTheme(gm, meta("ana", "author")), "author and gm");
});

test("slugs and keys: accents, collisions, leading digits and version names (ALM-03, EDT-19)", () => {
  equal(slugify("Diario de Épica Magia!"), "diario-de-epica-magia");
  equal(uniqueKey("book", new Set(["book", "book-2"])), "book-3");
  equal(identifier("3 cartas", "sheet"), "sheet-3-cartas");
  equal(versionName("Grimoire", new Set(["Grimoire v2"])), "Grimoire v3");
  equal(versionName("Grimoire v2", new Set()), "Grimoire v2");
});

test("copyDesign keeps resources and drops import and revision data (PLT-04, FMT-01)", () => {
  const copy = copyDesign(sample(), { name: "Mine", author: { id: "bruno", name: "Bruno" }, visibility: "author", moduleVersion: "0.3.0", now: 5 });
  equal(copy.theme, { name: "Mine", author: { id: "bruno", name: "Bruno" }, visibility: "author", moduleVersion: "0.3.0", updatedBy: "bruno", updatedAt: 5, resources: sample().theme.resources });
});

test("applyType sets transition, layout and per-type surfaces (PLT-10)", () => {
  const files = applyType(sample(), "pad");
  equal([files.effect.transition.type, typeOf(files).id, files.styles.surfaces.cover.texture, files.styles.surfaces.spine.width], ["slide", "pad", "metal", 0]);
  const scroll = applyType(sample(), "scroll");
  equal([scroll.effect.layout.mode, scroll.effect.pagination.mode, scroll.styles.surfaces.mount.rod], ["scroll", "columns", "#7a2a1c"]);
  truthy(applyType(sample(), "book").styles.ornaments.coverTitle.layout === "center", "cover title for books");
  equal(TYPES.filter(type => type.available).map(type => type.id), ["book", "pad"]);
});

test("sub-sheets: add, duplicate, remove and never reuse a removed key (EDT-22, EDT-23)", () => {
  const files = sample();
  const letter = addSheet(files, "Carta", null);
  const copy = addSheet(files, "Carta 2", letter);
  files.styles.sheets[letter].paper = { color: "#fff7e0" };
  equal([letter, copy, sheetKeys(files)], ["carta", "carta-2", ["carta", "carta-2"]]);
  equal(addSheet(files, "Otra", "carta").length > 0, true);
  removeSheet(files, letter);
  equal(addSheet(files, "Carta", null), "carta-3");
  equal([validSheet(files, "carta"), validSheet(files, "carta-2")], ["main", "carta-2"]);
  const lone = sample();
  removeSheet(lone, addSheet(lone, "Solo", null));
  truthy(!("sheets" in lone.styles) && lone.styles.retiredSheets[0] === "solo", "empty sheets map is dropped");
});

test("retiredSheets survives the theme reader (FMT-32)", () => {
  const files = sample();
  files.styles.retiredSheets = ["old", "older"];
  const result = upgradeFiles(files, "0.3.0");
  truthy(result.ok, "upgrade");
  equal(result.files.styles.retiredSheets, ["old", "older"]);
  files.styles.retiredSheets = "nope";
  truthy(!upgradeFiles(files, "0.3.0").ok, "a non-list is a structure error");
});

test("pending resources: images, fonts missing from Foundry and unconfirmed fonts (FMT-08, TIP-21)", () => {
  const files = sample();
  const pending = pendingOf(files, name => name === "Amiri");
  equal(pending, { images: ["paper"], fonts: ["Orbitron"] });
  files.theme.resources.fonts.Amiri.status = "pending";
  equal(pendingOf(files, () => true).fonts, ["Amiri"]);
  equal(usedFonts(files).sort(), ["Amiri", "Orbitron"]);
});

test("replaceFont and useImage resolve pending resources (EDT-11, IMP-07)", () => {
  const files = sample();
  replaceFont(files, "Orbitron", "Signika");
  equal([files.styles.elements.h1.font, files.theme.resources.fonts.Signika, "Orbitron" in files.theme.resources.fonts], ["Signika", { status: "ready" }, false]);
  equal(useImage(files, "paper", "img/g/new.webp"), "paper");
  equal(files.theme.resources.images.paper, { path: "img/g/new.webp", status: "ready" });
  equal(useImage(files, null, "img/g/cover.webp"), "cover");
  equal(useImage(files, null, "img/other/Mi Tapa.png"), "mi-tapa");
});

test("fingerprint ignores key order and changes with any content (EDT-26)", () => {
  const a = sample();
  const b = { effect: a.effect, styles: a.styles, theme: { resources: a.theme.resources, ...a.theme } };
  equal(fingerprint(a), fingerprint(b));
  const changed = clone(a);
  changed.styles.palette.ink = "#111111";
  truthy(fingerprint(changed) !== fingerprint(a), "changed");
  truthy(isDirty(changed, a) && !isDirty(b, a), "dirty");
  equal(canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
});

test("stamp writes who saved last and with which version (FMT-33, EDT-28)", () => {
  const files = stamp(sample(), { userId: "ana", moduleVersion: "0.3.0", now: 99 });
  equal([files.theme.updatedBy, files.theme.updatedAt, files.theme.moduleVersion], ["ana", 99, "0.3.0"]);
});

test("contrast ratio follows WCAG and resolves palette references (EDT-07)", () => {
  equal(contrastRatio("#000000", "#ffffff").toFixed(1), "21.0");
  equal(contrastRatio("#777777", "#808080").toFixed(1), "1.1");
  equal(contrastRatio("rgba(0,0,0,.5)", "#ffffff"), null);
  equal(resolveColor(sample(), "$accent"), "#aa0000");
});

test("getPath and setPath create and remove nested values", () => {
  const object = { a: { b: 1 } };
  setPath(object, "a.c.d", 2);
  equal(getPath(object, "a.c.d"), 2);
  setPath(object, "a.c.d", undefined);
  setPath(object, "x.y", undefined);
  equal(object, { a: { b: 1, c: {} } });
});

const fakeJournal = (theme, sheets) => ({
  getFlag: (scope, key) => (key === "theme" ? theme : undefined),
  pages: { filter: test => sheets.map(sheet => ({ getFlag: (scope, key) => (key === "sheet" ? sheet : undefined) })).filter(test) }
});

test("usage: pages per sub-sheet only count in journals that use the theme (EDT-23)", async () => {
  const { countSheetPages, usesTheme } = await import("../scripts/theme/usage.mjs");
  const journals = [fakeJournal("grimoire", ["letter", "letter", undefined]), fakeJournal("grimoire", ["report"]), fakeJournal("other", ["letter"])];
  equal([countSheetPages(journals, "grimoire", "letter"), countSheetPages(journals, "grimoire", "report"), countSheetPages(journals, "grimoire", "gone")], [2, 1, 0]);
  truthy(usesTheme(journals[0], "grimoire") && !usesTheme(journals[2], "grimoire"), "usesTheme");
});

test("image paths from Foundry's file picker are stored relative to the theme folder or kept as Data paths (FMT-10)", () => {
  const root = "worlds/w/Bookbinder_themes";
  equal([toThemePath(`${root}/img/x/a.png`, root), toThemePath("icons/svg/book.svg", root), toThemePath("modules/bookbinder/presets/img/book/cover.svg", root)], ["img/x/a.png", "icons/svg/book.svg", "modules/bookbinder/presets/img/book/cover.svg"]);
});

test("image path validator accepts Data paths and rejects traversal, protocols and absolute paths (FMT-05)", () => {
  for (const good of ["img/x/a.png", "icons/svg/book.svg", "worlds/w/mapa de ñandú.webp", "modules/bookbinder/presets/img/book/cover.svg"]) truthy(isPath(good), good);
  for (const bad of ["../secret.png", "img/../../x.png", "https://evil/x.png", "data:image/png;base64,AAAA", "/etc/passwd", "img/x\\y.png", ""]) truthy(!isPath(bad), bad);
});
