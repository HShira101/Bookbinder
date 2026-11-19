import { escapeHTML, localize, userName } from "../constants.mjs";
import { canCreateThemes, canEditTheme } from "../permissions.mjs";
import { setting } from "../settings.mjs";
import { pendingCount, pendingOf, sheetsOf, typeOf, validSheet } from "../theme/design.mjs";
import { restoreDesign } from "../theme/storage.mjs";
import { forgetTheme, hasFont, readTheme, worldLocation } from "../theme/store.mjs";
import { findUsage } from "../theme/usage.mjs";
import { ShellApplication } from "./app.mjs";
import { timeAgo, usageNotice } from "./dialogs.mjs";
import { DesignEditor } from "./editor.mjs";
import { sheetOptions } from "./fields.mjs";
import { PreviewPane } from "./preview.mjs";
import { DesignWizard } from "./wizard.mjs";

const idOf = slug => `bookbinder-card-${slug}`;
const term = (label, value) => (value ? `<dt>${label}</dt><dd>${value}</dd>` : "");

const skeleton = () => `
<div class="bookbinder-card-preview"><div class="bookbinder-wizard-bar"><label>${localize("Editor.Sheet")} <select data-sheet></select></label></div><div class="bookbinder-preview-box"></div></div>
<aside class="bookbinder-card-data"></aside>`;

export class DesignCard extends ShellApplication {
  static DEFAULT_OPTIONS = {
    classes: ["bookbinder-card-window"], position: { width: 1060, height: 660 }, window: { icon: "fa-solid fa-eye" },
    actions: {
      edit() { return this.#edit("base"); },
      resolve() { return this.#edit("resources"); },
      useAsBase() { return this.#useAsBase(); },
      restore() { return this.#restore(); }
    }
  };

  static async open(slug, { trashed = false } = {}) {
    const existing = foundry.applications.instances.get(idOf(slug));
    if (existing) return existing.bringToFront();
    forgetTheme(slug);
    const result = await readTheme(slug, trashed ? worldLocation() : undefined);
    if (!result.ok) return null;
    const app = new DesignCard({ id: idOf(slug), slug });
    Object.assign(app.#state, { result, trashed, usage: await findUsage(slug) });
    return app.render({ force: true });
  }

  #state = {};
  #sheet = "main";
  #preview;

  get title() {
    return localize("Card.Title", { name: this.#state.result.files.theme.name });
  }

  async html() {
    return skeleton();
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#preview = new PreviewPane(this.element.querySelector(".bookbinder-preview-box"));
    this.element.querySelector("[data-sheet]").addEventListener("change", event => {
      this.#sheet = event.target.value;
      this.#showPreview();
    });
    this.#draw();
    this.#showPreview();
  }

  _onClose(options) {
    super._onClose(options);
    this.#preview?.destroy();
  }

  #showPreview() {
    this.#preview.show(this.#state.result.files, { sheet: validSheet(this.#state.result.files, this.#sheet), immediate: true });
  }

  #draw() {
    const { files } = this.#state.result, { trashed, usage, result } = this.#state;
    const meta = files.theme, pending = pendingOf(files, hasFont), preset = result.source === "preset";
    const editable = !trashed && !preset && canEditTheme(game.user, meta, setting("permissions"));
    const select = this.element.querySelector("[data-sheet]");
    select.innerHTML = sheetOptions(files, this.#sheet);
    const pendingList = pendingCount(pending)
      ? `<ul class="bookbinder-pending">${pending.images.map(name => `<li><i class="fa-solid fa-image"></i><span><b>${escapeHTML(name)}</b></span></li>`).join("")}`
        + `${pending.fonts.map(name => `<li><i class="fa-solid fa-font"></i><span><b>${escapeHTML(name)}</b></span></li>`).join("")}</ul>${editable ? `<button type="button" data-action="resolve">${localize("Card.Resolve")}</button>` : ""}` : "";
    const buttons = trashed ? `<button type="button" class="primary" data-action="restore"><i class="fa-solid fa-rotate-left"></i> ${localize("Manager.Restore")}</button>`
      : `${editable ? `<button type="button" class="primary" data-action="edit"><i class="fa-solid fa-pen"></i> ${localize("Card.Edit")}</button>` : ""}`
        + `${canCreateThemes(game.user, setting("permissions")) ? `<button type="button" data-action="useAsBase"><i class="fa-solid fa-copy"></i> ${localize("Card.UseAsBase")}</button>` : ""}`;
    this.element.querySelector(".bookbinder-card-data").innerHTML = `<h2>${escapeHTML(meta.name)}</h2>`
      + `${preset ? `<p class="bookbinder-banner"><i class="fa-solid fa-lock"></i> ${localize("Card.PresetBanner")}</p>` : ""}${trashed ? `<p class="bookbinder-banner warn"><i class="fa-solid fa-trash"></i> ${localize("Card.TrashBanner")}</p>` : ""}`
      + `<dl>${term(localize("Card.Author"), `${escapeHTML(meta.author?.name ?? "?")}${meta.author?.id === game.user.id ? ` ${localize("Card.You")}` : ""}`)}${term(localize("Card.ImportedFrom"), escapeHTML(meta.importedFrom))}`
      + `${term(localize("Card.Visibility"), localize(`Options.visibility.${meta.visibility ?? "author"}`))}${term(localize("Card.Type"), `${localize(`Types.${typeOf(files).id}.Glyph`)} ${localize(`Types.${typeOf(files).id}.Name`)}`)}`
      + `${term(localize("Card.SubSheets"), Object.values(sheetsOf(files)).map(sheet => escapeHTML(sheet.name)).join(" · ") || localize("Card.None"))}`
      + `${meta.updatedBy ? term(localize("Card.LastSaved"), `${escapeHTML(userName(meta.updatedBy))}, ${timeAgo(meta.updatedAt)}`) : ""}`
      + `${term(localize("Card.Pending"), pendingCount(pending) ? `<span class="bookbinder-chip warn">${localize("Manager.PendingChip", { images: pending.images.length, fonts: pending.fonts.length })}</span>` : localize("Card.None"))}</dl>`
      + `${pendingList}${preset ? "" : usageNotice(usage) || `<div class="bookbinder-notice"><i class="fa-solid fa-book"></i><div>${localize("Card.NotUsed")}</div></div>`}<footer class="bookbinder-buttons">${buttons}</footer>`;
  }

  async #edit(section) {
    await DesignEditor.open(this.options.slug, { section });
    return this.close();
  }

  async #useAsBase() {
    await DesignWizard.open(this.options.slug);
    return this.close();
  }

  async #restore() {
    await restoreDesign(this.options.slug);
    ui.notifications.info(localize("Manager.Restored", { name: this.#state.result.files.theme.name }));
    return this.close();
  }
}
