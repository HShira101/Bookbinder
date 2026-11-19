import { escapeHTML, localize } from "../constants.mjs";
import { canCreateThemes, canSeeTheme } from "../permissions.mjs";
import { setting } from "../settings.mjs";
import { addSheet, clone, copyDesign, removeSheet, sheetsOf, typeOf, validSheet } from "../theme/design.mjs";
import { createDesign } from "../theme/storage.mjs";
import { listThemes, moduleVersion } from "../theme/store.mjs";
import { ShellApplication } from "./app.mjs";
import { renderFields, sheetOptions } from "./fields.mjs";
import { PreviewPane } from "./preview.mjs";
import { COVER_TITLE_FONT, QUICK_TYPE, fieldPaths, isSheetPath, wizardFields } from "./schema.mjs";

const STEPS = ["Base", "Cover", "Sheets", "Typography"];
const DEFAULT_BASE = "book";

const skeleton = () => `
<ol class="bookbinder-steps"></ol>
<div class="bookbinder-wizard-main">
  <div class="bookbinder-wizard-form"></div>
  <div class="bookbinder-wizard-preview">
    <div class="bookbinder-wizard-bar"><label>${localize("Editor.Sheet")} <select data-sheet></select></label><span class="grow"></span><span class="notes">${localize("Wizard.PreviewHint")}</span></div>
    <div class="bookbinder-preview-box"></div>
  </div>
</div>
<footer class="bookbinder-wizard-footer">
  <button type="button" data-action="previous"><i class="fa-solid fa-chevron-left"></i> ${localize("Wizard.Previous")}</button>
  <button type="button" data-action="next">${localize("Wizard.Next")} <i class="fa-solid fa-chevron-right"></i></button>
  <span class="notes grow">${localize("Wizard.FinerHint")}</span>
  <button type="button" data-action="cancel">${localize("Common.Cancel")}</button>
  <button type="button" class="primary" data-action="create"><i class="fa-solid fa-check"></i> ${localize("Wizard.Create")}</button>
</footer>`;

export class DesignWizard extends ShellApplication {
  static DEFAULT_OPTIONS = {
    id: "bookbinder-wizard", classes: ["bookbinder-wizard"], position: { width: 1200, height: 780 }, window: { icon: "fa-solid fa-plus", title: "BOOKBINDER.Wizard.Title" },
    actions: {
      step(event, target) { return this.#goTo(Number(target.dataset.step)); },
      previous() { return this.#goTo(this.#step - 1); },
      next() { return this.#goTo(this.#step + 1); },
      cancel() { return this.close(); },
      create() { return this.#create(); },
      addSheet() { return this.#addSheet(); },
      removeSheet(event, target) { return this.#removeSheet(target.dataset.sheet); }
    }
  };

  static async open(baseSlug = DEFAULT_BASE) {
    if (!canCreateThemes(game.user, setting("permissions"))) {
      ui.notifications.warn(localize("Wizard.NoPermission"));
      return null;
    }
    const app = new DesignWizard();
    const { world, presets } = await listThemes();
    const usable = entry => entry.available && canSeeTheme(game.user, entry.meta);
    app.#bases = new Map([...presets, ...world].filter(usable).map(entry => [entry.slug, entry]));
    app.#setBase(app.#bases.has(baseSlug) ? baseSlug : DEFAULT_BASE, { name: "", visibility: game.user.isGM ? "all" : "author" });
    return app.render({ force: true });
  }

  #bases = new Map();
  #baseSlug;
  #draft;
  #step = 0;
  #sheet = "main";
  #preview;

  async html() {
    return skeleton();
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#preview = new PreviewPane(this.element.querySelector(".bookbinder-preview-box"));
    this.element.querySelector("[data-sheet]").addEventListener("change", event => this.#focusSheet(event.target.value));
    const enter = event => {
      const group = event.target.closest("[data-sheet-group]");
      if (group && group.dataset.sheetGroup !== this.#sheet) this.#focusSheet(group.dataset.sheetGroup);
    };
    this.element.querySelector(".bookbinder-wizard-form").addEventListener("focusin", enter);
    this.element.querySelector(".bookbinder-wizard-form").addEventListener("pointerdown", enter);
    this.#goTo(0, "cover");
  }

  _onClose(options) {
    super._onClose(options);
    this.#preview?.destroy();
  }

  #setBase(slug, { name = this.#draft?.theme.name ?? "", visibility = this.#draft?.theme.visibility } = {}) {
    this.#baseSlug = slug;
    this.#draft = copyDesign(this.#bases.get(slug).files, { name, author: game.user, visibility, moduleVersion: moduleVersion(), now: Date.now() });
    this.#sheet = "main";
  }

  #baseField() {
    return {
      id: "base", type: "select", required: true, rerender: true, hint: true, values: [...this.#bases.keys()],
      labelOf: slug => this.#bases.get(slug).name, get: () => this.#baseSlug, set: (ctx, slug) => this.#setBase(slug)
    };
  }

  #sheetGroups(fields) {
    return Object.entries(sheetsOf(this.#draft)).map(([key, sheet]) => ({ title: sheet.name, sheet: key, sheetGroup: key, removable: true, fields: fields(key) }));
  }

  #groups() {
    const draft = this.#draft;
    const [name, ...rest] = wizardFields("base");
    const sheetName = key => ({ path: `styles.sheets.${key}.name`, id: "name", type: "text" });
    return [
      [{ fields: [name, this.#baseField(), ...rest] }],
      [{ title: localize("Headings.background"), fields: wizardFields("background") }, { title: localize(`Types.${typeOf(draft).id}.Part`), fields: wizardFields("cover") }],
      [{ title: localize("Wizard.MainSheet"), sheetGroup: "main", fields: wizardFields("paper") }, { title: localize("Wizard.SubSheets"), add: true, fields: [] },
        ...this.#sheetGroups(key => [sheetName(key), ...wizardFields("paper", 2)])],
      [...(typeOf(draft).id === "book" ? [{ title: localize("Wizard.CoverTitle"), fields: [COVER_TITLE_FONT] }] : []),
        { title: localize("Wizard.MainSheet"), sheetGroup: "main", fields: QUICK_TYPE }, ...this.#sheetGroups(() => QUICK_TYPE)]
    ][this.#step];
  }

  #draw() {
    const root = this.element, form = root.querySelector(".bookbinder-wizard-form"), scroll = form.scrollTop;
    root.querySelector(".bookbinder-steps").innerHTML = STEPS.map((name, index) => `<li${index === this.#step ? ' class="active"' : ""}>`
      + `<button type="button" data-action="step" data-step="${index}"><b>${index + 1}</b>${localize(`Wizard.Step${name}`)}</button></li>`).join("");
    const select = root.querySelector("[data-sheet]");
    select.innerHTML = sheetOptions(this.#draft, validSheet(this.#draft, this.#sheet));
    select.parentElement.hidden = !Object.keys(sheetsOf(this.#draft)).length;
    root.querySelector('[data-action="previous"]').disabled = this.#step === 0;
    root.querySelector('[data-action="next"]').disabled = this.#step === STEPS.length - 1;
    form.innerHTML = "";
    for (const group of this.#groups()) {
      const extra = group.add ? `<button type="button" data-action="addSheet"><i class="fa-solid fa-plus"></i> ${localize("Wizard.Add")}</button>`
        : group.removable ? `<button type="button" data-action="removeSheet" data-sheet="${escapeHTML(group.sheet)}"><i class="fa-solid fa-trash"></i> ${localize("Wizard.Remove")}</button>` : "";
      form.insertAdjacentHTML("beforeend", `<section class="bookbinder-group"${group.sheet ? ` data-group="${escapeHTML(group.sheet)}"` : ""}${group.sheetGroup ? ` data-sheet-group="${escapeHTML(group.sheetGroup)}"` : ""}>${group.title ? `<header><h3>${escapeHTML(group.title)}</h3>${extra}</header>` : ""}<div class="bookbinder-fields"></div></section>`);
      const sheet = group.sheet ?? "main";
      renderFields(form.lastElementChild.querySelector(".bookbinder-fields"), group.fields, {
        files: this.#draft, sheet, rerender: () => this.#draw(),
        changed: field => {
          if (field && fieldPaths(field).some(isSheetPath)) this.#sheet = sheet;
          this.#showPreview();
        }
      });
    }
    form.scrollTop = scroll;
  }

  #focusSheet(key) {
    this.#sheet = key;
    this.element.querySelector("[data-sheet]").value = validSheet(this.#draft, key);
    this.#showPreview({ focus: "sheet", immediate: true });
  }

  #showPreview(options = {}) {
    this.#preview.show(this.#draft, { sheet: validSheet(this.#draft, this.#sheet), ...options });
  }

  #goTo(step, focus = "keep") {
    this.#step = Math.max(0, Math.min(STEPS.length - 1, step));
    this.#draw();
    this.#showPreview({ focus, immediate: true });
  }

  #addSheet() {
    this.#sheet = addSheet(this.#draft, localize("Editor.SheetDefault", { n: Object.keys(sheetsOf(this.#draft)).length + 1 }), null);
    this.#draw();
    this.element.querySelector(`[data-group="${this.#sheet}"]`)?.scrollIntoView({ block: "center" });
    this.#showPreview({ focus: "sheet", immediate: true });
  }

  #removeSheet(key) {
    removeSheet(this.#draft, key);
    this.#sheet = "main";
    this.#draw();
    this.#showPreview({ focus: "sheet", immediate: true });
  }

  async #create() {
    const name = this.#draft.theme.name.trim();
    if (!name) {
      this.#goTo(0);
      this.element.querySelector('.bookbinder-wizard-form input[type="text"]')?.focus();
      return ui.notifications.warn(localize("Wizard.NameRequired"));
    }
    const files = clone(this.#draft);
    files.theme.name = name;
    const result = await createDesign(files);
    if (!result.ok) return ui.notifications.error(localize("Editor.SaveFailed", { reason: result.reason ?? "?" }));
    ui.notifications.info(localize(result.queued ? "Wizard.CreatedQueued" : "Wizard.Created", { name }));
    return this.close();
  }
}
