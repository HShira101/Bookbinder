import { MODULE_ID, escapeHTML, localize } from "../constants.mjs";
import { HTMLApplication } from "./app.mjs";

export class PermissionsApp extends HTMLApplication {
  static DEFAULT_OPTIONS = {
    id: "bookbinder-permissions", position: { width: 460 }, window: { icon: "fa-solid fa-key", title: "BOOKBINDER.Permissions.Title", resizable: false },
    actions: {
      add() { return this.#add(); },
      remove(event, target) { return this.#set(this.#allowed.filter(id => id !== target.dataset.user)); }
    }
  };

  get #allowed() {
    return game.settings.get(MODULE_ID, "permissions");
  }

  #set(list) {
    return game.settings.set(MODULE_ID, "permissions", list).then(() => this.render());
  }

  #add() {
    const id = this.element.querySelector("select").value;
    if (id) return this.#set([...this.#allowed, id]);
  }

  html() {
    const players = game.users.filter(user => !user.isGM);
    const listed = players.filter(user => this.#allowed.includes(user.id));
    const free = players.filter(user => !this.#allowed.includes(user.id));
    const gmRows = game.users.filter(user => user.isGM).map(user => `<li class="locked"><i class="fa-solid fa-lock"></i><b>${escapeHTML(user.name)}</b><span>${localize("Permissions.GMAlways")}</span></li>`).join("");
    const rows = listed.map(user => `<li><i class="fa-solid fa-check"></i><b>${escapeHTML(user.name)}</b><span>${localize(user.can("FILES_UPLOAD") ? "Permissions.CanUpload" : "Permissions.CannotUpload")}</span>`
      + `<button type="button" data-action="remove" data-user="${user.id}">${localize("Permissions.Remove")}</button></li>`).join("");
    return `<h2>${localize("Permissions.Heading")}</h2><div class="bookbinder-inline"><select><option value="">${localize("Permissions.Choose")}</option>`
      + `${free.map(user => `<option value="${user.id}">${escapeHTML(user.name)}</option>`).join("")}</select><button type="button" class="primary" data-action="add">${localize("Permissions.Add")}</button></div>`
      + `<ul class="bookbinder-people">${gmRows}${rows}</ul><p class="notes">${localize("Permissions.Help")}</p>`;
  }
}
