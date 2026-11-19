import { escapeHTML, localize } from "../constants.mjs";
import { readCatalog, uploadImage } from "../theme/images.mjs";
import { canWrite } from "../theme/store.mjs";

const groupTitle = group => (group === "world" ? localize("Gallery.World") : group === "common" ? localize("Gallery.Common") : localize("Gallery.Template", { name: group }));

const tile = (entry, index, { current, suggest }) => `<button type="button" class="bookbinder-tile${entry.path === current ? " active" : ""}${entry.path === suggest ? " suggested" : ""}" data-entry="${index}">`
  + `<img src="${escapeHTML(entry.url)}" loading="lazy" alt=""><span>${escapeHTML(entry.name)}${entry.path === suggest ? ` · ${localize("Gallery.Suggested")}` : ""}</span></button>`;

function galleryHTML(catalog, options) {
  const groups = [...new Set(catalog.map(entry => entry.group))].sort((a, b) => (b === "world") - (a === "world"));
  const bar = canWrite()
    ? `<label class="bookbinder-upload"><i class="fa-solid fa-upload"></i> ${localize("Gallery.Upload")}<input type="file" accept="image/*" hidden></label><p class="notes">${localize("Gallery.UploadHint")}</p>`
    : `<p class="notes"><i class="fa-solid fa-lock"></i> ${localize("Gallery.AskGM")}</p>`;
  const sections = groups.map(group => `<section><h3>${escapeHTML(groupTitle(group))}</h3><div class="bookbinder-tiles">`
    + catalog.map((entry, index) => (entry.group === group ? tile(entry, index, options) : "")).join("") + "</div></section>").join("");
  return `<div class="bookbinder-gallery"><div class="bookbinder-gallery-bar">${bar}</div>`
    + `<button type="button" class="bookbinder-tile none${options.current ? "" : " active"}" data-entry=""><i class="fa-solid fa-ban"></i><span>${localize("Gallery.None")}</span></button>${sections}</div>`;
}

export async function pickImage({ current, suggest, folder }) {
  const catalog = await readCatalog();
  let picked;
  await foundry.applications.api.DialogV2.wait({
    window: { title: localize("Gallery.Title"), icon: "fa-solid fa-image", resizable: true },
    position: { width: 720, height: 560 },
    classes: ["bookbinder-dialog"],
    content: galleryHTML(catalog, { current, suggest }),
    buttons: [{ action: "cancel", label: localize("Common.Cancel"), icon: "fa-solid fa-xmark", default: true }],
    rejectClose: false,
    render: (event, dialog) => {
      const root = dialog.element;
      root.querySelector(".bookbinder-gallery").addEventListener("click", click => {
        const target = click.target.closest("[data-entry]");
        if (!target) return;
        picked = catalog[target.dataset.entry] ?? null;
        dialog.close();
      });
      root.querySelector('input[type="file"]')?.addEventListener("change", async change => {
        const file = change.target.files[0];
        if (!file) return;
        const path = await uploadImage(file, folder);
        picked = { path };
        ui.notifications.info(localize("Gallery.Uploaded", { name: file.name }));
        dialog.close();
      });
    }
  });
  return picked;
}
