import { escapeHTML, localize } from "../constants.mjs";
import { canEditTheme } from "../permissions.mjs";
import { setting } from "../settings.mjs";
import { pendingCount, pendingOf } from "../theme/design.mjs";
import { createDesign, saveDesign } from "../theme/storage.mjs";
import { hasFont, listThemes, moduleVersion, readTheme } from "../theme/store.mjs";
import { copyName, markPending, packageOf, readPackage, salvage } from "../theme/transfer.mjs";
import { findUsage } from "../theme/usage.mjs";
import { versionName } from "../theme/slug.mjs";
import { ask, button, confirmSave } from "./dialogs.mjs";

const chooseFile = () => new Promise(resolve => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", () => resolve(input.files[0] ?? null), { once: true });
  input.addEventListener("cancel", () => resolve(null), { once: true });
  input.click();
});

const readFile = async file => {
  try {
    return JSON.parse(await foundry.utils.readTextFromFile(file));
  } catch {
    return null;
  }
};

const warnAndStop = reason => {
  ui.notifications.warn(localize(reason === "notTheme" ? "Transfer.NotTheme" : "Transfer.Invalid"));
  return null;
};

async function acceptNewer(read) {
  const choice = await ask({
    title: localize("Transfer.NewerTitle"), icon: "fa-solid fa-triangle-exclamation", width: 540,
    content: `<p>${localize("Transfer.Newer", { version: escapeHTML(read.version) })}</p>`,
    buttons: [button("anyway", "Transfer.Anyway", { icon: "fa-solid fa-file-import", default: true }), button("cancel", "Common.Cancel")]
  });
  return choice === "anyway" ? salvage(read.files, moduleVersion()) : null;
}

async function prepare(data) {
  const read = readPackage(data, moduleVersion());
  if (read.ok) return read;
  if (!read.newer) return warnAndStop(read.reason);
  const salvaged = await acceptNewer(read);
  return salvaged?.ok ? salvaged : null;
}

function report(result, files) {
  if (!result.ok) {
    ui.notifications.error(localize("Transfer.Failed", { reason: result.reason ?? "?" }));
    return result;
  }
  const pending = pendingOf(files, hasFont);
  const note = pendingCount(pending) ? ` ${localize("Transfer.Pending", { images: pending.images.length, fonts: pending.fonts.length })}` : "";
  ui.notifications.info(`${localize("Transfer.Imported", { name: files.theme.name })}${note}`);
  return result;
}

const asNewImport = files => {
  files.theme.visibility = "author";
  return files;
};

async function overwrite(existing, files) {
  const usage = await findUsage(existing.slug);
  files.theme.visibility = existing.meta.visibility;
  files.theme.importedFrom = existing.meta.importedFrom ?? files.theme.importedFrom;
  const taken = new Set((await listThemes()).world.map(entry => entry.name));
  const choice = usage.count
    ? await confirmSave({ name: files.theme.name, conflict: null, usage, versionName: versionName(files.theme.name, taken) })
    : "overwrite";
  if (!choice || choice === "cancel") return null;
  if (choice === "version") {
    files.theme.name = versionName(files.theme.name, taken);
    return report(await createDesign(asNewImport(files)), files);
  }
  return report(await saveDesign({ slug: existing.slug, files, isNew: false }), files);
}

async function resolveConflict(existing, names, files) {
  const canOverwrite = canEditTheme(game.user, existing.meta, setting("permissions"));
  const choice = await ask({
    title: localize("Transfer.ConflictTitle", { name: files.theme.name }), icon: "fa-solid fa-copy", width: 540,
    content: `<p>${localize("Transfer.Conflict", { name: escapeHTML(files.theme.name) })}</p>`,
    buttons: [
      button("copy", "Transfer.AsCopy", { icon: "fa-solid fa-copy", default: true }),
      ...(canOverwrite ? [button("overwrite", "Transfer.Overwrite", { icon: "fa-solid fa-floppy-disk" })] : []),
      button("cancel", "Common.Cancel")
    ]
  });
  if (choice === "copy") {
    files.theme.name = copyName(files.theme.name, names);
    return report(await createDesign(asNewImport(files)), files);
  }
  return choice === "overwrite" ? overwrite(existing, files) : null;
}

export async function importDesign() {
  const file = await chooseFile();
  if (!file) return null;
  const data = await readFile(file);
  const prepared = await prepare(data);
  if (!prepared) return null;
  const files = markPending(prepared.files);
  const world = (await listThemes()).world;
  const existing = world.find(entry => entry.name === files.theme.name);
  if (existing) return resolveConflict(existing, new Set(world.map(entry => entry.name)), files);
  return report(await createDesign(asNewImport(files)), files);
}

export async function exportDesign(slug) {
  const result = await readTheme(slug);
  if (!result.ok) return ui.notifications.error(localize("Transfer.ExportFailed"));
  const data = JSON.stringify(packageOf(result.files, moduleVersion()), null, 2);
  foundry.utils.saveDataToFile(data, "application/json", `bookbinder-${slug}.json`);
  return result;
}
