import { escapeHTML, localize } from "../constants.mjs";

const { DialogV2 } = foundry.applications.api;

export const button = (action, label, extra = {}) => ({ action, label: localize(label), ...extra });

export function ask({ title, icon = "fa-solid fa-triangle-exclamation", content, buttons, width = 520 }) {
  return DialogV2.wait({ window: { title, icon }, position: { width }, classes: ["bookbinder-dialog"], content, buttons, rejectClose: false });
}

export async function promptForm({ title, icon = "fa-solid fa-pen", content, confirm }) {
  const result = await ask({
    title, icon, content,
    buttons: [{ action: "ok", label: localize(confirm), icon: "fa-solid fa-check", default: true, callback: (event, element) => Object.fromEntries(new FormData(element.form)) }, button("cancel", "Common.Cancel")]
  });
  return typeof result === "object" && result ? result : null;
}

export function timeAgo(timestamp) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  const format = new Intl.RelativeTimeFormat(game.i18n.lang, { numeric: "auto" });
  return minutes < 60 ? format.format(-minutes, "minute") : minutes < 1440 ? format.format(-Math.round(minutes / 60), "hour") : format.format(-Math.round(minutes / 1440), "day");
}

export function usageNotice(usage) {
  if (!usage.count) return "";
  const names = game.user.isGM ? `<details><summary>${localize("Save.ShowDetail")}</summary><ul>${usage.journals.map(entry => `<li>${escapeHTML(entry.name)}</li>`).join("")}</ul></details>` : "";
  const unchecked = usage.unchecked ? `<p class="notes">${localize("Save.Unchecked", { count: usage.unchecked })}</p>` : "";
  return `<div class="bookbinder-notice"><i class="fa-solid fa-book"></i><div>${localize("Save.UsedIn", { count: usage.count })}${names}${unchecked}</div></div>`;
}

export function confirmSave({ name, conflict, usage, versionName }) {
  const conflictNotice = conflict
    ? `<div class="bookbinder-notice warn"><i class="fa-solid fa-users"></i><div>${localize("Save.Conflict", { user: escapeHTML(conflict.name), when: timeAgo(conflict.at) })}</div></div>` : "";
  const help = `<p class="notes">${localize("Save.Help", { version: escapeHTML(versionName) })}${conflict ? ` ${localize("Save.HelpDiscard")}` : ""}</p>`;
  return ask({
    title: localize("Save.Title", { name }), content: `${conflictNotice}${usageNotice(usage)}${help}`, width: 580,
    buttons: [
      button("overwrite", "Save.Overwrite", { icon: "fa-solid fa-floppy-disk", default: true }),
      button("version", "Save.NewVersion", { icon: "fa-solid fa-copy" }),
      ...(conflict ? [button("discard", "Save.Discard", { icon: "fa-solid fa-rotate-left" })] : []),
      button("cancel", "Common.Cancel", { icon: "fa-solid fa-xmark" })
    ]
  });
}

export function confirmClose(name) {
  return ask({
    title: localize("Close.Title"), content: `<p>${localize("Close.Body", { name: escapeHTML(name) })}</p>`,
    buttons: [button("save", "Close.Save", { icon: "fa-solid fa-floppy-disk", default: true }), button("discard", "Close.Discard", { icon: "fa-solid fa-trash" }), button("keep", "Close.Keep", { icon: "fa-solid fa-pen" })]
  });
}
