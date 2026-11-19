import { escapeHTML, localize, worldJournals } from "../constants.mjs";
import { canCreateThemes, canDeleteTheme, canEditTheme, canSeeTheme } from "../permissions.mjs";
import { setting } from "../settings.mjs";
import { pendingCount } from "../theme/design.mjs";
import { listTrashed, restoreDesign, trashDesign } from "../theme/storage.mjs";
import { listThemes } from "../theme/store.mjs";
import { findUsage, usesTheme } from "../theme/usage.mjs";
import { applyChoice, menuItems } from "../theme-menu.mjs";
import { HTMLApplication } from "./app.mjs";
import { ask, button, usageNotice } from "./dialogs.mjs";
import { DesignCard } from "./card.mjs";
import { DesignEditor } from "./editor.mjs";
import { PermissionsApp } from "./permissions-app.mjs";
import { DesignWizard } from "./wizard.mjs";

const CHANGED = "bookbinder.themeChanged";
const KEEP = "keep";
const pendingChip = entry => (pendingCount(entry.pending) ? `<span class="bookbinder-chip warn"><i class="fa-solid fa-triangle-exclamation"></i> ${localize("Manager.PendingChip", { images: entry.pending.images.length, fonts: entry.pending.fonts.length })}</span>` : "");
const visibilityChip = entry => (entry.meta.visibility === "all"
  ? `<span class="bookbinder-chip"><i class="fa-solid fa-users"></i> ${localize("Manager.Shared")}</span>` : `<span class="bookbinder-chip"><i class="fa-solid fa-lock"></i> ${localize("Manager.Private")}</span>`);
const iconButton = (action, icon, tip, slug, extra = "") => `<button type="button" class="icon" data-action="${action}" data-slug="${slug}" ${extra} data-tooltip="${localize(tip)}"><i class="fa-solid ${icon}"></i></button>`;

function themeOptions(items, { keep = false } = {}) {
  const options = [];
  let group = null;
  for (const item of items) {
    if (item.heading) {
      group = { label: item.label, items: [] };
      options.push(group);
    } else (group?.items ?? options).push(item);
  }
  const option = item => `<option value="${escapeHTML(item.id)}"${item.active ? " selected" : ""}>${escapeHTML(item.label)}</option>`;
  const unchanged = keep ? `<option value="${KEEP}" selected>—</option>` : "";
  return unchanged + options.map(entry => (entry.items ? `<optgroup label="${escapeHTML(entry.label)}">${entry.items.map(option).join("")}</optgroup>` : option(entry))).join("");
}

async function showUses(slug) {
  const journals = worldJournals().filter(journal => usesTheme(journal, slug));
  const rows = await Promise.all(journals.map(async journal => `<div class="form-group"><label>${escapeHTML(journal.name)}</label><select name="journal-${journal.id}">${themeOptions(await menuItems(slug))}</select></div>`));
  const idle = (await menuItems(slug)).map(item => ({ ...item, active: false }));
  const everything = `<div class="form-group"><label>${localize("Manager.ChangeAll")}</label><select name="all">${themeOptions(idle, { keep: true })}</select></div>`;
  const result = await ask({
    title: localize("Manager.UsesTitle"), icon: "fa-solid fa-list", width: 560, content: journals.length ? everything + rows.join("") : `<p class="notes">${localize("Manager.NoUses")}</p>`,
    buttons: [{ action: "apply", label: localize("Manager.Apply"), icon: "fa-solid fa-check", default: true, callback: (event, element) => Object.fromEntries(new FormData(element.form)) }, button("close", "Common.Close")]
  });
  if (typeof result !== "object" || !result) return;
  for (const journal of journals) {
    const choice = result.all === KEEP ? result[`journal-${journal.id}`] : result.all;
    if (choice !== `world:${slug}`) await applyChoice(journal, choice);
  }
}

export class DesignManager extends HTMLApplication {
  static DEFAULT_OPTIONS = {
    id: "bookbinder-manager", classes: ["bookbinder-manager"], position: { width: 660, height: "auto" }, window: { icon: "fa-solid fa-book", title: "BOOKBINDER.Manager.Title" },
    actions: {
      permissions() { return new PermissionsApp().render({ force: true }); },
      add() { return DesignWizard.open(); },
      view(event, target) { return DesignCard.open(target.dataset.slug, { trashed: target.dataset.trashed === "true" }); },
      edit(event, target) { return DesignEditor.open(target.dataset.slug); },
      trash(event, target) { return this.#confirmTrash(target.dataset.slug, target.dataset.name); },
      restore(event, target) { return restoreDesign(target.dataset.slug).then(() => ui.notifications.info(localize("Manager.Restored", { name: target.dataset.name }))); }
    }
  };

  #hooks = [];

  async _prepareContext() {
    const [listed, trashed] = await Promise.all([listThemes(), game.user.isGM ? listTrashed() : []]);
    return { designs: listed.world.filter(entry => canSeeTheme(game.user, entry.meta)), trashed };
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    const refresh = foundry.utils.debounce(() => this.render(), 200);
    this.#hooks = [[CHANGED, Hooks.on(CHANGED, refresh)], ["updateSetting", Hooks.on("updateSetting", setting => (setting.key.startsWith("bookbinder.") ? refresh() : null))]];
  }

  _onClose(options) {
    super._onClose(options);
    for (const [name, id] of this.#hooks) Hooks.off(name, id);
  }

  html({ designs, trashed }) {
    const allowed = setting("permissions"), canCreate = canCreateThemes(game.user, allowed);
    const row = entry => `<li><button type="button" class="name" data-action="view" data-slug="${entry.slug}">${escapeHTML(entry.name)}</button>${visibilityChip(entry)}${pendingChip(entry)}`
      + `<span class="actions">${iconButton("view", "fa-eye", "Manager.View", entry.slug)}${canEditTheme(game.user, entry.meta, allowed) ? iconButton("edit", "fa-pen", "Manager.Edit", entry.slug) : '<i class="icon"></i>'}`
      + `${canDeleteTheme(game.user) ? iconButton("trash", "fa-trash", "Manager.Delete", entry.slug, `data-name="${escapeHTML(entry.name)}"`) : ""}</span></li>`;
    const trashRow = entry => `<li><button type="button" class="name" data-action="view" data-trashed="true" data-slug="${entry.slug}">${escapeHTML(entry.name)}</button>`
      + `<span class="actions">${iconButton("view", "fa-eye", "Manager.View", entry.slug, 'data-trashed="true"')}<button type="button" data-action="restore" data-slug="${entry.slug}" data-name="${escapeHTML(entry.name)}"><i class="fa-solid fa-rotate-left"></i> ${localize("Manager.Restore")}</button></span></li>`;
    return `${game.user.isGM ? `<div class="bookbinder-toolbar"><button type="button" data-action="permissions"><i class="fa-solid fa-key"></i> ${localize("Manager.Permissions")}</button></div>` : ""}`
      + `<header class="bookbinder-list-head"><h2>${localize("Manager.Designs")}</h2>${canCreate ? `<button type="button" class="primary" data-action="add"><i class="fa-solid fa-plus"></i> ${localize("Manager.Add")}</button>` : ""}</header>`
      + `<ul class="bookbinder-design-list">${designs.map(row).join("") || `<li class="empty">${localize("Manager.Empty")}</li>`}</ul>`
      + `${canCreate ? "" : `<p class="notes"><i class="fa-solid fa-lock"></i> ${localize("Manager.NoPermission")}</p>`}`
      + `${trashed.length ? `<header class="bookbinder-list-head"><h2>${localize("Manager.Trash")}</h2><span class="notes">${localize("Manager.TrashHint")}</span></header><ul class="bookbinder-design-list trash">${trashed.map(trashRow).join("")}</ul>` : ""}`;
  }

  async #confirmTrash(slug, name) {
    const usage = await findUsage(slug);
    const body = usage.count ? `<p>${localize("Manager.TrashUsed", { count: usage.count, path: `Bookbinder_themes/theme/${slug}/` })}</p>` : "";
    const choice = await ask({
      title: localize("Manager.TrashTitle", { name }), icon: "fa-solid fa-trash", width: 540,
      content: `<p>${localize("Manager.TrashBody")}</p>${usageNotice(usage)}${body}`,
      buttons: [...(usage.count ? [button("uses", "Manager.SeeUses", { icon: "fa-solid fa-list" })] : []), button("trash", "Manager.MoveToTrash", { icon: "fa-solid fa-trash", default: true }), button("cancel", "Common.Cancel")]
    });
    if (choice === "uses") {
      await showUses(slug);
      return this.#confirmTrash(slug, name);
    }
    if (choice !== "trash") return;
    await trashDesign(slug);
    ui.notifications.info(localize("Manager.Trashed", { name }));
  }
}
