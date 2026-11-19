import { escapeHTML, localize, userName } from "../constants.mjs";
import { canEditTheme } from "../permissions.mjs";
import { setting } from "../settings.mjs";
import { addSheet, clone, contrastRatio, fingerprint, getPath, isDirty, pendingCount, pendingOf, removeSheet, replaceFont, resolveColor, sheetKeys, sheetsOf, stamp, typeOf, useImage, usedFonts, validSheet } from "../theme/design.mjs";
import { versionName } from "../theme/slug.mjs";
import { createDesign, currentFiles, saveDesign } from "../theme/storage.mjs";
import { dataPath, forgetTheme, hasFont, listThemes, loadTheme, moduleVersion } from "../theme/store.mjs";
import { countSheetPages, findUsage } from "../theme/usage.mjs";
import { ShellApplication } from "./app.mjs";
import { ask, button, confirmClose, confirmSave, promptForm } from "./dialogs.mjs";
import { options, renderFields, sheetOptions } from "./fields.mjs";
import { pickImage } from "./image-picker.mjs";
import { PreviewPane } from "./preview.mjs";
import { ELEMENTS, SECTIONS, elementFields, elementRoot, read, sectionIds, sheetPath } from "./schema.mjs";

const CHANGED = "bookbinder.themeChanged";
const idOf = slug => `bookbinder-editor-${slug}`;

const skeleton = () => `
<div class="bookbinder-editor-bar">
  <label>${localize("Editor.Sheet")} <select data-sheet></select></label>
  <button type="button" data-action="addSheet"><i class="fa-solid fa-plus"></i> ${localize("Editor.AddSheet")}</button>
  <button type="button" data-action="renameSheet" data-sub>${localize("Editor.RenameSheet")}</button>
  <button type="button" data-action="deleteSheet" data-sub><i class="fa-solid fa-trash"></i> ${localize("Editor.DeleteSheet")}</button>
  <span class="grow"></span>
  <label>${localize("Editor.PreviewWith")} <select data-journal></select></label>
  <button type="button" data-action="discard">${localize("Editor.Discard")}</button>
  <button type="button" class="primary" data-action="save"><i class="fa-solid fa-floppy-disk"></i> ${localize("Editor.Save")}</button>
</div>
<div class="bookbinder-editor-main">
  <nav class="bookbinder-editor-nav"></nav>
  <div class="bookbinder-editor-work">
    <div class="bookbinder-editor-preview"><div class="bookbinder-preview-box"></div>
      <div class="bookbinder-try"><button type="button" data-action="turnBack" aria-label="${localize("Book.Previous")}"><i class="fa-solid fa-chevron-left"></i></button><span>${localize("Editor.TryTransition")}</span><button type="button" data-action="turnForward" aria-label="${localize("Book.Next")}"><i class="fa-solid fa-chevron-right"></i></button></div></div>
    <section class="bookbinder-editor-props"><header><h2></h2><span class="bookbinder-chip warn" data-contrast hidden></span><span class="grow"></span><span class="notes">${localize("Editor.PickHint")}</span></header><div class="bookbinder-fields"></div></section>
  </div>
</div>`;

export class DesignEditor extends ShellApplication {
  static DEFAULT_OPTIONS = {
    classes: ["bookbinder-editor"], position: { width: 1280, height: 860 }, window: { icon: "fa-solid fa-pen" },
    actions: {
      save() { return this.save(); },
      discard() { return this.#discard(); },
      section(event, target) { return this.#select({ section: target.dataset.section }); },
      element(event, target) { return this.#select({ section: "type", element: target.dataset.element }); },
      addSheet() { return this.#addSheet(); },
      renameSheet() { return this.#renameSheet(); },
      deleteSheet() { return this.#deleteSheet(); },
      turnBack() { return this.#preview.turn(-1); },
      turnForward() { return this.#preview.turn(1); }
    }
  };

  static async open(slug, { section = "base" } = {}) {
    const existing = foundry.applications.instances.get(idOf(slug));
    if (existing) {
      existing.#select({ section });
      return existing.bringToFront();
    }
    forgetTheme(slug);
    const result = await loadTheme(slug);
    if (!result.ok || result.source === "preset" || !canEditTheme(game.user, result.files.theme, setting("permissions"))) {
      ui.notifications.warn(localize("Editor.CannotEdit"));
      return null;
    }
    const app = new DesignEditor({ id: idOf(slug), slug });
    app.#baseline = fingerprint(await currentFiles(slug) ?? result.files);
    app.#saved = result.files;
    app.#draft = clone(result.files);
    app.#section = section;
    return app.render({ force: true });
  }

  #slug = this.options.slug;
  #baseline;
  #saved;
  #draft;
  #sheet = "main";
  #section = "base";
  #element = "base";
  #journalId = "";
  #preview;
  #hook;
  #closing = false;

  get title() {
    const pending = pendingCount(pendingOf(this.#draft, hasFont));
    return localize("Editor.Title", { name: this.#draft.theme.name, author: this.#draft.theme.author?.name ?? "?" })
      + (pending ? ` · ⚠ ${localize("Editor.PendingCount", { count: pending })}` : "") + (isDirty(this.#draft, this.#saved) ? ` · ${localize("Editor.Unsaved")}` : "");
  }

  get #context() {
    return { files: this.#draft, sheet: this.#sheet, changed: () => this.#touched(), rerender: () => this.#drawProps() };
  }

  get #elementDef() {
    return ELEMENTS.find(entry => entry.id === this.#element);
  }

  async html() {
    return skeleton();
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    const root = this.element;
    this.#preview = new PreviewPane(root.querySelector(".bookbinder-preview-box"), { onPick: target => this.#select(target) });
    this.#hook = Hooks.on(CHANGED, (slug, userId) => {
      if (slug === this.#slug && userId !== game.user.id) ui.notifications.info(localize("Editor.SavedByOther", { user: userName(userId) }));
    });
    root.addEventListener("change", event => {
      if (event.target.matches("[data-sheet]")) this.#setSheet(event.target.value);
      else if (event.target.matches("[data-journal]")) this.#setJournal(event.target.value);
    });
    root.querySelector(".bookbinder-fields").addEventListener("change", event => {
      const font = event.target.closest("[data-font-for]");
      if (!font) return;
      replaceFont(this.#draft, font.dataset.fontFor, font.value);
      this.#touched();
      this.#drawProps();
    });
    root.querySelector(".bookbinder-fields").addEventListener("click", event => {
      const resolve = event.target.closest("[data-resolve-image]");
      if (resolve) this.#resolveImage(resolve.dataset.resolveImage);
    });
    this.#drawAll("cover");
  }

  _onClose(options) {
    super._onClose(options);
    Hooks.off(CHANGED, this.#hook);
    this.#preview?.destroy();
  }

  async close(options = {}) {
    if (this.#closing || !isDirty(this.#draft, this.#saved)) return super.close(options);
    const choice = await confirmClose(this.#draft.theme.name);
    if (!choice || choice === "keep") return this;
    if (choice === "save" && !(await this.save())) return this;
    this.#closing = true;
    return super.close(options);
  }

  #drawAll(focus = "keep") {
    this.#sheet = validSheet(this.#draft, this.#sheet);
    this.#drawBar();
    this.#drawNav();
    this.#drawProps();
    this.#drawTitle();
    this.#showPreview({ focus });
  }

  #drawTitle() {
    const title = this.element.querySelector(".window-title");
    if (title) title.textContent = this.title;
    const dirty = isDirty(this.#draft, this.#saved);
    this.element.querySelectorAll('[data-action="save"], [data-action="discard"]').forEach(node => { node.disabled = !dirty; });
  }

  #drawBar() {
    const root = this.element;
    root.querySelector("[data-sheet]").innerHTML = sheetOptions(this.#draft, this.#sheet);
    const journals = game.journals.filter(journal => journal.testUserPermission(game.user, "OBSERVER"));
    root.querySelector("[data-journal]").innerHTML = options([["", localize("Editor.SampleText")], ...journals.map(journal => [journal.id, journal.name])], this.#journalId);
    root.querySelectorAll("[data-sub]").forEach(node => { node.hidden = this.#sheet === "main"; });
  }

  #drawNav() {
    const ids = sectionIds(this.#sheet);
    if (!ids.includes(this.#section)) this.#section = "paper";
    const count = pendingCount(pendingOf(this.#draft, hasFont));
    const edited = entry => this.#sheet !== "main" && Object.keys(getPath(this.#draft, sheetPath(elementRoot(entry), this.#sheet)) ?? {}).length > 0;
    const elements = ELEMENTS.map(entry => `<button type="button" data-action="element" data-element="${entry.id}" class="${this.#section === "type" && entry.id === this.#element ? "active" : ""}">`
      + `${localize(`Elements.${entry.id}`)}${edited(entry) ? '<i class="own-dot"></i>' : ""}</button>`).join("");
    const label = id => (id === "cover" ? localize(`Types.${typeOf(this.#draft).id}.Part`) : localize(`Sections.${id}`));
    this.element.querySelector(".bookbinder-editor-nav").innerHTML = ids.map(id => `<button type="button" data-action="section" data-section="${id}" class="${id === this.#section ? "active" : ""}">`
      + `${escapeHTML(label(id))}${id === "resources" && count ? `<span class="bookbinder-chip warn">${count}</span>` : ""}</button>${id === "type" ? `<div class="sub-nav">${elements}</div>` : ""}`).join("");
  }

  #drawProps() {
    const host = this.element.querySelector(".bookbinder-fields");
    const sheetName = this.#sheet === "main" ? "" : ` · ${localize("Editor.SubSheet", { name: sheetsOf(this.#draft)[this.#sheet].name })}`;
    const title = this.#section === "type" ? `${localize("Sections.type")} · ${localize(`Elements.${this.#element}`)}` : this.#section === "cover" ? localize(`Types.${typeOf(this.#draft).id}.Part`) : localize(`Sections.${this.#section}`);
    this.element.querySelector(".bookbinder-editor-props h2").textContent = title + sheetName;
    if (this.#section === "resources") this.#drawResources(host);
    else renderFields(host, this.#section === "type" ? elementFields(this.#elementDef) : SECTIONS[this.#section], this.#context);
    this.#drawContrast();
  }

  #drawResources(host) {
    host.oninput = host.onchange = host.onclick = null;
    const pending = pendingOf(this.#draft, hasFont);
    const fonts = Object.keys(CONFIG.fontDefinitions).sort((a, b) => a.localeCompare(b));
    const imageRow = name => `<li><i class="fa-solid fa-image"></i><span><b>${escapeHTML(name)}</b> · ${localize("Editor.Missing", { name: escapeHTML(this.#draft.theme.resources.images[name].path.split("/").at(-1)) })}</span>`
      + `<button type="button" data-resolve-image="${escapeHTML(name)}">${localize("Editor.Resolve")}</button></li>`;
    const fontRow = name => `<li><i class="fa-solid fa-font"></i><span><b>${escapeHTML(name)}</b> · ${localize(hasFont(name) ? "Editor.FontUnconfirmed" : "Editor.FontMissing")}</span>`
      + `<select data-font-for="${escapeHTML(name)}"><option value="">${localize("Editor.ChooseFont")}</option>${fonts.map(font => `<option>${escapeHTML(font)}</option>`).join("")}</select></li>`;
    const images = Object.entries(this.#draft.theme.resources.images ?? {}).map(([key, image]) => `<li><i class="fa-solid fa-image"></i><b>${escapeHTML(key)}</b><small>${escapeHTML(image.status === "pending" ? localize("Editor.Pending") : image.path)}</small></li>`).join("");
    host.innerHTML = `<section class="bookbinder-resources"><h3>${localize("Headings.pending")}</h3>`
      + `${pendingCount(pending) ? `<ul>${pending.images.map(imageRow).join("")}${pending.fonts.map(fontRow).join("")}</ul>` : `<p class="notes">${localize("Editor.NoPending")}</p>`}</section>`
      + `<section class="bookbinder-resources"><h3>${localize("Headings.images")}</h3><ul>${images}</ul></section>`
      + `<section class="bookbinder-resources"><h3>${localize("Headings.fonts")}</h3><ul>${usedFonts(this.#draft).map(name => `<li><i class="fa-solid fa-font"></i><b>${escapeHTML(name)}</b><small>${localize(pending.fonts.includes(name) ? "Editor.Pending" : "Editor.Ready")}</small></li>`).join("")}</ul></section>`;
  }

  #drawContrast() {
    const note = this.element.querySelector("[data-contrast]");
    const ctx = this.#context;
    const ink = resolveColor(this.#draft, read(ctx, `${elementRoot(this.#elementDef)}.color`) ?? read(ctx, "typography.base.color"));
    const paper = resolveColor(this.#draft, read(ctx, "paper.color"));
    const ratio = this.#section === "type" ? contrastRatio(ink, paper) : null;
    note.hidden = ratio === null || ratio >= 4.5;
    if (!note.hidden) note.textContent = localize("Editor.LowContrast", { ratio: ratio.toFixed(1) });
  }

  #showPreview(options = {}) {
    this.#preview.show(this.#draft, { sheet: this.#sheet, journal: game.journals.get(this.#journalId) ?? null, ...options });
  }

  #touched() {
    this.#drawTitle();
    this.#drawNav();
    this.#drawContrast();
    this.#showPreview();
  }

  #select({ section, element }) {
    if (!sectionIds(this.#sheet).includes(section)) return;
    this.#section = section;
    if (element) this.#element = element;
    this.#drawNav();
    this.#drawProps();
  }

  #setSheet(key) {
    this.#sheet = key;
    this.#drawBar();
    this.#drawNav();
    this.#drawProps();
    this.#showPreview({ focus: "sheet", immediate: true });
  }

  #setJournal(id) {
    this.#journalId = id;
    this.#showPreview({ immediate: true });
  }

  #discard() {
    this.#draft = clone(this.#saved);
    this.#drawAll();
  }

  async #addSheet() {
    const keys = sheetKeys(this.#draft);
    const fromOptions = keys.map(key => `<option value="${escapeHTML(key)}">${localize("Editor.DuplicateOf", { name: escapeHTML(sheetsOf(this.#draft)[key].name) })}</option>`).join("");
    const answer = await promptForm({
      title: localize("Editor.NewSheet"), confirm: "Common.Accept",
      content: `<div class="form-group"><label>${localize("Editor.SheetName")}</label><input type="text" name="name" value="${localize("Editor.SheetDefault", { n: keys.length + 1 })}" autofocus></div>`
        + `<div class="form-group"><label>${localize("Editor.StartFrom")}</label><select name="from"><option value="">${localize("Editor.Blank")}</option>${fromOptions}</select></div>`
    });
    if (!answer?.name.trim()) return;
    this.#sheet = addSheet(this.#draft, answer.name.trim(), answer.from || null);
    this.#drawAll();
  }

  async #renameSheet() {
    const sheet = sheetsOf(this.#draft)[this.#sheet];
    const answer = await promptForm({ title: localize("Editor.RenameSheet"), confirm: "Common.Accept", content: `<div class="form-group"><label>${localize("Editor.SheetName")}</label><input type="text" name="name" value="${escapeHTML(sheet.name)}" autofocus></div>` });
    if (!answer?.name.trim()) return;
    sheet.name = answer.name.trim();
    this.#drawAll();
  }

  async #deleteSheet() {
    const key = this.#sheet, pages = countSheetPages([...game.journals], this.#slug, key);
    const content = pages
      ? `<div class="bookbinder-notice"><i class="fa-solid fa-book"></i><div>${localize("Editor.SheetUsed", { count: pages })}</div></div><p class="notes">${localize("Editor.SheetUsedHelp")}</p>`
      : `<p>${localize("Editor.SheetUnused")}</p>`;
    const choice = await ask({ title: localize("Editor.DeleteSheetTitle", { name: sheetsOf(this.#draft)[key].name }), icon: "fa-solid fa-trash", content, buttons: [button("delete", "Editor.DeleteSheet", { default: true }), button("cancel", "Common.Cancel")] });
    if (choice !== "delete") return;
    removeSheet(this.#draft, key);
    this.#sheet = "main";
    this.#drawAll();
  }

  async #resolveImage(name) {
    const image = this.#draft.theme.resources.images[name];
    const picked = await pickImage({ current: dataPath(image.path) });
    if (!picked) return;
    useImage(this.#draft, name, picked);
    this.#touched();
    this.#drawProps();
  }

  async #conflict() {
    const latest = await currentFiles(this.#slug);
    if (!latest || fingerprint(latest) === this.#baseline || latest.theme.updatedBy === game.user.id) return null;
    return { name: userName(latest.theme.updatedBy), at: latest.theme.updatedAt };
  }

  async #adopt(slug) {
    this.#slug = slug;
    this.#baseline = fingerprint(await currentFiles(slug));
    forgetTheme(slug);
    const result = await loadTheme(slug);
    this.#saved = result.files;
    this.#draft = clone(result.files);
    this.#drawAll();
  }

  async #saveAsVersion() {
    const names = new Set((await listThemes()).world.map(entry => entry.name));
    const copy = clone(this.#draft);
    copy.theme.name = versionName(copy.theme.name, names);
    const result = await createDesign(stamp(copy, { userId: game.user.id, moduleVersion: moduleVersion(), now: Date.now() }));
    if (result.ok) await this.#adopt(result.slug);
    return result;
  }

  async save() {
    if (!isDirty(this.#draft, this.#saved)) return true;
    const conflict = await this.#conflict();
    const usage = await findUsage(this.#slug);
    const names = new Set((await listThemes()).world.map(entry => entry.name));
    const choice = conflict || usage.count
      ? await confirmSave({ name: this.#draft.theme.name, conflict, usage, versionName: versionName(this.#draft.theme.name, names) }) : "overwrite";
    if (!choice || choice === "cancel") return false;
    if (choice === "discard") {
      await this.#adopt(this.#slug);
      ui.notifications.info(localize("Editor.Discarded"));
      return true;
    }
    const result = choice === "version" ? await this.#saveAsVersion() : await saveDesign({ slug: this.#slug, files: this.#draft, isNew: false });
    if (!result.ok) {
      ui.notifications.error(localize("Editor.SaveFailed", { reason: result.reason ?? "?" }));
      return false;
    }
    if (choice === "overwrite") await this.#adopt(this.#slug);
    ui.notifications.info(localize(choice === "version" ? "Editor.SavedVersion" : result.queued ? "Editor.SavedQueued" : "Editor.Saved", { name: this.#draft.theme.name }));
    return true;
  }
}
