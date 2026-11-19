import { escapeHTML, localize } from "../constants.mjs";

const both = html => ({ live: html, still: html });
const isYouTube = src => /(?:youtube\.com|youtu\.be)\//.test(src ?? "");

function card(page) {
  const icon = CONFIG.JournalEntryPage.typeIcons?.[page.type] ?? "fa-solid fa-file";
  return `<div class="bookbinder-card"><i class="${icon}"></i><span>${escapeHTML(page.name)}</span>`
    + `<button type="button" data-bookbinder-open="${page.id}">${localize("Book.Open")}</button></div>`;
}

function title(page) {
  if (!page.title?.show) return "";
  const level = page.title.level ?? 1;
  return `<h${level} class="bookbinder-page-title">${escapeHTML(page.name)}</h${level}>`;
}

const BODY = {
  text: async page => both(await foundry.applications.ux.TextEditor.implementation.enrichHTML(page.text?.content ?? "", {
    secrets: page.isOwner,
    relativeTo: page
  })),
  image: page => both(`<figure class="bookbinder-figure"><img src="${escapeHTML(page.src)}" alt="${escapeHTML(page.name)}">`
    + (page.image?.caption ? `<figcaption>${escapeHTML(page.image.caption)}</figcaption>` : "") + "</figure>"),
  video: page => ({
    live: isYouTube(page.src) ? card(page) : `<video class="bookbinder-video" src="${escapeHTML(page.src)}" controls preload="metadata"></video>`,
    still: card(page)
  })
};

export async function renderPageBody(page) {
  try {
    const { live, still } = await (BODY[page.type]?.(page) ?? both(card(page)));
    const head = title(page);
    return { live: head + live, still: head + still };
  } catch (error) {
    console.error(error);
    return both(`<p class="bookbinder-error">${localize("Book.RenderError")}</p>`);
  }
}

export const findAnchor = (container, anchor) => [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")]
  .find(heading => (heading.dataset.anchor ?? heading.textContent.slugify({ strict: true })) === anchor);
