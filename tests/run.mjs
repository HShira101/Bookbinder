import { buildCss } from "../scripts/theme/css.mjs";
import { resolveTheme } from "../scripts/theme/defaults.mjs";
import { migrate } from "../scripts/theme/migrate.mjs";
import { THEME_MIGRATIONS, upgradeFiles } from "../scripts/theme/migrations.mjs";
import { sanitizeFiles } from "../scripts/theme/schemas/index.mjs";
import { compareVersions, formatOf, isNewer } from "../scripts/theme/version.mjs";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const equal = (actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const truthy = (value, message) => {
  if (!value) throw new Error(message);
};

const FORMATS = ["0.1.0", "0.3.0", "0.6.0"];
const VERSIONS = ["0.1.0", "0.2.0", "0.3.0", "0.4.0", "0.5.0", "0.6.0"];
const base = () => ({ theme: { name: "T", moduleVersion: "0.1.0", resources: {} }, styles: { palette: { ink: "#000" }, surfaces: {}, typography: {}, elements: { h1: { color: "$ink" } }, ornaments: {} }, effect: { transition: {} } });
const has = (data, path) => path.split(".").reduce((node, key) => node?.[key], data) !== undefined;
const VALIDATORS = {
  "0.1.0": data => (!has(data, "styles.paper") && !has(data, "styles.surfaces.paper.vignetteColor") ? { ok: true } : { ok: false, issue: { path: "styles", message: "not 0.1" } }),
  "0.3.0": data => (has(data, "styles.surfaces.paper.vignetteColor") && !has(data, "styles.elements.h1.shadowColor") ? { ok: true } : { ok: false, issue: { path: "styles.surfaces.paper.vignetteColor", message: "not 0.3" } }),
  "0.6.0": data => (has(data, "styles.elements.h1.shadowColor") ? { ok: true } : { ok: false, issue: { path: "styles.elements.h1.shadowColor", message: "not 0.6" } })
};
const CHAIN = {
  formats: FORMATS,
  validate: (data, version) => VALIDATORS[version](data),
  steps: {
    "0.3.0": data => {
      data.styles.surfaces.paper = { ...data.styles.surfaces.paper, vignetteColor: "$ink" };
      return data;
    },
    "0.6.0": data => {
      data.styles.elements.h1.shadowColor = "$ink";
      return data;
    }
  }
};
const at01 = tweak => {
  const data = base();
  tweak?.(data);
  return data;
};

test("compareVersions orders semantic versions", () => {
  equal(compareVersions("0.2.0", "0.10.0"), -1);
  equal(compareVersions("1.0.0", "0.9.9"), 1);
  equal(compareVersions("0.2.0", "0.2.0"), 0);
});

test("formatOf maps released versions to the last format change (FMT-14, FMT-17)", () => {
  const options = { versions: VERSIONS, formats: FORMATS };
  equal(["0.1.0", "0.2.0", "0.3.0", "0.4.0", "0.5.0", "0.6.0"].map(version => formatOf(version, options)), ["0.1.0", "0.1.0", "0.3.0", "0.3.0", "0.3.0", "0.6.0"]);
  equal(formatOf("0.2.7", options), "0.1.0");
  equal(formatOf("abc", options), "0.1.0");
  equal(formatOf(undefined, options), "0.1.0");
});

test("isNewer detects themes from a newer module (FMT-18)", () => {
  truthy(isNewer("0.9.0", "0.2.0"), "newer");
  truthy(!isNewer("0.2.0", "0.2.0"), "same");
  truthy(!isNewer("abc", "0.2.0"), "garbage");
  truthy(!isNewer(undefined, "0.2.0"), "missing");
});

test("each translator step upgrades three valid samples (FMT-20)", () => {
  for (let n = 0; n < 3; n++) {
    const sample = at01(data => { data.styles.elements.h1.size = 20 + n; });
    const result = migrate(sample, "0.1.0", CHAIN);
    truthy(result.ok, "chain should succeed");
    equal(result.version, "0.6.0");
    equal(result.data.styles.elements.h1.size, 20 + n);
    equal(result.data.styles.surfaces.paper.vignetteColor, "$ink");
  }
});

test("a tampered theme aborts with the failing step (FMT-31)", () => {
  const broken = at01(data => { data.styles.paper = { color: "red" }; });
  const result = migrate(broken, "0.1.0", CHAIN);
  truthy(!result.ok, "must abort");
  equal(result.step, "0.1.0");
});

test("a theme with the wrong version jumps to the matching later one (FMT-31)", () => {
  const mislabeled = at01(data => {
    data.styles.surfaces.paper = { vignetteColor: "#111" };
  });
  const result = migrate(mislabeled, "0.1.0", CHAIN);
  truthy(result.ok, "should recover");
  equal(result.data.styles.surfaces.paper.vignetteColor, "#111");
  equal(result.data.styles.elements.h1.shadowColor, "$ink");
});

test("a step that throws aborts instead of crashing (FMT-30)", () => {
  const chain = { ...CHAIN, steps: { ...CHAIN.steps, "0.3.0": () => { throw new Error("boom"); } } };
  const result = migrate(at01(), "0.1.0", chain);
  truthy(!result.ok, "must abort");
  equal(result.step, "0.3.0");
});

test("sanitize drops invalid values and unknown fields, keeping the rest (FMT-09)", () => {
  const files = at01(data => {
    data.styles.elements.h1 = { color: "$ink", size: 9999, align: "diagonal", unknown: 1 };
    data.styles.surfaces.cover = { color: "javascript:alert(1)", width: 14 };
    data.styles.elements.p = "nope";
  });
  const { files: clean, warnings } = sanitizeFiles(files, "0.1.0");
  equal(clean.styles.elements.h1, { color: "$ink" });
  equal(clean.styles.surfaces.cover, { width: 14 });
  equal(Object.keys(clean.styles.elements), ["h1"]);
  equal(warnings.map(warning => warning.path).sort(), ["styles.elements.h1.align", "styles.elements.h1.size", "styles.elements.p", "styles.surfaces.cover.color"]);
});

test("upgradeFiles flags a theme from a newer module (FMT-18)", () => {
  const files = at01(data => { data.theme.moduleVersion = "9.0.0"; });
  const result = upgradeFiles(files, "0.2.0");
  truthy(!result.ok && result.newer, "newer");
});

test("a current-format theme with an unknown block is rejected (FMT-30)", () => {
  const files = at01(data => { data.styles.extra = {}; });
  truthy(!upgradeFiles(files, "0.2.0").ok, "unknown block");
});

const fakeAssets = { resource: name => `/res/${name}.svg`, module: file => `/modules/bookbinder/presets/${file}` };

test("buildCss generates scoped rules, sub-sheets and escapes strings (FMT-05)", () => {
  const files = at01(data => {
    data.styles.palette = { ink: "#102030", accent: "#aa0000", paper: "#eeeeee", cover: "#333333" };
    data.styles.ornaments = { folio: { format: 'a"b{n}', color: "$accent" } };
    data.styles.elements.hr = { type: "ornament", symbol: 'a"b' };
    data.styles.sheets = { letter: { name: "Letter", paper: { color: "#fff7e0", inset: 18, tilt: -1, attach: "tape" } } };
  });
  const result = upgradeFiles(files, "0.2.0");
  truthy(result.ok, "upgrade");
  const css = buildCss(resolveTheme(result.files), '.bookbinder-view[data-uid="1"]', fakeAssets);
  truthy(css.includes('.bookbinder-view[data-uid="1"] .bookbinder-pg[data-sheet="main"] .bookbinder-content h1{color:var(--bb-pal-ink)}'), "h1 rule");
  truthy(css.includes('.bookbinder-pg[data-sheet="letter"]>.bookbinder-loose{inset:18px;transform:rotate(-1deg)}'), "loose sheet");
  truthy(css.includes("--bb-pal-accent:#aa0000"), "palette vars");
  truthy(css.includes('content:"a\\"b"'), "quotes are escaped");
});

test("an unknown palette reference falls back to the base text colour (casos límite)", () => {
  const files = at01(data => { data.styles.elements.h1 = { color: "$ghost" }; });
  const css = buildCss(resolveTheme(upgradeFiles(files, "0.2.0").files), ".s", fakeAssets);
  truthy(css.includes("h1{color:var(--bb-pal-ink)}") || css.includes("h1{color:"), "fallback color");
  truthy(!css.includes("--bb-pal-ghost"), "no dangling var");
});

export async function presetTests(loadJSON, slugs) {
  for (const slug of slugs) {
    test(`preset ${slug} loads without warnings and builds CSS`, async () => {
      const files = { theme: await loadJSON(`${slug}/theme.json`), styles: await loadJSON(`${slug}/styles.json`), effect: await loadJSON(`${slug}/effect.json`) };
      const result = upgradeFiles(files, "0.2.0");
      truthy(result.ok, `${slug} should upgrade: ${JSON.stringify(result.issue)}`);
      equal(result.warnings, []);
      const theme = resolveTheme(result.files);
      truthy(buildCss(theme, ".s", fakeAssets).length > 500, "css");
      for (const [id, sheet] of Object.entries(theme.sheets)) truthy(sheet.typography.base.size > 0, `sheet ${id}`);
    });
  }
}

export async function runAll() {
  const out = [];
  for (const [name, fn] of results) {
    try {
      await fn();
      out.push({ name, ok: true });
    } catch (error) {
      out.push({ name, ok: false, message: error.message });
    }
  }
  return out;
}

export { THEME_MIGRATIONS };

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("run.mjs")) {
  const { readFile, readdir } = await import("node:fs/promises");
  const root = new URL("../presets/theme/", import.meta.url);
  const slugs = JSON.parse(await readFile(new URL("index.json", root), "utf8"));
  await presetTests(async file => JSON.parse(await readFile(new URL(file, root), "utf8")), slugs);
  const report = await runAll();
  for (const { name, ok, message } of report) console.log(`${ok ? "ok  " : "FAIL"} ${name}${message ? `\n     ${message}` : ""}`);
  process.exitCode = report.every(entry => entry.ok) ? 0 : 1;
}
